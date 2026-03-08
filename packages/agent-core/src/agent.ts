import { getModel } from '@mariozechner/pi-ai/dist/models.js'
import type {
  ImageContent,
  Message,
  Model,
  ThinkingBudgets,
  Transport
} from '@mariozechner/pi-ai'
import { agentLoop, agentLoopContinue } from './agentLoop'
import type { AgentEvent, AgentMessage, AgentState, AgentTool, StreamFn, ThinkingLevel } from './types'

export interface AgentOptions {
  initialState?: Partial<AgentState>
  convertToLlm?: (messages: AgentMessage[]) => Message[] | Promise<Message[]>
  transformContext?: (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>
  steeringMode?: 'all' | 'one-at-a-time'
  followUpMode?: 'all' | 'one-at-a-time'
  streamFn?: StreamFn
  sessionId?: string
  getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined
  thinkingBudgets?: ThinkingBudgets
  transport?: Transport
  maxRetryDelayMs?: number
}

function defaultConvertToLlm(messages: AgentMessage[]) {
  return messages.filter(
    (message) =>
      message.role === 'user' || message.role === 'assistant' || message.role === 'toolResult'
  )
}

function defaultStreamFn(): never {
  throw new Error('Agent requires an explicit streamFn. Pass one when constructing the session.')
}

function getDefaultModel(): Model<any> {
  const model = getModel('google', 'gemini-2.5-flash-lite-preview-06-17')
  if (!model) {
    throw new Error('Default model google/gemini-2.5-flash-lite-preview-06-17 not found')
  }
  return model
}

export class Agent {
  private _state: AgentState = {
    systemPrompt: '',
    model: getDefaultModel(),
    thinkingLevel: 'off',
    tools: [],
    messages: [],
    isStreaming: false,
    streamMessage: null,
    pendingToolCalls: new Set(),
    error: undefined
  }

  private listeners = new Set<(event: AgentEvent) => void>()
  private abortController?: AbortController
  private convertToLlm: (messages: AgentMessage[]) => Message[] | Promise<Message[]>
  private transformContext?: (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>
  private steeringQueue: AgentMessage[] = []
  private followUpQueue: AgentMessage[] = []
  private steeringMode: 'all' | 'one-at-a-time'
  private followUpMode: 'all' | 'one-at-a-time'
  streamFn: StreamFn
  private _sessionId?: string
  getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined
  private runningPrompt?: Promise<void>
  private resolveRunningPrompt?: () => void
  private _thinkingBudgets?: ThinkingBudgets
  private _transport: Transport
  private _maxRetryDelayMs?: number

  constructor(opts: AgentOptions = {}) {
    this._state = { ...this._state, ...opts.initialState }
    this.convertToLlm = opts.convertToLlm || defaultConvertToLlm
    this.transformContext = opts.transformContext
    this.steeringMode = opts.steeringMode || 'one-at-a-time'
    this.followUpMode = opts.followUpMode || 'one-at-a-time'
    this.streamFn = opts.streamFn || (defaultStreamFn as StreamFn)
    this._sessionId = opts.sessionId
    this.getApiKey = opts.getApiKey
    this._thinkingBudgets = opts.thinkingBudgets
    this._transport = opts.transport ?? 'sse'
    this._maxRetryDelayMs = opts.maxRetryDelayMs
  }

  get sessionId(): string | undefined {
    return this._sessionId
  }

  set sessionId(value: string | undefined) {
    this._sessionId = value
  }

  get thinkingBudgets(): ThinkingBudgets | undefined {
    return this._thinkingBudgets
  }

  set thinkingBudgets(value: ThinkingBudgets | undefined) {
    this._thinkingBudgets = value
  }

  get transport(): Transport {
    return this._transport
  }

  setTransport(value: Transport): void {
    this._transport = value
  }

  get maxRetryDelayMs(): number | undefined {
    return this._maxRetryDelayMs
  }

  set maxRetryDelayMs(value: number | undefined) {
    this._maxRetryDelayMs = value
  }

  get state(): AgentState {
    return this._state
  }

  subscribe(fn: (event: AgentEvent) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  setSystemPrompt(value: string): void {
    this._state.systemPrompt = value
  }

  setModel(model: Model<any>): void {
    this._state.model = model
  }

  setThinkingLevel(level: ThinkingLevel): void {
    this._state.thinkingLevel = level
  }

  setSteeringMode(mode: 'all' | 'one-at-a-time'): void {
    this.steeringMode = mode
  }

  getSteeringMode(): 'all' | 'one-at-a-time' {
    return this.steeringMode
  }

  setFollowUpMode(mode: 'all' | 'one-at-a-time'): void {
    this.followUpMode = mode
  }

  getFollowUpMode(): 'all' | 'one-at-a-time' {
    return this.followUpMode
  }

  setTools(tools: AgentTool<any>[]): void {
    this._state.tools = tools
  }

  replaceMessages(messages: AgentMessage[]): void {
    this._state.messages = messages.slice()
  }

  appendMessage(message: AgentMessage): void {
    this._state.messages = [...this._state.messages, message]
  }

  steer(message: AgentMessage): void {
    this.steeringQueue.push(message)
  }

  followUp(message: AgentMessage): void {
    this.followUpQueue.push(message)
  }

  clearSteeringQueue(): void {
    this.steeringQueue = []
  }

  clearFollowUpQueue(): void {
    this.followUpQueue = []
  }

  clearAllQueues(): void {
    this.steeringQueue = []
    this.followUpQueue = []
  }

  hasQueuedMessages(): boolean {
    return this.steeringQueue.length > 0 || this.followUpQueue.length > 0
  }

  private dequeueSteeringMessages(): AgentMessage[] {
    if (this.steeringMode === 'one-at-a-time') {
      if (this.steeringQueue.length === 0) return []
      const [first, ...rest] = this.steeringQueue
      this.steeringQueue = rest
      return [first]
    }

    const steering = this.steeringQueue.slice()
    this.steeringQueue = []
    return steering
  }

  private dequeueFollowUpMessages(): AgentMessage[] {
    if (this.followUpMode === 'one-at-a-time') {
      if (this.followUpQueue.length === 0) return []
      const [first, ...rest] = this.followUpQueue
      this.followUpQueue = rest
      return [first]
    }

    const followUps = this.followUpQueue.slice()
    this.followUpQueue = []
    return followUps
  }

  clearMessages(): void {
    this._state.messages = []
  }

  abort(): void {
    this.abortController?.abort()
  }

  waitForIdle(): Promise<void> {
    return this.runningPrompt ?? Promise.resolve()
  }

  reset(): void {
    this._state.messages = []
    this._state.isStreaming = false
    this._state.streamMessage = null
    this._state.pendingToolCalls = new Set()
    this._state.error = undefined
    this.steeringQueue = []
    this.followUpQueue = []
  }

  async prompt(message: AgentMessage | AgentMessage[]): Promise<void>
  async prompt(input: string, images?: ImageContent[]): Promise<void>
  async prompt(input: AgentMessage | AgentMessage[] | string, images?: ImageContent[]): Promise<void> {
    if (this._state.isStreaming) {
      throw new Error(
        'Agent is already processing a prompt. Use steer() or followUp() to queue messages, or wait for completion.'
      )
    }

    const model = this._state.model
    if (!model) throw new Error('No model configured')

    let messages: AgentMessage[]
    if (Array.isArray(input)) {
      messages = input
    } else if (typeof input === 'string') {
      const content: ({ type: 'text'; text: string } | ImageContent)[] = [{ type: 'text', text: input }]
      if (images && images.length > 0) {
        content.push(...images)
      }
      messages = [
        {
          role: 'user',
          content,
          timestamp: Date.now()
        }
      ]
    } else {
      messages = [input]
    }

    await this.runLoop(messages)
  }

  async continue(): Promise<void> {
    if (this._state.isStreaming) {
      throw new Error('Agent is already processing. Wait for completion before continuing.')
    }

    const messages = this._state.messages
    if (messages.length === 0) {
      throw new Error('No messages to continue from')
    }

    if (messages[messages.length - 1]?.role === 'assistant') {
      const queuedSteering = this.dequeueSteeringMessages()
      if (queuedSteering.length > 0) {
        await this.runLoop(queuedSteering, { skipInitialSteeringPoll: true })
        return
      }

      const queuedFollowUp = this.dequeueFollowUpMessages()
      if (queuedFollowUp.length > 0) {
        await this.runLoop(queuedFollowUp)
        return
      }

      throw new Error('Cannot continue from message role: assistant')
    }

    await this.runLoop(undefined)
  }

  private async runLoop(
    messages?: AgentMessage[],
    options?: {
      skipInitialSteeringPoll?: boolean
    }
  ) {
    const model = this._state.model
    if (!model) throw new Error('No model configured')

    this.runningPrompt = new Promise((resolve) => {
      this.resolveRunningPrompt = resolve
    })
    this.abortController = new AbortController()
    this._state.isStreaming = true
    this._state.streamMessage = null
    this._state.error = undefined

    const reasoning = this._state.thinkingLevel === 'off' ? undefined : this._state.thinkingLevel
    const context = {
      systemPrompt: this._state.systemPrompt,
      messages: this._state.messages.slice(),
      tools: this._state.tools
    }

    let skipInitialSteeringPoll = options?.skipInitialSteeringPoll === true

    const config = {
      model,
      reasoning,
      sessionId: this._sessionId,
      transport: this._transport,
      thinkingBudgets: this._thinkingBudgets,
      maxRetryDelayMs: this._maxRetryDelayMs,
      convertToLlm: this.convertToLlm,
      transformContext: this.transformContext,
      getApiKey: this.getApiKey,
      getSteeringMessages: async () => {
        if (skipInitialSteeringPoll) {
          skipInitialSteeringPoll = false
          return []
        }
        return this.dequeueSteeringMessages()
      },
      getFollowUpMessages: async () => this.dequeueFollowUpMessages()
    }

    let partial: AgentMessage | null = null

    try {
      const stream = messages
        ? agentLoop(messages, context, config, this.abortController.signal, this.streamFn)
        : agentLoopContinue(context, config, this.abortController.signal, this.streamFn)

      for await (const event of stream) {
        switch (event.type) {
          case 'message_start':
            partial = event.message
            this._state.streamMessage = event.message
            break
          case 'message_update':
            partial = event.message
            this._state.streamMessage = event.message
            break
          case 'message_end':
            partial = null
            this._state.streamMessage = null
            this.appendMessage(event.message)
            break
          case 'tool_execution_start': {
            const pending = new Set(this._state.pendingToolCalls)
            pending.add(event.toolCallId)
            this._state.pendingToolCalls = pending
            break
          }
          case 'tool_execution_end': {
            const pending = new Set(this._state.pendingToolCalls)
            pending.delete(event.toolCallId)
            this._state.pendingToolCalls = pending
            break
          }
          case 'turn_end':
            if (event.message.role === 'assistant' && event.message.errorMessage) {
              this._state.error = event.message.errorMessage
            }
            break
          case 'agent_end':
            this._state.isStreaming = false
            this._state.streamMessage = null
            break
        }

        this.emit(event)
      }

      if (partial && partial.role === 'assistant' && partial.content.length > 0) {
        const onlyEmpty = !partial.content.some(
          (content) =>
            (content.type === 'thinking' && content.thinking.trim().length > 0) ||
            (content.type === 'text' && content.text.trim().length > 0) ||
            (content.type === 'toolCall' && content.name.trim().length > 0)
        )

        if (!onlyEmpty) {
          this.appendMessage(partial)
        } else if (this.abortController?.signal.aborted) {
          throw new Error('Request was aborted')
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorMsg = {
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: '' }],
        api: model.api,
        provider: model.provider,
        model: model.id,
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
        },
        stopReason: this.abortController?.signal.aborted ? ('aborted' as const) : ('error' as const),
        errorMessage,
        timestamp: Date.now()
      }

      this.appendMessage(errorMsg)
      this._state.error = errorMessage
      this.emit({ type: 'agent_end', messages: [errorMsg] })
    } finally {
      this._state.isStreaming = false
      this._state.streamMessage = null
      this._state.pendingToolCalls = new Set()
      this.abortController = undefined
      this.resolveRunningPrompt?.()
      this.runningPrompt = undefined
      this.resolveRunningPrompt = undefined
    }
  }

  private emit(event: AgentEvent) {
    for (const listener of this.listeners) {
      listener(event)
    }
  }
}
