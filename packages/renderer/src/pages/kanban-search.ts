import { isTaskStatus, type TaskPriority, type TaskRecord, type TaskStatus } from './task-types'
import type { NotesFileItem } from '@pipiclaw/shared/rpc/notes'

export type TaskSearchFilters = {
  projectName: string
  keyword: string
}

export const NOTES_PROJECTS_ROOT_DIR = '001-Project'
export const NOTES_KANBAN_TASKS_GLOB = '001-Project/*/task/*.md'

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

function parseFrontmatter(content: string): { metadata: Record<string, string>; body: string } {
  const lines = content.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') {
    return { metadata: {}, body: content }
  }

  let endIndex = -1
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.trim() === '---') {
      endIndex = index
      break
    }
  }

  if (endIndex <= 0) {
    return { metadata: {}, body: content }
  }

  const metadata: Record<string, string> = {}
  for (const line of lines.slice(1, endIndex)) {
    const separatorIndex = line.indexOf(':')
    if (separatorIndex <= 0) continue
    const key = line.slice(0, separatorIndex).trim()
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '')
    if (!key || !value) continue
    metadata[key] = value
  }

  return {
    metadata,
    body: lines.slice(endIndex + 1).join('\n')
  }
}

function pickFirstField(metadata: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = metadata[key]
    if (value && value.trim().length > 0) return value.trim()
  }
  return undefined
}

function normalizeStatus(value: string | undefined): TaskStatus {
  const normalized = normalize(value ?? '')
  if (normalized === 'in_review' || normalized === 'review') return 'in-review'
  if (normalized === 'cancelled') return 'canceled'
  if (normalized === 'active') return 'doing'
  if (isTaskStatus(normalized)) return normalized
  return 'todo'
}

function normalizePriority(value: string | undefined): TaskPriority {
  const normalized = (value ?? '').trim().toUpperCase()
  if (normalized === 'P0' || normalized === 'P1' || normalized === 'P2') {
    return normalized
  }
  return 'P2'
}

function normalizeTags(value: string | undefined): string[] {
  if (!value) return []
  const raw = value.trim()
  if (!raw) return []
  const payload = raw.startsWith('[') && raw.endsWith(']') ? raw.slice(1, -1) : raw
  return payload
    .split(/[，,]/)
    .map((tag) => tag.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
}

function buildFallbackTitle(name: string): string {
  return name.replace(/\.md$/i, '').replace(/[-_]+/g, ' ').trim() || '未命名任务'
}

function extractSummary(body: string): string {
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const cleaned = trimmed.replace(/^[-*]\s+/, '')
    if (!cleaned) continue
    return cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned
  }
  return '暂无描述'
}

function normalizeDueDate(value: string | undefined, fallbackIso: string): string {
  const normalized = (value ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized
  const timestamp = Date.parse(normalized)
  if (!Number.isNaN(timestamp)) return new Date(timestamp).toISOString().slice(0, 10)
  return fallbackIso.slice(0, 10)
}

function formatDateLabel(dateText: string): string {
  const parsed = new Date(dateText)
  if (Number.isNaN(parsed.getTime())) return dateText
  return `${parsed.getMonth() + 1} 月 ${parsed.getDate()} 日`
}

function formatDateTimeLabel(dateTime: string): string {
  const parsed = new Date(dateTime)
  if (Number.isNaN(parsed.getTime())) return dateTime
  const hours = `${parsed.getHours()}`.padStart(2, '0')
  const minutes = `${parsed.getMinutes()}`.padStart(2, '0')
  return `${parsed.getMonth() + 1}/${parsed.getDate()} ${hours}:${minutes}`
}

export function filterTasksByProjectAndKeyword(
  tasks: TaskRecord[],
  filters: TaskSearchFilters
): TaskRecord[] {
  const projectName = normalize(filters.projectName)
  const keyword = normalize(filters.keyword)

  return tasks.filter((task) => {
    if (projectName && projectName !== 'all' && normalize(task.projectName) !== projectName) {
      return false
    }

    if (!keyword) return true

    const haystack = [task.title, task.summary, task.owner, task.projectName, ...task.tags]
      .join(' ')
      .toLowerCase()

    return haystack.includes(keyword)
  })
}

export function extractProjectNamesFromNotesFiles(files: NotesFileItem[]): string[] {
  const projects = new Set<string>()

  for (const file of files) {
    const normalizedPath = normalizePath(file.relativePath)
    const segments = normalizedPath.split('/').filter(Boolean)
    if (segments.length < 3) continue
    if (segments[0] !== NOTES_PROJECTS_ROOT_DIR) continue
    if (segments[1] === 'tasks') continue
    projects.add(segments[1])
  }

  return [...projects].sort((left, right) => left.localeCompare(right, 'zh-CN'))
}

export function extractKanbanTaskFilesFromNotesFiles(files: NotesFileItem[]): NotesFileItem[] {
  return files
    .filter((file) => {
      const normalizedPath = normalizePath(file.relativePath)
      const segments = normalizedPath.split('/').filter(Boolean)
      return (
        segments.length === 4 &&
        segments[0] === NOTES_PROJECTS_ROOT_DIR &&
        segments[2] === 'task' &&
        file.extension.toLowerCase() === 'md'
      )
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export function buildTaskRecordFromNotesTaskFile(file: NotesFileItem, content: string): TaskRecord {
  const normalizedPath = normalizePath(file.relativePath)
  const segments = normalizedPath.split('/').filter(Boolean)
  const projectName = segments[1] ?? '未分类项目'
  const { metadata, body } = parseFrontmatter(content)
  const dueAt = normalizeDueDate(
    pickFirstField(metadata, ['dueAt', 'due', 'deadline', 'due_date']),
    file.updatedAt
  )
  const estimateRaw = pickFirstField(metadata, ['estimateHours', 'estimate', 'estimation'])
  const estimateHours = estimateRaw ? Number(estimateRaw) : Number.NaN
  const blockedReason = pickFirstField(metadata, ['blockedReason', 'blocker'])
  const title = pickFirstField(metadata, ['title', 'name']) ?? buildFallbackTitle(file.name)

  return {
    id: `notes-task:${normalizedPath}`,
    title,
    summary: pickFirstField(metadata, ['summary', 'description']) ?? extractSummary(body),
    status: normalizeStatus(pickFirstField(metadata, ['status', 'state'])),
    priority: normalizePriority(pickFirstField(metadata, ['priority'])),
    owner: pickFirstField(metadata, ['owner', 'assignee']) ?? '未分配',
    projectName,
    tags: normalizeTags(pickFirstField(metadata, ['tags', 'tag'])),
    updatedAt: file.updatedAt,
    updatedAtLabel: formatDateTimeLabel(file.updatedAt),
    dueAt,
    dueAtLabel: formatDateLabel(dueAt),
    estimateHours: Number.isFinite(estimateHours) ? estimateHours : undefined,
    blockedReason
  }
}
