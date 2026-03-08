import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatSessionSnapshot } from '@pipiclaw/shared/rpc/chat'

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

describe('sessionStore', () => {
  let homeDir = ''

  beforeEach(async () => {
    homeDir = await mkdtemp(join(tmpdir(), 'pipiclaw-session-store-'))
    vi.resetModules()
    vi.doMock('node:os', () => ({
      homedir: () => homeDir
    }))
  })

  afterEach(async () => {
    vi.doUnmock('node:os')
    vi.resetModules()
    if (homeDir) {
      await rm(homeDir, { recursive: true, force: true })
    }
  })

  it('returns configured chat sessions directory', async () => {
    const { getChatSessionStorePath } = await import('../sessionStore')
    expect(getChatSessionStorePath()).toBe(join(homeDir, '.pipiclaw', 'sessions'))
  })

  it('saves snapshots in jsonl format and sanitizes session id', async () => {
    const { saveChatSession } = await import('../sessionStore')
    await saveChatSession(createSnapshot('chat/main?1', 'first'))
    await saveChatSession(createSnapshot('chat/main?1', 'second'))

    const sessionFile = join(homeDir, '.pipiclaw', 'sessions', 'chat_main_1.jsonl')
    const saved = await readFile(sessionFile, 'utf8')
    const lines = saved
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[1])).toMatchObject({
      sessionId: 'chat/main?1',
      state: { messages: [{ content: [{ text: 'second' }] }] }
    })
  })

  it('loads the latest valid snapshot from a jsonl file', async () => {
    const { loadChatSession } = await import('../sessionStore')
    const sessionFile = join(homeDir, '.pipiclaw', 'sessions', 'session-a.jsonl')
    await mkdir(join(homeDir, '.pipiclaw', 'sessions'), { recursive: true })

    const oldSnapshot = createSnapshot('session-a', 'old message')
    const latestSnapshot = createSnapshot('session-a', 'latest message')
    await writeFile(
      sessionFile,
      `${JSON.stringify(oldSnapshot)}\n` +
        `this is not json\n` +
        `${JSON.stringify({ invalid: true })}\n` +
        `${JSON.stringify(latestSnapshot)}\n`,
      'utf8'
    )

    const loaded = await loadChatSession('session-a')
    expect(loaded).toEqual(latestSnapshot)
  })

  it('returns null when session file is missing', async () => {
    const { loadChatSession } = await import('../sessionStore')
    const loaded = await loadChatSession('missing')
    expect(loaded).toBeNull()
  })
})
