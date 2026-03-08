import type {
  ChatStreamEventPayload,
  ChatStreamStartInput,
  ChatStreamStartResult
} from '@pipiclaw/shared/rpc/chat'

export interface ChatStreamTransport {
  startStream(input: ChatStreamStartInput): Promise<ChatStreamStartResult>
  abortStream(input: { requestId: string }): Promise<void>
  onStreamEvent(listener: (payload: ChatStreamEventPayload) => void): () => void
}
