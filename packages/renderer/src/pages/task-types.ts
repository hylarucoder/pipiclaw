export type TaskStatus = 'backlog' | 'todo' | 'doing' | 'in-review' | 'done' | 'canceled'
export type TaskPriority = 'P0' | 'P1' | 'P2'

export type TaskRecord = {
  id: string
  title: string
  summary: string
  status: TaskStatus
  priority: TaskPriority
  owner: string
  projectName: string
  tags: string[]
  updatedAt: string
  updatedAtLabel: string
  dueAt: string
  dueAtLabel: string
  estimateHours?: number
  blockedReason?: string
}

export function isTaskStatus(value: string): value is TaskStatus {
  return (
    value === 'backlog' ||
    value === 'todo' ||
    value === 'doing' ||
    value === 'in-review' ||
    value === 'done' ||
    value === 'canceled'
  )
}
