import type { ChatSessionState } from '@pipiclaw/shared/rpc/chat'
import type { ChatSessionStore } from '../ports/chatSessionStore'

export type BufferedChatSessionPersistenceOptions = {
  sessionStore: ChatSessionStore
  sessionId: string
  getState: () => ChatSessionState | null
  delayMs?: number
}

export type BufferedChatSessionPersistence = {
  schedulePersist: () => void
  flushPersist: () => Promise<void>
  dispose: () => Promise<void>
}

export function createBufferedChatSessionPersistence(
  options: BufferedChatSessionPersistenceOptions
): BufferedChatSessionPersistence {
  let disposed = false
  let persistTimer: ReturnType<typeof setTimeout> | null = null

  const persistNow = async (): Promise<void> => {
    const state = options.getState()
    if (!state) return
    await options.sessionStore.save(options.sessionId, state)
  }

  const flushPersist = async (): Promise<void> => {
    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    if (disposed) return
    await persistNow()
  }

  const schedulePersist = (): void => {
    if (disposed) return
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      void flushPersist()
    }, options.delayMs ?? 200)
  }

  const dispose = async (): Promise<void> => {
    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    if (disposed) return
    await persistNow()
    disposed = true
  }

  return {
    schedulePersist,
    flushPersist,
    dispose
  }
}
