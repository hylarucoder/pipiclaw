import { EventStream } from '@mariozechner/pi-ai/dist/utils/event-stream.js'
import type {
  AssistantMessage,
  AssistantMessageEvent,
  Context,
  Model,
  SimpleStreamOptions
} from '@mariozechner/pi-ai/dist/types.js'
import type { ChatStreamTransport } from '../ports/chatStreamTransport'

export function createChatStreamRequestId(): string {
  const randomId = globalThis.crypto?.randomUUID?.()
  if (randomId) return randomId
  return `chat-stream-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function cloneSerializable<T>(value: T): T {
  try {
    return structuredClone(value)
  } catch {
    return JSON.parse(JSON.stringify(value)) as T
  }
}

export function sanitizeChatContextForTransport(context: Context): Context {
  const sanitizedTools = context.tools?.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }))

  return cloneSerializable({
    ...context,
    tools: sanitizedTools
  })
}

export function sanitizeChatOptionsForTransport(
  options?: SimpleStreamOptions
): Record<string, unknown> {
  if (!options) return {}
  const sanitized = { ...(options as Record<string, unknown>) }
  delete sanitized.signal
  delete sanitized.onPayload
  return cloneSerializable(sanitized)
}

export function buildChatStreamErrorEvent(
  model: Model<string>,
  message: string,
  aborted = false
): AssistantMessageEvent {
  const errorMessage: AssistantMessage = {
    role: 'assistant',
    content: [],
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
    stopReason: aborted ? 'aborted' : 'error',
    errorMessage: message,
    timestamp: Date.now()
  }

  return {
    type: 'error',
    reason: aborted ? 'aborted' : 'error',
    error: errorMessage
  }
}

export function createChatStreamClient(
  transport: ChatStreamTransport,
  model: Model<string>,
  context: Context,
  options?: SimpleStreamOptions
): EventStream<AssistantMessageEvent, AssistantMessage> {
  const stream = new EventStream<AssistantMessageEvent, AssistantMessage>(
    (event) => event.type === 'done' || event.type === 'error',
    (event) => {
      if (event.type === 'done') return event.message
      if (event.type === 'error') return event.error
      throw new Error('Unexpected stream event type while extracting result')
    }
  )
  const requestId = createChatStreamRequestId()
  const signal = options?.signal
  let cleanedUp = false
  let unsubscribe: (() => void) | null = null

  const onAbort = (): void => {
    void transport.abortStream({ requestId })
  }

  const cleanup = (): void => {
    if (cleanedUp) return
    cleanedUp = true
    unsubscribe?.()
    unsubscribe = null
    signal?.removeEventListener('abort', onAbort)
  }

  unsubscribe = transport.onStreamEvent((payload) => {
    if (payload.requestId !== requestId) return

    if (payload.kind === 'event') {
      stream.push(payload.event as AssistantMessageEvent)
      return
    }

    if (payload.kind === 'error') {
      stream.push(buildChatStreamErrorEvent(model, payload.error ?? 'Chat stream failed'))
      cleanup()
      stream.end()
      return
    }

    cleanup()
    stream.end()
  })

  signal?.addEventListener('abort', onAbort, { once: true })

  void transport
    .startStream({
      requestId,
      model,
      context: sanitizeChatContextForTransport(context),
      options: sanitizeChatOptionsForTransport(options)
    })
    .then((result) => {
      if (!result.ok) {
        stream.push(buildChatStreamErrorEvent(model, result.error ?? 'Failed to start chat stream'))
        cleanup()
        stream.end()
      }
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : 'Failed to start chat stream'
      stream.push(buildChatStreamErrorEvent(model, message))
      cleanup()
      stream.end()
    })

  return stream
}
