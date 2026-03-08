import type { ChatSessionStore } from '@pipiclaw/agent-core'
import type {
  ChatSessionLoadResult,
  ChatSessionSaveInput,
  ChatSessionSaveResult,
  ChatSessionState
} from '@pipiclaw/shared/rpc/chat'

type RuntimeWindow = Window &
  Partial<{
    api: {
      chat?: {
        loadSession: (input: { sessionId: string }) => Promise<ChatSessionLoadResult>
        saveSession: (input: ChatSessionSaveInput) => Promise<ChatSessionSaveResult>
      }
    }
  }>

function getRuntimeWindow(): RuntimeWindow | undefined {
  if (typeof window === 'undefined') return undefined
  return window as RuntimeWindow
}

export const ipcChatSessionStore: ChatSessionStore = {
  async load(sessionId: string): Promise<ChatSessionState | null> {
    const runtimeWindow = getRuntimeWindow()
    if (!runtimeWindow?.api?.chat?.loadSession) return null

    try {
      const result = await runtimeWindow.api.chat.loadSession({ sessionId })
      return result.snapshot?.state ?? null
    } catch (error) {
      console.error('Failed to load chat session:', error)
      return null
    }
  },

  async save(sessionId: string, state: ChatSessionState): Promise<void> {
    const runtimeWindow = getRuntimeWindow()
    if (!runtimeWindow?.api?.chat?.saveSession) return

    try {
      await runtimeWindow.api.chat.saveSession({
        sessionId,
        state
      })
    } catch (error) {
      console.error('Failed to save chat session:', error)
    }
  }
}
