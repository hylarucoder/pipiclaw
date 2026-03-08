import type { ChatSessionSnapshot } from '@pipiclaw/shared/rpc/chat'

export interface ChatSessionSnapshotStore {
  load(sessionId: string): Promise<ChatSessionSnapshot | null>
  save(snapshot: ChatSessionSnapshot): Promise<void>
}
