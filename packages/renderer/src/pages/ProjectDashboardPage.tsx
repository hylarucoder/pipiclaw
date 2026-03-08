import { ArrowUpRight, BadgeCheck, BookOpenText, Plus, Search, Star } from 'lucide-react'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@renderer/components/ui/card'
import { NavigationRail } from '@renderer/components/NavigationRail'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'
import type {
  ProjectFilter,
  ProjectRecord,
  ProjectRisk,
  ProjectStatus
} from '@renderer/pages/project-types'

type ProjectSummary = {
  total: number
  active: number
  blocked: number
  done: number
  avgProgress: number
}

export interface ProjectDashboardPageProps {
  workspaceTitle: string
  dashboardName: string
  heroTone: string
  quickActions: string[]
  projectQuery: string
  projectFilter: ProjectFilter
  projectFilterOptions: Array<{ key: ProjectFilter; label: string }>
  projectSummary: ProjectSummary
  filteredProjects: ProjectRecord[]
  selectedProject: ProjectRecord | null
  onProjectQueryChange: (query: string) => void
  onProjectFilterChange: (filter: ProjectFilter) => void
  onSelectProject: (projectId: string) => void
  projectStatusLabel: (status: ProjectStatus) => string
  projectStatusClass: (status: ProjectStatus) => string
  projectRiskLabel: (risk: ProjectRisk) => string
  projectRiskClass: (risk: ProjectRisk) => string
}

const unifiedHeaderClass = 'border-b border-border/70 bg-card/70 text-foreground'

export function ProjectDashboardPage({
  workspaceTitle,
  dashboardName,
  heroTone,
  quickActions,
  projectQuery,
  projectFilter,
  projectFilterOptions,
  projectSummary,
  filteredProjects,
  selectedProject,
  onProjectQueryChange,
  onProjectFilterChange,
  onSelectProject,
  projectStatusLabel,
  projectStatusClass,
  projectRiskLabel,
  projectRiskClass
}: ProjectDashboardPageProps): React.JSX.Element {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="[-webkit-app-region:drag] h-8 shrink-0 border-b border-border/70 bg-card/70 px-2.5">
        <div className="flex h-full items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium tracking-wide text-foreground">PiPiClaw Workspace</span>
          <span>{workspaceTitle}</span>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-x-auto p-2">
        <div className="grid h-full min-w-[1240px] w-full gap-2 grid-cols-[44px_280px_minmax(0,1fr)_340px]">
          <NavigationRail />

          <Card className="h-full overflow-hidden">
            <CardHeader className={cn(unifiedHeaderClass, 'gap-1.5')}>
              <div className="rounded-md border border-border/70 bg-muted/30 px-2.5 py-2">
                <p className="text-[10px] tracking-wide text-muted-foreground">项目状态中心</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">{dashboardName}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  聚焦在“进度、风险、下一步”三件事
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <BookOpenText className="size-4" />
                </span>
                <div>
                  <CardTitle>当前项目列表</CardTitle>
                  <CardDescription>先看阻塞，再看进行中</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-1.5 p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={projectQuery}
                  onChange={(event) => onProjectQueryChange(event.target.value)}
                  className="pl-9"
                  placeholder="搜索项目、负责人、标签…"
                />
              </div>

              <div className="grid grid-cols-2 gap-1">
                {projectFilterOptions.map((filter) => (
                  <Button
                    key={filter.key}
                    type="button"
                    size="sm"
                    variant={projectFilter === filter.key ? 'default' : 'outline'}
                    onClick={() => onProjectFilterChange(filter.key)}
                    className={cn(
                      'justify-start',
                      projectFilter !== filter.key && 'text-muted-foreground'
                    )}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-border/70 bg-muted/35 px-2.5 py-2">
                  <p className="text-[11px] text-muted-foreground">进行中</p>
                  <p className="mt-0.5 text-base font-semibold text-foreground">
                    {projectSummary.active}
                  </p>
                </div>
                <div className="rounded-md border border-border/70 bg-muted/35 px-2.5 py-2">
                  <p className="text-[11px] text-muted-foreground">阻塞</p>
                  <p className="mt-0.5 text-base font-semibold text-destructive">
                    {projectSummary.blocked}
                  </p>
                </div>
              </div>

              <Button className="w-full justify-start gap-2">
                <Plus className="size-4" />
                新建项目追踪
              </Button>

              <div className="rounded-md border border-border/70 bg-muted/35 p-2">
                <p className="mb-1 text-xs text-muted-foreground">本周目标</p>
                <div className="space-y-1">
                  {quickActions.slice(0, 3).map((action) => (
                    <div
                      key={action}
                      className="rounded-md bg-background px-2 py-1 text-xs text-foreground"
                    >
                      {action}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex h-full min-h-0 flex-col gap-2">
            <Card className="overflow-hidden border-primary/25">
              <CardContent className={cn('bg-gradient-to-br p-2.5 text-foreground', heroTone)}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Project Tracking
                    </p>
                    <h2 className="mt-1 text-lg font-semibold">当前项目状态</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      一屏看到项目进展、风险等级与本周推进点
                    </p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-background/65 px-2.5 py-1.5 text-right">
                    <p className="text-[10px] text-muted-foreground">平均进度</p>
                    <p className="text-base font-semibold text-foreground">
                      {projectSummary.avgProgress}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-2">
              <Card>
                <CardHeader className={cn(unifiedHeaderClass, 'pb-2')}>
                  <CardDescription>总项目</CardDescription>
                  <CardTitle className="text-lg">{projectSummary.total}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className={cn(unifiedHeaderClass, 'pb-2')}>
                  <CardDescription>进行中</CardDescription>
                  <CardTitle className="text-lg">{projectSummary.active}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className={cn(unifiedHeaderClass, 'pb-2')}>
                  <CardDescription>已完成</CardDescription>
                  <CardTitle className="text-lg">{projectSummary.done}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card className="min-h-0 flex-1 overflow-hidden">
              <CardHeader className={cn(unifiedHeaderClass, 'gap-1')}>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Star className="size-4 text-primary" />
                  项目列表
                </CardTitle>
                <CardDescription>排序规则: 阻塞优先 → 截止日期最近 → 最近更新</CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 overflow-auto p-0">
                <div className="min-w-[840px]">
                  <div className="grid grid-cols-[minmax(240px,2fr)_90px_130px_minmax(220px,2fr)_72px_110px] border-b border-border/70 bg-card/65 px-3 py-2 text-[11px] font-medium tracking-wide text-muted-foreground">
                    <span>项目</span>
                    <span>状态</span>
                    <span>进度</span>
                    <span>本周目标</span>
                    <span>风险</span>
                    <span>更新</span>
                  </div>
                  {filteredProjects.length === 0 ? (
                    <div className="px-3 py-6 text-sm text-muted-foreground">没有匹配项目。</div>
                  ) : (
                    filteredProjects.map((project) => (
                      <Button
                        key={project.id}
                        type="button"
                        variant="ghost"
                        onClick={() => onSelectProject(project.id)}
                        className={cn(
                          'h-auto grid w-full grid-cols-[minmax(240px,2fr)_90px_130px_minmax(220px,2fr)_72px_110px] items-center gap-2 rounded-none border-b border-border/55 px-3 py-2 text-left transition-colors hover:bg-muted/35',
                          selectedProject?.id === project.id && 'bg-primary/8'
                        )}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {project.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {project.owner} · {project.tags.join(' / ')}
                          </p>
                        </div>
                        <Badge
                          className={cn(
                            'w-fit border text-[10px]',
                            projectStatusClass(project.status)
                          )}
                        >
                          {projectStatusLabel(project.status)}
                        </Badge>
                        <div>
                          <p className="text-xs font-medium text-foreground">{project.progress}%</p>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${project.progress}%` }}
                            />
                          </div>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {project.weeklyGoal}
                        </p>
                        <Badge
                          className={cn('w-fit border text-[10px]', projectRiskClass(project.risk))}
                        >
                          {projectRiskLabel(project.risk)}
                        </Badge>
                        <p className="text-xs text-muted-foreground">{project.updatedAtLabel}</p>
                      </Button>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex h-full flex-col gap-2">
            <Card>
              <CardHeader className={unifiedHeaderClass}>
                <CardDescription>项目详情</CardDescription>
                <CardTitle className="text-base">{selectedProject?.name ?? '未选中项目'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {selectedProject ? (
                  <>
                    <p className="text-sm text-muted-foreground">{selectedProject.summary}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        className={cn(
                          'border text-[10px]',
                          projectStatusClass(selectedProject.status)
                        )}
                      >
                        {projectStatusLabel(selectedProject.status)}
                      </Badge>
                      <Badge
                        className={cn('border text-[10px]', projectRiskClass(selectedProject.risk))}
                      >
                        风险 {projectRiskLabel(selectedProject.risk)}
                      </Badge>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/30 p-2">
                      <p className="text-[11px] text-muted-foreground">截至时间</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">
                        {selectedProject.dueAtLabel}
                      </p>
                    </div>
                    {selectedProject.blocker && (
                      <div className="rounded-md border border-destructive/25 bg-destructive/8 p-2">
                        <p className="text-[11px] text-destructive">阻塞信息</p>
                        <p className="mt-0.5 text-xs text-destructive">{selectedProject.blocker}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">暂无项目数据。</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className={unifiedHeaderClass}>
                <CardDescription>里程碑</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {selectedProject ? (
                  selectedProject.milestones.map((milestone) => (
                    <div key={milestone.label} className="flex items-start gap-2 text-sm">
                      <BadgeCheck
                        className={cn(
                          'mt-0.5 size-4',
                          milestone.done ? 'text-primary' : 'text-muted-foreground'
                        )}
                      />
                      <span className={cn(!milestone.done && 'text-muted-foreground')}>
                        {milestone.label}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">暂无里程碑。</p>
                )}
              </CardContent>
            </Card>

            <Card className="flex-1">
              <CardHeader className={unifiedHeaderClass}>
                <CardDescription>下一步动作</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {selectedProject ? (
                  selectedProject.nextActions.map((action) => (
                    <div key={action} className="flex items-start gap-2 text-sm">
                      <ArrowUpRight className="mt-0.5 size-4 text-primary" />
                      <p>{action}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">暂无动作建议。</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
