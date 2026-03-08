import { describe, expect, it } from 'vitest'
import { parseNotesTaskRelativePath, updateTaskStatusInMarkdown } from './kanban-persistence'

describe('parseNotesTaskRelativePath', () => {
  it('parses notes task id to relative path', () => {
    expect(parseNotesTaskRelativePath('notes-task:001-Project/demo/task/a.md')).toBe(
      '001-Project/demo/task/a.md'
    )
  })

  it('returns null for invalid task id', () => {
    expect(parseNotesTaskRelativePath('task:001-Project/demo/task/a.md')).toBeNull()
    expect(parseNotesTaskRelativePath('notes-task:   ')).toBeNull()
  })
})

describe('updateTaskStatusInMarkdown', () => {
  it('replaces existing status field in frontmatter', () => {
    const content = [
      '---',
      'title: Demo Task',
      'status: todo',
      'owner: Lucas',
      '---',
      '',
      '- [ ] implement',
      ''
    ].join('\n')

    const updated = updateTaskStatusInMarkdown(content, 'done')

    expect(updated).toContain('status: done')
    expect(updated).not.toContain('status: todo')
    expect(updated).toContain('owner: Lucas')
    expect(updated.endsWith('\n')).toBe(true)
  })

  it('normalizes legacy state field to status', () => {
    const content = ['---', 'title: Legacy', 'state: doing', '---', '', 'body'].join('\n')
    const updated = updateTaskStatusInMarkdown(content, 'in-review')

    expect(updated).toContain('status: in-review')
    expect(updated).not.toContain('state: doing')
  })

  it('appends status field when frontmatter has no status', () => {
    const content = ['---', 'title: No Status', 'owner: Lucas', '---', '', 'body'].join('\n')
    const updated = updateTaskStatusInMarkdown(content, 'todo')

    expect(updated).toContain('title: No Status')
    expect(updated).toContain('owner: Lucas')
    expect(updated).toContain('status: todo')
  })

  it('injects frontmatter when file has no frontmatter', () => {
    const content = '# Heading\n\nTask body'
    const updated = updateTaskStatusInMarkdown(content, 'doing')

    expect(updated.startsWith('---\nstatus: doing\n---\n\n')).toBe(true)
    expect(updated).toContain('# Heading')
    expect(updated).toContain('Task body')
  })
})
