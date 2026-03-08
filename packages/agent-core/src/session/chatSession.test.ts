import { describe, expect, it, vi } from 'vitest'
import type { ChatSessionState } from '@pipiclaw/shared/rpc/chat'
import {
  buildChatSessionId,
  createPersistedChatSessionState,
  normalizeThinkingLevel
} from './chatSession'
import { createBufferedChatSessionPersistence } from './sessionPersistence'

describe('chat session helpers', () => {
  it('builds stable chat session ids', () => {
    expect(buildChatSessionId('openai', 'gpt-4.1')).toBe('chat:openai:gpt-4.1')
  })

  it('normalizes persisted agent state into a session snapshot', () => {
    const state = createPersistedChatSessionState({
      state: {
        systemPrompt: '',
        model: { provider: 'anthropic', id: 'claude-sonnet-4-20250514' },
        thinkingLevel: 'high',
        messages: [{ role: 'user', content: 'hello' }]
      }
    })

    expect(state.systemPrompt).toContain('PiPiClaw Draw Studio')
    expect(state.thinkingLevel).toBe('high')
    expect(state.messages).toEqual([{ role: 'user', content: 'hello' }])
  })

  it('falls back to off when thinking level is invalid', () => {
    expect(normalizeThinkingLevel('turbo')).toBe('off')
  })

  it('buffers and flushes session persistence', async () => {
    vi.useFakeTimers()

    const save = vi.fn<(sessionId: string, state: ChatSessionState) => Promise<void>>(
      async () => undefined
    )
    const persistence = createBufferedChatSessionPersistence({
      sessionStore: {
        load: async () => null,
        save
      },
      sessionId: 'chat:anthropic:claude',
      getState: () => ({
        systemPrompt: 'system',
        model: { provider: 'anthropic', id: 'claude' },
        thinkingLevel: 'off',
        messages: []
      }),
      delayMs: 200
    })

    persistence.schedulePersist()
    await vi.advanceTimersByTimeAsync(199)
    expect(save).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(1)

    await persistence.dispose()
    expect(save).toHaveBeenCalledTimes(2)

    vi.useRealTimers()
  })
})
