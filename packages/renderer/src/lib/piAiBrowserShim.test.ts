import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('piAiBrowserShim streamSimple', () => {
  beforeEach(() => {
    vi.resetModules()
    delete (globalThis as { window?: unknown }).window
  })

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  it('throws when IPC chat API is unavailable', async () => {
    const { streamSimple } = await import('./piAiBrowserShim')
    expect(() =>
      streamSimple(
        { api: 'anthropic-messages', provider: 'zhipuai', id: 'glm-4.6' } as never,
        { messages: [] } as never
      )
    ).toThrowError('Renderer chat runtime requires window.api.chat IPC transport')
  })

  it('uses IPC chat API and sanitizes non-serializable fields', async () => {
    const startStream = vi.fn().mockResolvedValue({ ok: true })
    const abortStream = vi.fn().mockResolvedValue(undefined)
    const unsubscribe = vi.fn()
    const onStreamEvent = vi.fn().mockImplementation(() => unsubscribe)
    ;(globalThis as { window?: unknown }).window = {
      api: {
        chat: { startStream, abortStream, onStreamEvent }
      }
    }

    const { streamSimple } = await import('./piAiBrowserShim')
    const abortController = new AbortController()
    streamSimple(
      { api: 'anthropic-messages', provider: 'zhipuai', id: 'glm-4.6' } as never,
      {
        messages: [],
        tools: [
          {
            name: 'search',
            description: 'Search docs',
            parameters: { type: 'object' },
            execute: async () => ({})
          }
        ]
      } as never,
      {
        signal: abortController.signal,
        onPayload: () => undefined
      } as never
    )

    await Promise.resolve()
    expect(startStream).toHaveBeenCalledTimes(1)
    const payload = startStream.mock.calls[0][0] as {
      context: { tools: Array<Record<string, unknown>> }
      options: Record<string, unknown>
    }

    expect(payload.context.tools[0]).toEqual({
      name: 'search',
      description: 'Search docs',
      parameters: { type: 'object' }
    })
    expect(payload.options).not.toHaveProperty('signal')
    expect(payload.options).not.toHaveProperty('onPayload')
    abortController.abort()
    await Promise.resolve()
    expect(abortStream).toHaveBeenCalledTimes(1)
    expect(unsubscribe).not.toHaveBeenCalled()
  })
})
