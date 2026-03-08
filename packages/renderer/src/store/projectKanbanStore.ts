import type { ProjectRecord, ProjectStatus } from '@renderer/pages/project-types'
import {
  createKanbanStore,
  type KanbanProjectState as BaseKanbanProjectState,
  type KanbanStoreState as BaseKanbanStoreState
} from './createKanbanStore'

const PROJECT_STATUSES: readonly ProjectStatus[] = ['active', 'blocked', 'done'] as const
export const PROJECT_KANBAN_SCOPE_ID = 'workspace-main'

const kanbanStore = createKanbanStore<ProjectRecord, ProjectStatus>({
  statuses: PROJECT_STATUSES,
  getStatus: (project) => project.status,
  setStatus: (project, status) => {
    project.status = status
  }
})

export const useProjectKanbanStore = kanbanStore.useStore
export const defaultProjectKanbanState = kanbanStore.defaultProjectState
export const EMPTY_PROJECTS = kanbanStore.EMPTY_ITEMS
export const selectProjectKanbanItems = kanbanStore.selectItems
export const selectProjectKanbanLoading = kanbanStore.selectLoading
export const selectProjectKanbanActiveId = kanbanStore.selectActiveId

export type ProjectKanbanProjectState = BaseKanbanProjectState<ProjectRecord, ProjectStatus>
export type ProjectKanbanStoreState = BaseKanbanStoreState<ProjectRecord, ProjectStatus>
