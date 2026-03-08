import type { ChatSessionState } from '@pipiclaw/shared/rpc/chat'

export interface ChatSessionStore {
  load(sessionId: string): Promise<ChatSessionState | null>
  save(sessionId: string, state: ChatSessionState): Promise<void>
}
