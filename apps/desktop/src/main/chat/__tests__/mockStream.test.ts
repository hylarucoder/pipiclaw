import { describe, expect, it } from 'vitest'
import { createMockAssistantStream } from '../mockStream'

describe('createMockAssistantStream', () => {
  it('yields a done event with assistant message containing latest user text', async () => {
    const stream = createMockAssistantStream(
      {
        api: 'anthropic-messages',
        provider: 'zhipuai',
        id: 'glm-4.7'
      },
      {
        messages: [
          { role: 'user', content: 'first' },
          { role: 'assistant', content: [{ type: 'text', text: 'ignored' }] },
          { role: 'user', content: [{ type: 'text', text: 'latest user input' }] }
        ]
      }
    )

    const events: Array<{
      type: string
      reason: string
      message: {
        role: string
        provider: string
        model: string
        content: Array<{ type: string; text: string }>
      }
    }> = []
    for await (const event of stream) {
      events.push(event)
    }

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'done',
      reason: 'stop',
      message: {
        role: 'assistant',
        provider: 'zhipuai',
        model: 'glm-4.7',
        content: [{ type: 'text', text: 'Mock response: latest user input' }]
      }
    })
  })
})
