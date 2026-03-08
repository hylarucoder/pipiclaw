import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { selectTaskKanbanItems, useTaskKanbanStore } from '../taskKanbanStore'
import type { TaskRecord } from '@renderer/pages/task-types'

const PROJECT_ID = 'workspace-main'

const taskFixture: TaskRecord = {
  id: 'task-1',
  title: 'Task One',
  summary: 'Summary',
  status: 'todo',
  priority: 'P1',
  owner: 'Owner',
  projectName: 'Workspace',
  tags: ['Tag'],
  updatedAt: '2026-02-28T10:00:00.000Z',
  updatedAtLabel: 'today',
  dueAt: '2026-03-01',
  dueAtLabel: '3/1',
  estimateHours: 2
}

beforeEach(() => {
  useTaskKanbanStore.setState({ projects: {} })
})

afterEach(() => {
  useTaskKanbanStore.setState({ projects: {} })
})

describe('taskKanbanStore', () => {
  it('loads tasks and keeps status buckets', () => {
    const store = useTaskKanbanStore.getState()
    store.ensure(PROJECT_ID)
    store.applyLoaded(PROJECT_ID, [taskFixture, { ...taskFixture, id: 'task-2', status: 'done' }])

    const projectState = useTaskKanbanStore.getState().projects[PROJECT_ID]
    const items = selectTaskKanbanItems(PROJECT_ID)(useTaskKanbanStore.getState())

    expect(items).toHaveLength(2)
    expect(projectState?.orderByStatus.todo).toContain('task-1')
    expect(projectState?.orderByStatus.done).toContain('task-2')
  })

  it('moves tasks between statuses optimistically', () => {
    const store = useTaskKanbanStore.getState()
    store.ensure(PROJECT_ID)
    store.applyLoaded(PROJECT_ID, [taskFixture])

    store.moveToStatus(PROJECT_ID, 'task-1', 'doing')

    const projectState = useTaskKanbanStore.getState().projects[PROJECT_ID]
    expect(projectState?.byId['task-1']?.status).toBe('doing')
    expect(projectState?.orderByStatus.todo).toEqual([])
    expect(projectState?.orderByStatus.doing).toEqual(['task-1'])
  })
})
