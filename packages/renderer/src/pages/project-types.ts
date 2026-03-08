export type ProjectStatus = 'active' | 'blocked' | 'done'
export type ProjectRisk = 'low' | 'medium' | 'high'
export type ProjectFilter = 'all' | ProjectStatus

export type ProjectMilestone = {
  label: string
  done: boolean
}

export type ProjectRecord = {
  id: string
  name: string
  summary: string
  status: ProjectStatus
  risk: ProjectRisk
  progress: number
  weeklyGoal: string
  owner: string
  tags: string[]
  updatedAt: string
  updatedAtLabel: string
  dueAt: string
  dueAtLabel: string
  blocker?: string
  milestones: ProjectMilestone[]
  nextActions: string[]
}
