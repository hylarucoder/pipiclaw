import type { TaskStatus } from './task-types'

const NOTES_TASK_ID_PREFIX = 'notes-task:'
const FRONTMATTER_SEPARATOR = '---'
const STATUS_FIELD_PATTERN = /^\s*(status|state)\s*:/i

function detectEol(content: string): '\n' | '\r\n' {
  return content.includes('\r\n') ? '\r\n' : '\n'
}

function splitMarkdownLines(content: string): { lines: string[]; hasTrailingEol: boolean } {
  const hasTrailingEol = /\r?\n$/.test(content)
  const contentWithoutTrailingEol = hasTrailingEol ? content.replace(/\r?\n$/, '') : content
  return {
    lines:
      contentWithoutTrailingEol.length > 0 ? contentWithoutTrailingEol.split(/\r?\n/) : [],
    hasTrailingEol
  }
}

function joinMarkdownLines(lines: string[], eol: '\n' | '\r\n', hasTrailingEol: boolean): string {
  const base = lines.join(eol)
  if (!hasTrailingEol) return base
  return `${base}${eol}`
}

export function parseNotesTaskRelativePath(taskId: string): string | null {
  if (!taskId.startsWith(NOTES_TASK_ID_PREFIX)) return null
  const relativePath = taskId.slice(NOTES_TASK_ID_PREFIX.length).trim()
  if (!relativePath) return null
  return relativePath
}

export function updateTaskStatusInMarkdown(content: string, status: TaskStatus): string {
  const eol = detectEol(content)
  const { lines, hasTrailingEol } = splitMarkdownLines(content)

  const hasFrontmatter = lines[0]?.trim() === FRONTMATTER_SEPARATOR
  const frontmatterEndIndex = hasFrontmatter
    ? lines.findIndex((line, index) => index > 0 && line.trim() === FRONTMATTER_SEPARATOR)
    : -1

  if (!hasFrontmatter || frontmatterEndIndex <= 0) {
    const nextLines = [FRONTMATTER_SEPARATOR, `status: ${status}`, FRONTMATTER_SEPARATOR]
    if (lines.length > 0) {
      nextLines.push('', ...lines)
    }
    return joinMarkdownLines(nextLines, eol, hasTrailingEol)
  }

  const frontmatterLines = lines.slice(1, frontmatterEndIndex)
  const bodyLines = lines.slice(frontmatterEndIndex + 1)

  const nextFrontmatterLines: string[] = []
  let replacedStatusField = false

  for (const line of frontmatterLines) {
    if (!STATUS_FIELD_PATTERN.test(line)) {
      nextFrontmatterLines.push(line)
      continue
    }
    if (!replacedStatusField) {
      nextFrontmatterLines.push(`status: ${status}`)
      replacedStatusField = true
    }
  }

  if (!replacedStatusField) {
    nextFrontmatterLines.push(`status: ${status}`)
  }

  const nextLines = [
    FRONTMATTER_SEPARATOR,
    ...nextFrontmatterLines,
    FRONTMATTER_SEPARATOR,
    ...bodyLines
  ]
  return joinMarkdownLines(nextLines, eol, hasTrailingEol)
}
