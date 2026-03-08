import type { TaskRecord, TaskStatus } from '@renderer/pages/task-types'
import {
  createKanbanStore,
  type KanbanProjectState as BaseKanbanProjectState,
  type KanbanStoreState as BaseKanbanStoreState
} from './createKanbanStore'

const TASK_STATUSES: readonly TaskStatus[] = [
  'backlog',
  'todo',
  'doing',
  'in-review',
  'done',
  'canceled'
] as const

export const TASK_KANBAN_SCOPE_ID = 'workspace-main'

const kanbanStore = createKanbanStore<TaskRecord, TaskStatus>({
  statuses: TASK_STATUSES,
  getStatus: (task) => task.status,
  setStatus: (task, status) => {
    task.status = status
  }
})

export const useTaskKanbanStore = kanbanStore.useStore
export const defaultTaskKanbanState = kanbanStore.defaultProjectState
export const EMPTY_TASKS = kanbanStore.EMPTY_ITEMS
export const selectTaskKanbanItems = kanbanStore.selectItems
export const selectTaskKanbanLoading = kanbanStore.selectLoading
export const selectTaskKanbanActiveId = kanbanStore.selectActiveId

export type TaskKanbanProjectState = BaseKanbanProjectState<TaskRecord, TaskStatus>
export type TaskKanbanStoreState = BaseKanbanStoreState<TaskRecord, TaskStatus>
