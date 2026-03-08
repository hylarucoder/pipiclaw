import { chatSessionSnapshotSchema, type ChatSessionSnapshot } from '@pipiclaw/shared/rpc/chat'

export function normalizeChatSessionId(sessionId: string): string {
  return sessionId.replace(/[^\w.-]/g, '_')
}

export function getChatSessionLogFilename(sessionId: string): string {
  return `${normalizeChatSessionId(sessionId)}.jsonl`
}

export function serializeChatSessionSnapshot(snapshot: ChatSessionSnapshot): string {
  const validated = chatSessionSnapshotSchema.parse(snapshot)
  return `${JSON.stringify(validated)}\n`
}

export function parseLatestChatSessionSnapshot(raw: string): ChatSessionSnapshot | null {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const parsed = JSON.parse(lines[index])
      const validated = chatSessionSnapshotSchema.safeParse(parsed)
      if (validated.success) {
        return validated.data
      }
    } catch {
      // Keep scanning previous jsonl entries until a valid snapshot is found.
    }
  }

  return null
}
