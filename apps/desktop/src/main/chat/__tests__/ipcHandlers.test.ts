import { describe, expect, it, vi } from 'vitest'
import { CHAT_STREAM_EVENT_CHANNEL, type ChatSessionSnapshot } from '@pipiclaw/shared/rpc/chat'
import { createChatIpcHandlers } from '../ipcHandlers'

function createSender() {
  return {
    send: vi.fn(),
    isDestroyed: vi.fn(() => false)
  }
}

function createSnapshot(sessionId: string): ChatSessionSnapshot {
  return {
    sessionId,
    state: {
      systemPrompt: 'system',
      model: { provider: 'glm', id: 'glm-4.6' },
      thinkingLevel: 'off',
      messages: []
    }
  }
}

async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('chat ipc handlers', () => {
  it('streams events and emits end event on success', async () => {
    const sender = createSender()
    const handlers = createChatIpcHandlers({
      streamSimple: async () => ({
        async *[Symbol.asyncIterator]() {
          yield { type: 'delta', text: 'hello' }
        }
      }),
      loadSession: vi.fn(),
      saveSession: vi.fn()
    })

    const result = await handlers.handleStartStream(
      { sender },
      {
        requestId: 'req-1',
        model: { provider: 'glm', id: 'glm-4.6' },
        context: { messages: [] }
      }
    )
    expect(result.ok).toBe(true)

    await flushMicrotasks()
    expect(sender.send).toHaveBeenNthCalledWith(
      1,
      CHAT_STREAM_EVENT_CHANNEL,
      expect.objectContaining({ requestId: 'req-1', kind: 'event' })
    )
    expect(sender.send).toHaveBeenNthCalledWith(
      2,
      CHAT_STREAM_EVENT_CHANNEL,
      expect.objectContaining({ requestId: 'req-1', kind: 'end' })
    )
  })

  it('emits error and end events when stream startup fails', async () => {
    const sender = createSender()
    const handlers = createChatIpcHandlers({
      streamSimple: vi.fn().mockRejectedValue(new Error('stream failed')),
      loadSession: vi.fn(),
      saveSession: vi.fn()
    })

    const result = await handlers.handleStartStream(
      { sender },
      {
        requestId: 'req-2',
        model: { provider: 'glm', id: 'glm-4.6' },
        context: { messages: [] }
      }
    )
    expect(result.ok).toBe(true)

    await flushMicrotasks()
    expect(sender.send).toHaveBeenNthCalledWith(
      1,
      CHAT_STREAM_EVENT_CHANNEL,
      expect.objectContaining({ requestId: 'req-2', kind: 'error', error: 'stream failed' })
    )
    expect(sender.send).toHaveBeenNthCalledWith(
      2,
      CHAT_STREAM_EVENT_CHANNEL,
      expect.objectContaining({ requestId: 'req-2', kind: 'end' })
    )
  })

  it('returns a typed error result when stream start input is invalid', async () => {
    const sender = createSender()
    const handlers = createChatIpcHandlers({
      streamSimple: vi.fn(),
      loadSession: vi.fn(),
      saveSession: vi.fn()
    })

    const result = await handlers.handleStartStream({ sender }, { requestId: '', model: {}, context: {} })
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(sender.send).not.toHaveBeenCalled()
  })

  it('aborts and removes active requests', async () => {
    const sender = createSender()
    const handlers = createChatIpcHandlers({
      streamSimple: async (_model, _context, options) => ({
        [Symbol.asyncIterator]() {
          return {
            next: async () => {
              await new Promise<void>((resolve) => {
                options.signal.addEventListener('abort', () => resolve(), { once: true })
              })
              return { done: true, value: undefined }
            }
          }
        }
      }),
      loadSession: vi.fn(),
      saveSession: vi.fn()
    })

    await handlers.handleStartStream(
      { sender },
      {
        requestId: 'req-abort',
        model: { provider: 'glm', id: 'glm-4.6' },
        context: { messages: [] }
      }
    )
    expect(handlers.getActiveRequestCount()).toBe(1)

    await handlers.handleAbortStream(null, { requestId: 'req-abort' })
    expect(handlers.getActiveRequestCount()).toBe(0)
  })

  it('loads and saves sessions through injected stores', async () => {
    const snapshot = createSnapshot('session-1')
    const loadSession = vi.fn().mockResolvedValue(snapshot)
    const saveSession = vi.fn().mockResolvedValue(undefined)
    const handlers = createChatIpcHandlers({
      streamSimple: vi.fn(),
      loadSession,
      saveSession
    })

    const loadResult = await handlers.handleLoadSession(null, { sessionId: 'session-1' })
    expect(loadSession).toHaveBeenCalledWith('session-1')
    expect(loadResult.snapshot).toEqual(snapshot)

    const saveResult = await handlers.handleSaveSession(null, snapshot)
    expect(saveSession).toHaveBeenCalledWith(snapshot)
    expect(saveResult).toEqual({ ok: true })
  })
})
