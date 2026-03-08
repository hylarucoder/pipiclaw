import {
  CHAT_STREAM_EVENT_CHANNEL,
  chatSessionLoadInputSchema,
  chatSessionLoadResultSchema,
  chatSessionSaveInputSchema,
  chatSessionSaveResultSchema,
  chatStreamAbortInputSchema,
  chatStreamStartInputSchema,
  chatStreamStartResultSchema,
  type ChatSessionSnapshot,
  type ChatStreamEventPayload
} from '@pipiclaw/shared/rpc/chat'

type StreamSimpleFn = (
  model: unknown,
  context: unknown,
  options: { signal: AbortSignal } & Record<string, unknown>
) => Promise<AsyncIterable<unknown>> | AsyncIterable<unknown>

export type ChatStreamEventSender = {
  send(channel: string, payload: unknown): void
  isDestroyed(): boolean
}

export interface ChatIpcHandlersDeps {
  streamSimple: StreamSimpleFn
  loadSession: (sessionId: string) => Promise<ChatSessionSnapshot | null>
  saveSession: (snapshot: ChatSessionSnapshot) => Promise<void>
}

export interface ChatIpcHandlers {
  handleStartStream: (
    event: { sender: ChatStreamEventSender },
    rawInput: unknown
  ) => Promise<{ ok: boolean; error?: string }>
  handleAbortStream: (_event: unknown, rawInput: unknown) => Promise<void>
  handleLoadSession: (
    _event: unknown,
    rawInput: unknown
  ) => Promise<{ snapshot: ChatSessionSnapshot | null; error?: string }>
  handleSaveSession: (_event: unknown, rawInput: unknown) => Promise<{ ok: boolean; error?: string }>
  abortAllStreams: () => void
  getActiveRequestCount: () => number
}

export function createChatIpcHandlers(deps: ChatIpcHandlersDeps): ChatIpcHandlers {
  const chatAbortControllers = new Map<string, AbortController>()

  const sendChatStreamEvent = (
    sender: ChatStreamEventSender,
    payload: ChatStreamEventPayload
  ): void => {
    if (!sender.isDestroyed()) {
      sender.send(CHAT_STREAM_EVENT_CHANNEL, payload)
    }
  }

  const handleStartStream = async (
    event: { sender: ChatStreamEventSender },
    rawInput: unknown
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const input = chatStreamStartInputSchema.parse(rawInput)
      const sender = event.sender
      const previousController = chatAbortControllers.get(input.requestId)
      if (previousController) {
        previousController.abort()
      }

      const abortController = new AbortController()
      chatAbortControllers.set(input.requestId, abortController)

      const options =
        input.options && typeof input.options === 'object'
          ? { ...(input.options as Record<string, unknown>) }
          : {}
      delete (options as { signal?: unknown }).signal

      void (async () => {
        try {
          const response = await deps.streamSimple(input.model, input.context, {
            ...(options as Record<string, unknown>),
            signal: abortController.signal
          })

          for await (const streamEvent of response) {
            sendChatStreamEvent(
              sender,
              {
                requestId: input.requestId,
                kind: 'event',
                event: streamEvent
              } satisfies ChatStreamEventPayload
            )
          }

          sendChatStreamEvent(
            sender,
            {
              requestId: input.requestId,
              kind: 'end'
            } satisfies ChatStreamEventPayload
          )
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Chat stream failed'
          sendChatStreamEvent(
            sender,
            {
              requestId: input.requestId,
              kind: 'error',
              error: message
            } satisfies ChatStreamEventPayload
          )
          sendChatStreamEvent(
            sender,
            {
              requestId: input.requestId,
              kind: 'end'
            } satisfies ChatStreamEventPayload
          )
        } finally {
          const activeController = chatAbortControllers.get(input.requestId)
          if (activeController === abortController) {
            chatAbortControllers.delete(input.requestId)
          }
        }
      })()

      return chatStreamStartResultSchema.parse({ ok: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start chat stream'
      return chatStreamStartResultSchema.parse({
        ok: false,
        error: message
      })
    }
  }

  const handleAbortStream = async (_event: unknown, rawInput: unknown): Promise<void> => {
    const input = chatStreamAbortInputSchema.parse(rawInput)
    const controller = chatAbortControllers.get(input.requestId)
    if (controller) {
      controller.abort()
      chatAbortControllers.delete(input.requestId)
    }
  }

  const handleLoadSession = async (
    _event: unknown,
    rawInput: unknown
  ): Promise<{ snapshot: ChatSessionSnapshot | null; error?: string }> => {
    try {
      const input = chatSessionLoadInputSchema.parse(rawInput)
      const snapshot = await deps.loadSession(input.sessionId)
      return chatSessionLoadResultSchema.parse({
        snapshot
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load chat session'
      return chatSessionLoadResultSchema.parse({
        snapshot: null,
        error: message
      })
    }
  }

  const handleSaveSession = async (
    _event: unknown,
    rawInput: unknown
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const input = chatSessionSaveInputSchema.parse(rawInput)
      await deps.saveSession(input)
      return chatSessionSaveResultSchema.parse({ ok: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save chat session'
      return chatSessionSaveResultSchema.parse({
        ok: false,
        error: message
      })
    }
  }

  const abortAllStreams = (): void => {
    for (const controller of chatAbortControllers.values()) {
      controller.abort()
    }
    chatAbortControllers.clear()
  }

  return {
    handleStartStream,
    handleAbortStream,
    handleLoadSession,
    handleSaveSession,
    abortAllStreams,
    getActiveRequestCount: () => chatAbortControllers.size
  }
}
