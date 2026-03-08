import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  closestCenter,
  pointerWithin,
  type CollisionDetection,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { Input } from '@renderer/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { NavigationRail } from '@renderer/components/NavigationRail'
import { invokeNotesListFiles, invokeNotesReadFile, invokeNotesWriteFile } from '@renderer/lib/notes'
import { cn } from '@renderer/lib/utils'
import {
  isTaskStatus,
  type TaskPriority,
  type TaskRecord,
  type TaskStatus
} from '@renderer/pages/task-types'
import {
  buildTaskRecordFromNotesTaskFile,
  extractKanbanTaskFilesFromNotesFiles,
  extractProjectNamesFromNotesFiles,
  filterTasksByProjectAndKeyword
} from '@renderer/pages/kanban-search'
import { parseNotesTaskRelativePath, updateTaskStatusInMarkdown } from './kanban-persistence'
import {
  TASK_KANBAN_SCOPE_ID,
  selectTaskKanbanItems,
  useTaskKanbanStore
} from '@renderer/store/taskKanbanStore'

const CARD_ID_PREFIX = 'kanban-card:'
const COLUMN_ID_PREFIX = 'kanban-column:'

const STATUS_COLUMNS: Array<{ key: TaskStatus; label: string }> = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'todo', label: 'Todo' },
  { key: 'doing', label: 'Doing' },
  { key: 'in-review', label: 'In Review' },
  { key: 'done', label: 'Done' },
  { key: 'canceled', label: 'Canceled' }
]

const collisionDetectionStrategy: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args)
  if (pointerHits.length > 0) return pointerHits
  return closestCenter(args)
}

function toCardId(taskId: string): string {
  return `${CARD_ID_PREFIX}${taskId}`
}

function toColumnId(status: TaskStatus): string {
  return `${COLUMN_ID_PREFIX}${status}`
}

function parseCardId(id: UniqueIdentifier): string | null {
  if (typeof id !== 'string' || !id.startsWith(CARD_ID_PREFIX)) return null
  return id.slice(CARD_ID_PREFIX.length)
}

function parseColumnId(id: UniqueIdentifier): TaskStatus | null {
  if (typeof id !== 'string' || !id.startsWith(COLUMN_ID_PREFIX)) return null
  const status = id.slice(COLUMN_ID_PREFIX.length)
  return isTaskStatus(status) ? status : null
}

function statusBadgeClass(status: TaskStatus): string {
  if (status === 'done') return 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
  if (status === 'doing') return 'bg-primary/15 text-primary border-primary/35'
  if (status === 'in-review') return 'bg-orange-500/15 text-orange-700 border-orange-500/35'
  if (status === 'canceled') return 'bg-muted text-muted-foreground border-border'
  if (status === 'todo') return 'bg-blue-500/12 text-blue-700 border-blue-500/30'
  return 'bg-slate-500/12 text-slate-700 border-slate-500/30'
}

function statusLabel(status: TaskStatus): string {
  if (status === 'backlog') return 'Backlog'
  if (status === 'todo') return 'Todo'
  if (status === 'doing') return 'Doing'
  if (status === 'in-review') return 'In Review'
  if (status === 'done') return 'Done'
  return 'Canceled'
}

function priorityBadgeClass(priority: TaskPriority): string {
  if (priority === 'P0') return 'bg-destructive/15 text-destructive border-destructive/30'
  if (priority === 'P1') return 'bg-orange-500/15 text-orange-700 border-orange-500/30'
  return 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
}

function KanbanCard({
  task,
  onMoveStatus,
  isPersisting
}: {
  task: TaskRecord
  onMoveStatus: (taskId: string, target: TaskStatus) => void
  isPersisting: boolean
}): React.JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: toCardId(task.id),
    data: {
      type: 'task-card',
      taskId: task.id,
      status: task.status
    }
  })

  return (
    <Card
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition
      }}
      className={cn(
        'cursor-grab border-border/70 bg-background/70 active:cursor-grabbing',
        isDragging && 'z-20 opacity-65 shadow-lg ring-2 ring-primary/30'
      )}
    >
      <CardHeader className="gap-1.5 px-2.5 py-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {task.projectName} · {task.owner}
            </p>
          </div>
          <Badge className={cn('border text-[10px]', statusBadgeClass(task.status))}>
            {statusLabel(task.status)}
          </Badge>
        </div>

        <p className="line-clamp-2 text-xs text-muted-foreground">{task.summary}</p>

        {task.blockedReason ? (
          <div className="rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
            卡点：{task.blockedReason}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-1.5 px-2.5 pb-1.5 pt-0">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>截止 {task.dueAtLabel}</span>
          {task.estimateHours ? <span>预估 {task.estimateHours}h</span> : null}
          <Badge className={cn('border text-[10px]', priorityBadgeClass(task.priority))}>
            {task.priority}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <Badge key={`${task.id}-${tag}`} variant="secondary" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {task.status !== 'todo' && task.status !== 'done' && task.status !== 'canceled' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              disabled={isPersisting}
              onClick={() => onMoveStatus(task.id, 'todo')}
            >
              回到 Todo
            </Button>
          )}
          {task.status !== 'doing' && task.status !== 'done' && task.status !== 'canceled' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              disabled={isPersisting}
              onClick={() => onMoveStatus(task.id, 'doing')}
            >
              开始执行
            </Button>
          )}
          {task.status === 'doing' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              disabled={isPersisting}
              onClick={() => onMoveStatus(task.id, 'in-review')}
            >
              提交评审
            </Button>
          )}
          {task.status !== 'done' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              disabled={isPersisting}
              onClick={() => onMoveStatus(task.id, 'done')}
            >
              标记完成
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function KanbanColumn({
  status,
  label,
  tasks,
  onMoveStatus,
  persistingTaskIds
}: {
  status: TaskStatus
  label: string
  tasks: TaskRecord[]
  onMoveStatus: (taskId: string, target: TaskStatus) => void
  persistingTaskIds: ReadonlySet<string>
}): React.JSX.Element {
  const { isOver, setNodeRef } = useDroppable({
    id: toColumnId(status),
    data: {
      type: 'status-column',
      status
    }
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-0 flex-col rounded-md border border-border/70 bg-muted/20 transition-colors',
        isOver && 'border-primary/40 bg-primary/8'
      )}
    >
      <div className="flex items-center justify-between border-b border-border/70 px-2.5 py-2">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <Badge variant="secondary">{tasks.length}</Badge>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-auto p-1.5">
        <SortableContext
          items={tasks.map((task) => toCardId(task.id))}
          strategy={rectSortingStrategy}
        >
          {tasks.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 bg-background/50 px-2 py-2 text-center text-xs text-muted-foreground">
              拖到这里
            </div>
          ) : (
            tasks.map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                onMoveStatus={onMoveStatus}
                isPersisting={persistingTaskIds.has(task.id)}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  )
}

export function KanbanPage(): React.JSX.Element {
  const ensure = useTaskKanbanStore((state) => state.ensure)
  const applyLoaded = useTaskKanbanStore((state) => state.applyLoaded)
  const setLoading = useTaskKanbanStore((state) => state.setLoading)
  const moveWithinStatus = useTaskKanbanStore((state) => state.moveWithinStatus)
  const moveToStatus = useTaskKanbanStore((state) => state.moveToStatus)
  const setActiveId = useTaskKanbanStore((state) => state.setActiveId)
  const itemsSelector = useMemo(() => selectTaskKanbanItems(TASK_KANBAN_SCOPE_ID), [])
  const tasks = useTaskKanbanStore(itemsSelector)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [projectOptions, setProjectOptions] = useState<string[]>([])
  const [persistingTaskIds, setPersistingTaskIds] = useState<string[]>([])
  const mountedRef = useRef(true)
  const persistingTaskIdsRef = useRef(new Set<string>())
  const showPersistingToast = useCallback((): void => {
    toast.error('该任务正在保存，请稍后重试。', { id: 'kanban-task-persisting' })
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6
      }
    })
  )

  const setTaskPersisting = useCallback((taskId: string, persisting: boolean): void => {
    if (persisting) {
      persistingTaskIdsRef.current.add(taskId)
    } else {
      persistingTaskIdsRef.current.delete(taskId)
    }

    if (mountedRef.current) {
      setPersistingTaskIds([...persistingTaskIdsRef.current])
    }
  }, [])

  const reloadTasksFromNotes = useCallback(async (): Promise<void> => {
    if (!mountedRef.current) return
    ensure(TASK_KANBAN_SCOPE_ID)

    try {
      setLoading(TASK_KANBAN_SCOPE_ID, true)
      const listResult = await invokeNotesListFiles()
      if (!mountedRef.current) return

      setProjectOptions(extractProjectNamesFromNotesFiles(listResult.files))
      if (listResult.error) {
        toast.error(`读取文件列表失败：${listResult.error}`, { id: 'kanban-list-files-error' })
      }

      const taskFiles = extractKanbanTaskFilesFromNotesFiles(listResult.files)
      const taskPayloads = await Promise.all(
        taskFiles.map(async (file) => {
          try {
            const readResult = await invokeNotesReadFile({ relativePath: file.relativePath })
            return {
              file,
              content: readResult.content,
              error: readResult.error ?? null
            }
          } catch (error) {
            return {
              file,
              content: '',
              error: error instanceof Error ? error.message : '读取任务文件失败'
            }
          }
        })
      )
      if (!mountedRef.current) return

      const loadedTasks = taskPayloads
        .filter((payload) => !payload.error)
        .map((payload) => buildTaskRecordFromNotesTaskFile(payload.file, payload.content))

      applyLoaded(TASK_KANBAN_SCOPE_ID, loadedTasks, { replaceOrder: true })

      const taskFailedCount = taskPayloads.filter((payload) => payload.error).length
      if (taskFailedCount > 0) {
        toast.error(`读取任务文件失败 ${taskFailedCount} 条`, { id: 'kanban-read-tasks-error' })
      }
    } catch (error) {
      if (!mountedRef.current) return
      setProjectOptions([])
      applyLoaded(TASK_KANBAN_SCOPE_ID, [], { replaceOrder: true })
      const message = error instanceof Error ? error.message : '读取看板数据失败'
      toast.error(message, { id: 'kanban-load-error' })
    } finally {
      if (mountedRef.current) {
        setLoading(TASK_KANBAN_SCOPE_ID, false)
      }
    }
  }, [applyLoaded, ensure, setLoading])

  useEffect(() => {
    mountedRef.current = true
    void reloadTasksFromNotes()
    return () => {
      mountedRef.current = false
    }
  }, [reloadTasksFromNotes])

  const tasksById = useMemo(() => {
    const map = new Map<string, TaskRecord>()
    for (const task of tasks) {
      map.set(task.id, task)
    }
    return map
  }, [tasks])

  useEffect(() => {
    if (selectedProject === 'all') return
    if (!projectOptions.includes(selectedProject)) {
      setSelectedProject('all')
    }
  }, [projectOptions, selectedProject])

  const filteredTasks = useMemo(
    () =>
      filterTasksByProjectAndKeyword(tasks, {
        projectName: selectedProject,
        keyword: searchKeyword
      }),
    [searchKeyword, selectedProject, tasks]
  )

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, TaskRecord[]> = {
      backlog: [],
      todo: [],
      doing: [],
      'in-review': [],
      done: [],
      canceled: []
    }

    for (const task of filteredTasks) {
      map[task.status].push(task)
    }

    return map
  }, [filteredTasks])

  const activeTask = activeTaskId ? (tasksById.get(activeTaskId) ?? null) : null
  const persistingTaskIdSet = useMemo(() => new Set(persistingTaskIds), [persistingTaskIds])

  const persistTaskStatus = useCallback(
    async (task: TaskRecord, targetStatus: TaskStatus): Promise<void> => {
      const relativePath = parseNotesTaskRelativePath(task.id)
      if (!relativePath) {
        toast.error(`保存失败：任务路径无效（${task.id}）`, { id: 'kanban-persist-path-error' })
        await reloadTasksFromNotes()
        return
      }

      setTaskPersisting(task.id, true)
      console.info('[kanban] persist task status', {
        taskId: task.id,
        relativePath,
        targetStatus
      })

      try {
        const readResult = await invokeNotesReadFile({ relativePath })
        if (readResult.error) {
          throw new Error(readResult.error)
        }

        const updatedContent = updateTaskStatusInMarkdown(readResult.content, targetStatus)
        const writeResult = await invokeNotesWriteFile({
          relativePath,
          content: updatedContent
        })
        if (writeResult.error) {
          throw new Error(writeResult.error)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '任务状态保存失败'
        console.error('[kanban] persist task status failed', {
          taskId: task.id,
          relativePath,
          targetStatus,
          message
        })
        toast.error(`保存失败：${message}`, { id: `kanban-persist-error-${task.id}` })
        await reloadTasksFromNotes()
      } finally {
        setTaskPersisting(task.id, false)
      }
    },
    [reloadTasksFromNotes, setTaskPersisting]
  )

  const handleMoveStatus = useCallback(
    (taskId: string, target: TaskStatus): void => {
      const task = tasksById.get(taskId)
      if (!task || task.status === target) return

      if (persistingTaskIdsRef.current.has(taskId)) {
        showPersistingToast()
        return
      }

      moveToStatus(TASK_KANBAN_SCOPE_ID, taskId, target)
      void persistTaskStatus(task, target)
    },
    [moveToStatus, persistTaskStatus, showPersistingToast, tasksById]
  )

  const handleDragStart = (event: DragStartEvent): void => {
    const taskId = parseCardId(event.active.id)
    setActiveTaskId(taskId)
    setActiveId(TASK_KANBAN_SCOPE_ID, taskId)
  }

  const resetDragState = (): void => {
    setActiveTaskId(null)
    setActiveId(TASK_KANBAN_SCOPE_ID, null)
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    const activeId = parseCardId(event.active.id)
    const overId = event.over?.id

    if (!activeId || !overId) {
      resetDragState()
      return
    }

    const activeTask = tasksById.get(activeId)
    if (!activeTask) {
      resetDragState()
      return
    }

    const overTaskId = parseCardId(overId)
    if (overTaskId) {
      if (overTaskId === activeId) {
        resetDragState()
        return
      }

      const overTask = tasksById.get(overTaskId)
      if (!overTask) {
        resetDragState()
        return
      }

      if (overTask.status === activeTask.status) {
        moveWithinStatus(TASK_KANBAN_SCOPE_ID, activeTask.status, activeId, overTaskId)
      } else {
        if (persistingTaskIdsRef.current.has(activeTask.id)) {
          showPersistingToast()
          resetDragState()
          return
        }
        moveToStatus(TASK_KANBAN_SCOPE_ID, activeId, overTask.status, overTaskId)
        void persistTaskStatus(activeTask, overTask.status)
      }

      resetDragState()
      return
    }

    const targetStatus = parseColumnId(overId)
    if (targetStatus && targetStatus !== activeTask.status) {
      if (persistingTaskIdsRef.current.has(activeTask.id)) {
        showPersistingToast()
        resetDragState()
        return
      }
      moveToStatus(TASK_KANBAN_SCOPE_ID, activeId, targetStatus, null)
      void persistTaskStatus(activeTask, targetStatus)
    }

    resetDragState()
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="[-webkit-app-region:drag] h-8 shrink-0 border-b border-border/70 bg-card/70 px-2.5">
        <div className="flex h-full items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium tracking-wide text-foreground">PiPiClaw Workspace</span>
          <span>任务看板</span>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden p-2">
        <div className="grid h-full min-w-0 w-full gap-2 grid-cols-[44px_minmax(0,1fr)]">
          <NavigationRail />

          <Card className="h-full overflow-hidden">
            <CardHeader className="border-b border-border/70 bg-card/70">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle>任务看板</CardTitle>
                </div>
                <Badge variant="secondary" className="text-xs">
                  已筛选 {filteredTasks.length} / 总计 {tasks.length}
                </Badge>
              </div>

              <div className="grid gap-1.5 md:grid-cols-[220px_minmax(0,1fr)]">
                <label className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">项目</span>
                  <Select
                    value={selectedProject}
                    onValueChange={(value) => setSelectedProject(value ?? 'all')}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="全部项目" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部项目</SelectItem>
                      {projectOptions.map((projectName) => (
                        <SelectItem key={projectName} value={projectName}>
                          {projectName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">任务检索</span>
                  <Input
                    value={searchKeyword}
                    onChange={(event) => setSearchKeyword(event.target.value)}
                    placeholder="搜索标题 / 摘要 / 负责人 / 标签"
                  />
                </label>
              </div>
            </CardHeader>

            <CardContent className="h-full min-h-0 p-2">
              <DndContext
                sensors={sensors}
                collisionDetection={collisionDetectionStrategy}
                onDragStart={handleDragStart}
                onDragCancel={resetDragState}
                onDragEnd={handleDragEnd}
              >
                <div className="grid h-full min-h-0 grid-cols-6 gap-2">
                  {STATUS_COLUMNS.map((column) => (
                    <KanbanColumn
                      key={column.key}
                      status={column.key}
                      label={column.label}
                      tasks={grouped[column.key]}
                      onMoveStatus={handleMoveStatus}
                      persistingTaskIds={persistingTaskIdSet}
                    />
                  ))}
                </div>

                <DragOverlay>
                  {activeTask ? (
                    <div className="w-[300px] rounded-md border border-primary/40 bg-card p-2.5 shadow-xl">
                      <p className="truncate text-sm font-medium text-foreground">
                        {activeTask.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {activeTask.summary}
                      </p>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
