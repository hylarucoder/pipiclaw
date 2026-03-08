import { describe, expect, it } from 'vitest'
import {
  buildTaskRecordFromNotesTaskFile,
  extractKanbanTaskFilesFromNotesFiles,
  extractProjectNamesFromNotesFiles,
  filterTasksByProjectAndKeyword
} from './kanban-search'
import type { TaskRecord } from './task-types'
import type { NotesFileItem } from '@pipiclaw/shared/rpc/notes'

const baseTask: TaskRecord = {
  id: 'task-1',
  title: '实现聊天持久化',
  summary: '把会话写入 jsonl',
  status: 'todo',
  priority: 'P1',
  owner: 'Lucas',
  projectName: 'PiPiClaw',
  tags: ['chat', 'session'],
  updatedAt: '2026-02-28T10:00:00.000Z',
  updatedAtLabel: '今天',
  dueAt: '2026-03-01',
  dueAtLabel: '3/1',
  estimateHours: 4
}

describe('filterTasksByProjectAndKeyword', () => {
  it('filters tasks by selected project', () => {
    const tasks: TaskRecord[] = [
      baseTask,
      { ...baseTask, id: 'task-2', projectName: 'SDK', title: '修复模型路由' }
    ]

    const filtered = filterTasksByProjectAndKeyword(tasks, {
      projectName: 'PiPiClaw',
      keyword: ''
    })

    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('task-1')
  })

  it('filters tasks by keyword against title summary owner and tags', () => {
    const tasks: TaskRecord[] = [
      baseTask,
      { ...baseTask, id: 'task-2', title: '优化 Kanban', summary: '增加项目过滤', tags: ['kanban'] }
    ]

    expect(
      filterTasksByProjectAndKeyword(tasks, {
        projectName: 'all',
        keyword: 'session'
      }).map((task) => task.id)
    ).toEqual(['task-1'])

    expect(
      filterTasksByProjectAndKeyword(tasks, {
        projectName: 'all',
        keyword: 'lucas'
      }).map((task) => task.id)
    ).toEqual(['task-1', 'task-2'])
  })
})

describe('extractProjectNamesFromNotesFiles', () => {
  it('extracts unique project names under 001-Project directory', () => {
    const files: NotesFileItem[] = [
      {
        name: 'README.md',
        relativePath: '001-Project/PiPiClaw/README.md',
        extension: 'md',
        size: 128,
        updatedAt: '2026-02-28T10:00:00.000Z'
      },
      {
        name: 'spec.md',
        relativePath: '001-Project/PiPiClaw/spec.md',
        extension: 'md',
        size: 256,
        updatedAt: '2026-02-28T10:00:00.000Z'
      },
      {
        name: 'plan.md',
        relativePath: '001-Project\\SDK\\plan.md',
        extension: 'md',
        size: 512,
        updatedAt: '2026-02-28T10:00:00.000Z'
      },
      {
        name: 'todo.md',
        relativePath: '001-Project/tasks/todo.md',
        extension: 'md',
        size: 64,
        updatedAt: '2026-02-28T10:00:00.000Z'
      }
    ]

    expect(extractProjectNamesFromNotesFiles(files)).toEqual(['PiPiClaw', 'SDK'])
  })
})

describe('extractKanbanTaskFilesFromNotesFiles', () => {
  it('only keeps files matching 001-Project/*/task/*.md', () => {
    const files: NotesFileItem[] = [
      {
        name: 'task-1.md',
        relativePath: '001-Project/PiPiClaw/task/task-1.md',
        extension: 'md',
        size: 128,
        updatedAt: '2026-03-01T11:00:00.000Z'
      },
      {
        name: 'task-2.txt',
        relativePath: '001-Project/PiPiClaw/task/task-2.txt',
        extension: 'txt',
        size: 128,
        updatedAt: '2026-03-01T10:00:00.000Z'
      },
      {
        name: 'task-3.md',
        relativePath: '001-Project/PiPiClaw/tasks/task-3.md',
        extension: 'md',
        size: 128,
        updatedAt: '2026-03-01T09:00:00.000Z'
      },
      {
        name: 'task-4.md',
        relativePath: '001-Project/SDK/task/task-4.md',
        extension: 'md',
        size: 128,
        updatedAt: '2026-03-01T12:00:00.000Z'
      },
      {
        name: 'task-5.md',
        relativePath: '001-Project/SDK/task/archive/task-5.md',
        extension: 'md',
        size: 128,
        updatedAt: '2026-03-01T13:00:00.000Z'
      }
    ]

    expect(extractKanbanTaskFilesFromNotesFiles(files).map((item) => item.relativePath)).toEqual([
      '001-Project/SDK/task/task-4.md',
      '001-Project/PiPiClaw/task/task-1.md'
    ])
  })
})

describe('buildTaskRecordFromNotesTaskFile', () => {
  it('builds a task record from markdown frontmatter', () => {
    const file: NotesFileItem = {
      name: 'fix-routing.md',
      relativePath: '001-Project/PiPiClaw/task/fix-routing.md',
      extension: 'md',
      size: 256,
      updatedAt: '2026-03-01T10:00:00.000Z'
    }

    const content = `---
title: 修复路由
status: doing
priority: p1
owner: Lucas
dueAt: 2026-03-15
tags: [kanban, routing]
estimateHours: 3
---

## 任务描述
修复请求路由并补齐重试策略。`

    const task = buildTaskRecordFromNotesTaskFile(file, content)

    expect(task.id).toBe('notes-task:001-Project/PiPiClaw/task/fix-routing.md')
    expect(task.title).toBe('修复路由')
    expect(task.projectName).toBe('PiPiClaw')
    expect(task.status).toBe('doing')
    expect(task.priority).toBe('P1')
    expect(task.owner).toBe('Lucas')
    expect(task.tags).toEqual(['kanban', 'routing'])
    expect(task.dueAt).toBe('2026-03-15')
    expect(task.estimateHours).toBe(3)
    expect(task.summary).toBe('修复请求路由并补齐重试策略。')
  })
})
