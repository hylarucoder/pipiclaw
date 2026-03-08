import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createChatStreamClient,
  sanitizeChatContextForTransport,
  sanitizeChatOptionsForTransport
} from './chatStreamClient'

describe('chatStreamClient', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sanitizes non-serializable context tools', () => {
    const context = sanitizeChatContextForTransport({
      messages: [],
      tools: [
        {
          name: 'search',
          description: 'Search docs',
          parameters: { type: 'object' },
          execute: async () => ({})
        }
      ]
    } as never)

    expect(context.tools?.[0]).toEqual({
      name: 'search',
      description: 'Search docs',
      parameters: { type: 'object' }
    })
  })

  it('drops signal and onPayload from serialized options', () => {
    const abortController = new AbortController()
    const options = sanitizeChatOptionsForTransport({
      signal: abortController.signal,
      onPayload: () => undefined,
      maxTokens: 123
    } as never)

    expect(options).toEqual({ maxTokens: 123 })
  })

  it('starts stream through transport and aborts with request id', async () => {
    const startStream = vi.fn().mockResolvedValue({ ok: true })
    const abortStream = vi.fn().mockResolvedValue(undefined)
    const onStreamEvent = vi.fn().mockImplementation(() => vi.fn())
    const abortController = new AbortController()

    createChatStreamClient(
      {
        startStream,
        abortStream,
        onStreamEvent
      },
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
      requestId: string
    }

    expect(typeof payload.requestId).toBe('string')
    expect(payload.requestId.length).toBeGreaterThan(0)
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
    expect(abortStream.mock.calls[0][0]).toEqual({ requestId: payload.requestId })
  })
})
