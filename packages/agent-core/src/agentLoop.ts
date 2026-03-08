import { EventStream } from '@mariozechner/pi-ai/dist/utils/event-stream.js'
import { validateToolArguments } from '@mariozechner/pi-ai/dist/utils/validation.js'
import type {
  AgentContext,
  AgentEvent,
  AgentLoopConfig,
  AgentMessage,
  AgentTool,
  StreamFn,
  ToolResultMessage
} from './types'

type AssistantAgentMessage = Extract<AgentMessage, { role: 'assistant' }>

export function agentLoop(
  prompts: AgentMessage[],
  context: AgentContext,
  config: AgentLoopConfig,
  signal: AbortSignal | undefined,
  streamFn: StreamFn
) {
  const stream = createAgentStream()
  void (async () => {
    const newMessages = [...prompts]
    const currentContext = {
      ...context,
      messages: [...context.messages, ...prompts]
    }

    stream.push({ type: 'agent_start' })
    stream.push({ type: 'turn_start' })

    for (const prompt of prompts) {
      stream.push({ type: 'message_start', message: prompt })
      stream.push({ type: 'message_end', message: prompt })
    }

    await runLoop(currentContext, newMessages, config, signal, stream, streamFn)
  })()
  return stream
}

export function agentLoopContinue(
  context: AgentContext,
  config: AgentLoopConfig,
  signal: AbortSignal | undefined,
  streamFn: StreamFn
) {
  if (context.messages.length === 0) {
    throw new Error('Cannot continue: no messages in context')
  }

  if (context.messages[context.messages.length - 1]?.role === 'assistant') {
    throw new Error('Cannot continue from message role: assistant')
  }

  const stream = createAgentStream()
  void (async () => {
    const newMessages: AgentMessage[] = []
    const currentContext = { ...context }

    stream.push({ type: 'agent_start' })
    stream.push({ type: 'turn_start' })

    await runLoop(currentContext, newMessages, config, signal, stream, streamFn)
  })()
  return stream
}

function createAgentStream() {
  return new EventStream<AgentEvent, AgentMessage[]>(
    (event) => event.type === 'agent_end',
    (event) => (event.type === 'agent_end' ? event.messages : [])
  )
}

async function runLoop(
  currentContext: AgentContext,
  newMessages: AgentMessage[],
  config: AgentLoopConfig,
  signal: AbortSignal | undefined,
  stream: EventStream<AgentEvent, AgentMessage[]>,
  streamFn: StreamFn
) {
  let firstTurn = true
  let pendingMessages = (await config.getSteeringMessages?.()) || []

  while (true) {
    let hasMoreToolCalls = true
    let steeringAfterTools: AgentMessage[] | null = null

    while (hasMoreToolCalls || pendingMessages.length > 0) {
      if (!firstTurn) {
        stream.push({ type: 'turn_start' })
      } else {
        firstTurn = false
      }

      if (pendingMessages.length > 0) {
        for (const message of pendingMessages) {
          stream.push({ type: 'message_start', message })
          stream.push({ type: 'message_end', message })
          currentContext.messages.push(message)
          newMessages.push(message)
        }
        pendingMessages = []
      }

      const message = await streamAssistantResponse(currentContext, config, signal, stream, streamFn)
      newMessages.push(message)

      if (message.stopReason === 'error' || message.stopReason === 'aborted') {
        stream.push({ type: 'turn_end', message, toolResults: [] })
        stream.push({ type: 'agent_end', messages: newMessages })
        stream.end(newMessages)
        return
      }

      const toolCalls = message.content.filter((content) => content.type === 'toolCall')
      hasMoreToolCalls = toolCalls.length > 0
      const toolResults: ToolResultMessage[] = []

      if (hasMoreToolCalls) {
        const toolExecution = await executeToolCalls(
          currentContext.tools,
          message,
          signal,
          stream,
          config.getSteeringMessages
        )

        toolResults.push(...toolExecution.toolResults)
        steeringAfterTools = toolExecution.steeringMessages ?? null

        for (const result of toolResults) {
          currentContext.messages.push(result)
          newMessages.push(result)
        }
      }

      stream.push({ type: 'turn_end', message, toolResults })

      if (steeringAfterTools && steeringAfterTools.length > 0) {
        pendingMessages = steeringAfterTools
        steeringAfterTools = null
      } else {
        pendingMessages = (await config.getSteeringMessages?.()) || []
      }
    }

    const followUpMessages = (await config.getFollowUpMessages?.()) || []
    if (followUpMessages.length > 0) {
      pendingMessages = followUpMessages
      continue
    }

    break
  }

  stream.push({ type: 'agent_end', messages: newMessages })
  stream.end(newMessages)
}

async function streamAssistantResponse(
  context: AgentContext,
  config: AgentLoopConfig,
  signal: AbortSignal | undefined,
  stream: EventStream<AgentEvent, AgentMessage[]>,
  streamFn: StreamFn
) {
  let messages = context.messages
  if (config.transformContext) {
    messages = await config.transformContext(messages, signal)
  }

  const llmMessages = await config.convertToLlm(messages)
  const llmContext = {
    systemPrompt: context.systemPrompt,
    messages: llmMessages,
    tools: context.tools
  }

  const resolvedApiKey =
    (config.getApiKey ? await config.getApiKey(config.model.provider) : undefined) || config.apiKey

  const response = await streamFn(config.model, llmContext, {
    ...config,
    apiKey: resolvedApiKey,
    signal
  })

  let partialMessage: AssistantAgentMessage | null = null
  let addedPartial = false

  for await (const event of response) {
    switch (event.type) {
      case 'start':
        partialMessage = event.partial as AssistantAgentMessage
        context.messages.push(partialMessage)
        addedPartial = true
        stream.push({ type: 'message_start', message: { ...partialMessage } })
        break
      case 'text_start':
      case 'text_delta':
      case 'text_end':
      case 'thinking_start':
      case 'thinking_delta':
      case 'thinking_end':
      case 'toolcall_start':
      case 'toolcall_delta':
      case 'toolcall_end':
        if (partialMessage) {
          partialMessage = event.partial as AssistantAgentMessage
          context.messages[context.messages.length - 1] = partialMessage
          stream.push({
            type: 'message_update',
            assistantMessageEvent: event,
            message: { ...partialMessage }
          })
        }
        break
      case 'done':
      case 'error': {
        const finalMessage = (await response.result()) as AssistantAgentMessage
        if (addedPartial) {
          context.messages[context.messages.length - 1] = finalMessage
        } else {
          context.messages.push(finalMessage)
        }
        if (!addedPartial) {
          stream.push({ type: 'message_start', message: { ...finalMessage } })
        }
        stream.push({ type: 'message_end', message: finalMessage })
        return finalMessage
      }
    }
  }

  return await response.result()
}

async function executeToolCalls(
  tools: AgentTool<any>[] | undefined,
  assistantMessage: AssistantAgentMessage,
  signal: AbortSignal | undefined,
  stream: EventStream<AgentEvent, AgentMessage[]>,
  getSteeringMessages?: () => Promise<AgentMessage[]>
) {
  const toolCalls = assistantMessage.content.filter((content) => content.type === 'toolCall')
  const results: ToolResultMessage[] = []
  let steeringMessages: AgentMessage[] | undefined

  for (let index = 0; index < toolCalls.length; index += 1) {
    const toolCall = toolCalls[index]
    const tool = tools?.find((candidate) => candidate.name === toolCall.name)

    stream.push({
      type: 'tool_execution_start',
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      args: toolCall.arguments
    })

    let result
    let isError = false

    try {
      if (!tool) throw new Error(`Tool ${toolCall.name} not found`)
      const validatedArgs = validateToolArguments(tool, toolCall)
      result = await tool.execute(toolCall.id, validatedArgs, signal, (partialResult) => {
        stream.push({
          type: 'tool_execution_update',
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          args: toolCall.arguments,
          partialResult
        })
      })
    } catch (error) {
      result = {
        content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
        details: {}
      }
      isError = true
    }

    stream.push({
      type: 'tool_execution_end',
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      result,
      isError
    })

    const toolResultMessage: ToolResultMessage = {
      role: 'toolResult' as const,
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      content: result.content,
      details: result.details,
      isError,
      timestamp: Date.now()
    }

    results.push(toolResultMessage)
    stream.push({ type: 'message_start', message: toolResultMessage })
    stream.push({ type: 'message_end', message: toolResultMessage })

    if (getSteeringMessages) {
      const steering = await getSteeringMessages()
      if (steering.length > 0) {
        steeringMessages = steering
        const remainingCalls = toolCalls.slice(index + 1)
        for (const skipped of remainingCalls) {
          results.push(skipToolCall(skipped, stream))
        }
        break
      }
    }
  }

  return { toolResults: results, steeringMessages }
}

function skipToolCall(
  toolCall: Extract<AssistantAgentMessage['content'][number], { type: 'toolCall' }>,
  stream: EventStream<AgentEvent, AgentMessage[]>
): ToolResultMessage {
  const result = {
    content: [{ type: 'text' as const, text: 'Skipped due to queued user message.' }],
    details: {}
  }

  stream.push({
    type: 'tool_execution_start',
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    args: toolCall.arguments
  })

  stream.push({
    type: 'tool_execution_end',
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    result,
    isError: true
  })

  const toolResultMessage: ToolResultMessage = {
      role: 'toolResult' as const,
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    content: result.content,
    details: {},
    isError: true,
    timestamp: Date.now()
  }

  stream.push({ type: 'message_start', message: toolResultMessage })
  stream.push({ type: 'message_end', message: toolResultMessage })

  return toolResultMessage
}
