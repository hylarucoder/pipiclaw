import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import type { ChatSessionSnapshot } from '@pipiclaw/shared/rpc/chat'
import {
  getChatSessionLogFilename,
  parseLatestChatSessionSnapshot,
  serializeChatSessionSnapshot
} from '@pipiclaw/agent-core'

const PIPICLAW_HOME_DIR = join(homedir(), '.pipiclaw')
const CHAT_SESSION_DIR = join(PIPICLAW_HOME_DIR, 'sessions')

export function getChatSessionStorePath(): string {
  return CHAT_SESSION_DIR
}

function getChatSessionFilePath(sessionId: string): string {
  return join(CHAT_SESSION_DIR, getChatSessionLogFilename(sessionId))
}

export async function loadChatSession(sessionId: string): Promise<ChatSessionSnapshot | null> {
  const sessionFile = getChatSessionFilePath(sessionId)
  try {
    const raw = await readFile(sessionFile, 'utf8')
    return parseLatestChatSessionSnapshot(raw)
  } catch {
    return null
  }
}

export async function saveChatSession(snapshot: ChatSessionSnapshot): Promise<void> {
  const sessionFile = getChatSessionFilePath(snapshot.sessionId)
  await mkdir(dirname(sessionFile), { recursive: true })
  await appendFile(sessionFile, serializeChatSessionSnapshot(snapshot), 'utf8')
}
