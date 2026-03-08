import { describe, expect, it } from 'vitest'
import {
  chatSessionLoadInputSchema,
  chatSessionSnapshotSchema,
  chatStreamAbortInputSchema,
  chatStreamEventPayloadSchema,
  chatStreamStartInputSchema
} from './chat'

describe('chat rpc schemas', () => {
  it('accepts valid stream start and abort payloads', () => {
    const start = chatStreamStartInputSchema.parse({
      requestId: 'req-1',
      model: { provider: 'glm', id: 'glm-4.6' },
      context: { messages: [] }
    })
    const abort = chatStreamAbortInputSchema.parse({
      requestId: 'req-1'
    })

    expect(start.requestId).toBe('req-1')
    expect(abort.requestId).toBe('req-1')
  })

  it('requires event payload when kind is event', () => {
    const parsed = chatStreamEventPayloadSchema.safeParse({
      requestId: 'req-1',
      kind: 'event'
    })

    expect(parsed.success).toBe(false)
  })

  it('requires error message when kind is error', () => {
    const parsed = chatStreamEventPayloadSchema.safeParse({
      requestId: 'req-1',
      kind: 'error'
    })

    expect(parsed.success).toBe(false)
  })

  it('rejects invalid session snapshot and load payloads', () => {
    const snapshot = chatSessionSnapshotSchema.safeParse({
      sessionId: '',
      state: {
        systemPrompt: 'x',
        model: {},
        thinkingLevel: 'minimal',
        messages: []
      }
    })
    const loadInput = chatSessionLoadInputSchema.safeParse({
      sessionId: ''
    })

    expect(snapshot.success).toBe(false)
    expect(loadInput.success).toBe(false)
  })
})
