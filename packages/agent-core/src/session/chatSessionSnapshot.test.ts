import { describe, expect, it } from 'vitest'
import type { ChatSessionSnapshot } from '@pipiclaw/shared/rpc/chat'
import {
  getChatSessionLogFilename,
  normalizeChatSessionId,
  parseLatestChatSessionSnapshot,
  serializeChatSessionSnapshot
} from './chatSessionSnapshot'

function createSnapshot(sessionId: string, messageText: string): ChatSessionSnapshot {
  return {
    sessionId,
    state: {
      systemPrompt: 'You are helpful.',
      model: { provider: 'glm', id: 'glm-4.6' },
      thinkingLevel: 'minimal',
      messages: [{ role: 'user', content: [{ type: 'text', text: messageText }] }]
    }
  }
}

describe('chatSessionSnapshot helpers', () => {
  it('normalizes session ids into filesystem-safe names', () => {
    expect(normalizeChatSessionId('chat/main?1')).toBe('chat_main_1')
    expect(getChatSessionLogFilename('chat/main?1')).toBe('chat_main_1.jsonl')
  })

  it('serializes validated snapshots as jsonl lines', () => {
    const serialized = serializeChatSessionSnapshot(createSnapshot('session-a', 'hello'))
    expect(serialized.endsWith('\n')).toBe(true)
    expect(JSON.parse(serialized.trim())).toMatchObject({
      sessionId: 'session-a'
    })
  })

  it('parses the latest valid snapshot from jsonl content', () => {
    const oldSnapshot = createSnapshot('session-a', 'old message')
    const latestSnapshot = createSnapshot('session-a', 'latest message')
    const raw =
      `${JSON.stringify(oldSnapshot)}\n` +
      `this is not json\n` +
      `${JSON.stringify({ invalid: true })}\n` +
      `${JSON.stringify(latestSnapshot)}\n`

    expect(parseLatestChatSessionSnapshot(raw)).toEqual(latestSnapshot)
  })

  it('returns null when there is no valid snapshot in the log', () => {
    expect(parseLatestChatSessionSnapshot('invalid\n{}\n')).toBeNull()
  })
})
