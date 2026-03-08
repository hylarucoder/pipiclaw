import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { selectProjectKanbanItems, useProjectKanbanStore } from '../projectKanbanStore'
import type { ProjectRecord } from '@renderer/pages/project-types'

const PROJECT_ID = 'workspace-main'

const projectFixture: ProjectRecord = {
  id: 'project-1',
  name: 'Project One',
  summary: 'Summary',
  status: 'active',
  risk: 'low',
  progress: 10,
  weeklyGoal: 'Goal',
  owner: 'Owner',
  tags: ['Tag'],
  updatedAt: '2026-02-28T10:00:00.000Z',
  updatedAtLabel: 'today',
  dueAt: '2026-03-01',
  dueAtLabel: '3/1',
  milestones: [{ label: 'm1', done: false }],
  nextActions: ['n1']
}

beforeEach(() => {
  useProjectKanbanStore.setState({ projects: {} })
})

afterEach(() => {
  useProjectKanbanStore.setState({ projects: {} })
})

describe('projectKanbanStore', () => {
  it('loads projects and keeps status buckets', () => {
    const store = useProjectKanbanStore.getState()
    store.ensure(PROJECT_ID)
    store.applyLoaded(PROJECT_ID, [projectFixture, { ...projectFixture, id: 'project-2', status: 'done' }])

    const projectState = useProjectKanbanStore.getState().projects[PROJECT_ID]
    const items = selectProjectKanbanItems(PROJECT_ID)(useProjectKanbanStore.getState())

    expect(items).toHaveLength(2)
    expect(projectState?.orderByStatus.active).toContain('project-1')
    expect(projectState?.orderByStatus.done).toContain('project-2')
  })

  it('moves projects between statuses optimistically', () => {
    const store = useProjectKanbanStore.getState()
    store.ensure(PROJECT_ID)
    store.applyLoaded(PROJECT_ID, [projectFixture])

    store.moveToStatus(PROJECT_ID, 'project-1', 'blocked')

    const projectState = useProjectKanbanStore.getState().projects[PROJECT_ID]
    expect(projectState?.byId['project-1']?.status).toBe('blocked')
    expect(projectState?.orderByStatus.active).toEqual([])
    expect(projectState?.orderByStatus.blocked).toEqual(['project-1'])
  })
})
