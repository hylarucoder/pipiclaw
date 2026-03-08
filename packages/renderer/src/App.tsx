import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { DrawStudioPage } from '@renderer/pages/DrawStudioPage'
import { ImagenPage } from '@renderer/pages/ImagenPage'
import { FilesPage } from '@renderer/pages/FilesPage'
import { SettingsPage } from '@renderer/pages/SettingsPage'
import { ChatPage } from '@renderer/pages/ChatPage'
import {
  type FilePreviewMode,
  type FilePreviewState,
  type FileTreeNode
} from '@renderer/pages/files-types'
import { ProjectDashboardPage } from '@renderer/pages/ProjectDashboardPage'
import {
  type ProjectFilter,
  type ProjectRecord,
  type ProjectRisk,
  type ProjectStatus
} from '@renderer/pages/project-types'
import { KanbanPage } from '@renderer/pages/KanbanPage'
import { type TaskRecord } from '@renderer/pages/task-types'
import {
  buildTaskRecordFromNotesTaskFile,
  extractKanbanTaskFilesFromNotesFiles,
  extractProjectNamesFromNotesFiles,
  NOTES_PROJECTS_ROOT_DIR
} from '@renderer/pages/kanban-search'
import {
  DEFAULT_NOTES_SEARCH_LIMIT,
  NOTES_LIST_FILES_CHANNEL,
  NOTES_READ_ASSET_CHANNEL,
  NOTES_READ_FILE_CHANNEL,
  NOTES_SEARCH_FILES_CHANNEL,
  notesListFilesInputSchema,
  notesListFilesResultSchema,
  notesReadAssetInputSchema,
  notesReadAssetResultSchema,
  notesReadFileInputSchema,
  notesReadFileResultSchema,
  notesSearchFilesInputSchema,
  notesSearchFilesResultSchema,
  type NotesFileItem,
  type NotesFilesChangedPayload,
  type NotesListFilesInput,
  type NotesListFilesResult,
  type NotesReadAssetInput,
  type NotesReadAssetResult,
  type NotesReadFileInput,
  type NotesReadFileResult,
  type NotesSearchFilesInput,
  type NotesSearchFilesResult
} from '@pipiclaw/shared/rpc/notes'
import {
  DEFAULT_PREVIEW_MAX_ASSET_BYTES,
  DEFAULT_PREVIEW_MAX_CHARS,
  createDefaultAppSettings,
  type AppSettings
} from '@pipiclaw/shared/rpc/settings'
import { invokeSettingsGet } from '@renderer/lib/settings'
import { setI18nLanguage } from '@renderer/i18n'

type WorkspaceRoute = '/notes' | '/files' | '/journal'

type WorkspaceConfig = {
  title: string
  heroTone: string
  quickActions: string[]
}

const workspaceConfigByRoute: Record<WorkspaceRoute, WorkspaceConfig> = {
  '/notes': {
    title: '笔记工作台',
    heroTone: 'from-primary/20 via-accent/10 to-secondary/20',
    quickActions: ['批量打标签', '生成周报', '合并重复条目']
  },
  '/files': {
    title: '文件列表',
    heroTone: 'from-secondary/24 via-primary/10 to-accent/12',
    quickActions: ['新建文件夹', '批量重命名', '导出目录树']
  },
  '/journal': {
    title: '日记工作台',
    heroTone: 'from-accent/25 via-primary/10 to-secondary/15',
    quickActions: ['今日模板', '情绪打分', '生成月度总结']
  }
}

const workspaceDashboardMeta = {
  name: '全内容仪表盘'
}
const fallbackAppSettings = createDefaultAppSettings()

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'])
const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown'])
const TEXT_EXTENSIONS = new Set([
  'txt',
  'json',
  'yml',
  'yaml',
  'xml',
  'csv',
  'ts',
  'tsx',
  'js',
  'jsx',
  'html',
  'css',
  'scss',
  'less',
  'py',
  'go',
  'rs',
  'java',
  'kt',
  'swift',
  'sh',
  'zsh',
  'bash',
  'sql',
  'log',
  'toml',
  'ini'
])

const projectFilterOptions: Array<{ key: ProjectFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'blocked', label: '阻塞' },
  { key: 'done', label: '已完成' }
]

function normalizeWorkspaceRoute(pathname: string): WorkspaceRoute {
  if (pathname === '/files') return '/files'
  if (pathname === '/journal') return '/journal'
  return '/notes'
}

function getFilePreviewMode(file?: NotesFileItem): FilePreviewMode {
  const extension = file?.extension?.toLowerCase() ?? ''
  const relativePath = file?.relativePath?.toLowerCase() ?? ''
  const isExcalidrawMarkdown = extension === 'md' && relativePath.includes('.excalidraw')

  if (extension === 'pdf') return 'pdf'
  if (extension === 'canvas') return 'canvas'
  if (extension === 'excalidraw' || isExcalidrawMarkdown) return 'excalidraw'
  if (MARKDOWN_EXTENSIONS.has(extension)) return 'markdown'
  if (IMAGE_EXTENSIONS.has(extension)) return 'image'
  if (TEXT_EXTENSIONS.has(extension) || extension.length === 0) return 'text'
  return 'unsupported'
}

function buildFileTree(files: NotesFileItem[]): FileTreeNode[] {
  type MutableTreeNode = {
    name: string
    path: string
    kind: 'directory' | 'file'
    children: Map<string, MutableTreeNode>
    file?: NotesFileItem
  }

  const root = new Map<string, MutableTreeNode>()

  for (const file of files) {
    const segments = file.relativePath.split('/').filter(Boolean)
    if (segments.length === 0) continue

    let currentLevel = root
    let currentPath = ''

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index]
      const isLeafFile = index === segments.length - 1
      currentPath = currentPath ? `${currentPath}/${segment}` : segment

      let node = currentLevel.get(segment)
      if (!node) {
        node = {
          name: segment,
          path: currentPath,
          kind: isLeafFile ? 'file' : 'directory',
          children: new Map<string, MutableTreeNode>()
        }
        currentLevel.set(segment, node)
      }

      if (isLeafFile) {
        node.kind = 'file'
        node.file = file
      }

      currentLevel = node.children
    }
  }

  const toImmutable = (nodes: Map<string, MutableTreeNode>): FileTreeNode[] =>
    [...nodes.values()]
      .sort((left, right) => {
        if (left.kind !== right.kind) return left.kind === 'directory' ? -1 : 1
        return left.name.localeCompare(right.name, 'zh-CN')
      })
      .map((node) => ({
        name: node.name,
        path: node.path,
        kind: node.kind,
        file: node.file,
        children: toImmutable(node.children)
      }))

  return toImmutable(root)
}

function collectDirectoryPaths(nodes: FileTreeNode[]): string[] {
  const paths: string[] = []
  const walk = (items: FileTreeNode[]): void => {
    for (const item of items) {
      if (item.kind === 'directory') {
        paths.push(item.path)
        walk(item.children)
      }
    }
  }
  walk(nodes)
  return paths
}

function projectStatusLabel(status: ProjectStatus): string {
  if (status === 'active') return '进行中'
  if (status === 'blocked') return '阻塞'
  return '已完成'
}

function projectStatusClass(status: ProjectStatus): string {
  if (status === 'blocked') return 'bg-destructive/15 text-destructive border-destructive/30'
  if (status === 'done') return 'bg-accent/30 text-accent-foreground border-accent/40'
  return 'bg-primary/12 text-primary border-primary/30'
}

function projectRiskLabel(risk: ProjectRisk): string {
  if (risk === 'high') return '高'
  if (risk === 'medium') return '中'
  return '低'
}

function projectRiskClass(risk: ProjectRisk): string {
  if (risk === 'high') return 'bg-destructive/15 text-destructive border-destructive/30'
  if (risk === 'medium') return 'bg-orange-500/15 text-orange-600 border-orange-500/30'
  return 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
}

function parseSortableDate(value: string): number {
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return 0
  return timestamp
}

function formatProjectUpdatedAtLabel(isoDateTime: string): string {
  const parsed = new Date(isoDateTime)
  if (Number.isNaN(parsed.getTime())) return isoDateTime

  const now = new Date()
  const isSameDay =
    parsed.getFullYear() === now.getFullYear() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getDate() === now.getDate()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    parsed.getFullYear() === yesterday.getFullYear() &&
    parsed.getMonth() === yesterday.getMonth() &&
    parsed.getDate() === yesterday.getDate()
  const hours = `${parsed.getHours()}`.padStart(2, '0')
  const minutes = `${parsed.getMinutes()}`.padStart(2, '0')

  if (isSameDay) return `今天 ${hours}:${minutes}`
  if (isYesterday) return `昨天 ${hours}:${minutes}`
  return `${parsed.getMonth() + 1}/${parsed.getDate()} ${hours}:${minutes}`
}

function formatProjectDueAtLabel(dateText: string): string {
  const parsed = new Date(dateText)
  if (Number.isNaN(parsed.getTime())) return dateText
  return `${parsed.getMonth() + 1} 月 ${parsed.getDate()} 日`
}

function toNotesProjectId(projectName: string): string {
  const normalized = projectName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '')
  if (normalized) return `notes-project:${normalized}`
  return `notes-project:${encodeURIComponent(projectName)}`
}

function buildProjectsFromNotes(files: NotesFileItem[], tasks: TaskRecord[]): ProjectRecord[] {
  const filesByProject = new Map<string, NotesFileItem[]>()
  for (const file of files) {
    const normalizedPath = file.relativePath.replace(/\\/g, '/')
    const segments = normalizedPath.split('/').filter(Boolean)
    if (segments.length < 3) continue
    if (segments[0] !== NOTES_PROJECTS_ROOT_DIR) continue
    if (segments[1] === 'tasks') continue

    const projectName = segments[1]
    const bucket = filesByProject.get(projectName) ?? []
    bucket.push(file)
    filesByProject.set(projectName, bucket)
  }

  const tasksByProject = new Map<string, TaskRecord[]>()
  for (const task of tasks) {
    const bucket = tasksByProject.get(task.projectName) ?? []
    bucket.push(task)
    tasksByProject.set(task.projectName, bucket)
  }

  const projectNames = new Set<string>([
    ...extractProjectNamesFromNotesFiles(files),
    ...filesByProject.keys(),
    ...tasksByProject.keys()
  ])

  return [...projectNames]
    .sort((left, right) => left.localeCompare(right, 'zh-CN'))
    .map((projectName) => {
      const projectFiles = filesByProject.get(projectName) ?? []
      const projectTasks = tasksByProject.get(projectName) ?? []
      const doneTasks = projectTasks.filter(
        (task) => task.status === 'done' || task.status === 'canceled'
      )
      const pendingTasks = projectTasks.filter(
        (task) => task.status !== 'done' && task.status !== 'canceled'
      )
      const blockers = projectTasks
        .map((task) => task.blockedReason?.trim())
        .filter((value): value is string => Boolean(value))
      const doneCount = doneTasks.length
      const totalTasks = projectTasks.length
      const progress = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0
      const status: ProjectStatus =
        totalTasks > 0 && doneCount === totalTasks
          ? 'done'
          : blockers.length > 0
            ? 'blocked'
            : 'active'
      const risk: ProjectRisk =
        blockers.length > 0 ? 'high' : totalTasks > 0 && progress < 50 ? 'medium' : 'low'
      const updatedAt = projectFiles
        .map((file) => file.updatedAt)
        .sort((left, right) => right.localeCompare(left))[0] ?? new Date().toISOString()
      const nearestDueAt = pendingTasks
        .map((task) => task.dueAt)
        .filter((dueAt) => !Number.isNaN(new Date(dueAt).getTime()))
        .sort((left, right) => parseSortableDate(left) - parseSortableDate(right))[0]
      const fallbackDue = new Date(parseSortableDate(updatedAt) + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)
      const dueAt = nearestDueAt ?? fallbackDue

      const ownerCount = new Map<string, number>()
      for (const task of projectTasks) {
        const owner = task.owner.trim()
        if (!owner || owner === '未分配') continue
        ownerCount.set(owner, (ownerCount.get(owner) ?? 0) + 1)
      }
      const owner =
        [...ownerCount.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? '未分配'

      const tags = [...new Set(projectTasks.flatMap((task) => task.tags))].slice(0, 3)
      const resolvedTags = tags.length > 0 ? tags : ['Notes']
      const nextActions =
        pendingTasks.length > 0
          ? pendingTasks
              .sort((left, right) => parseSortableDate(left.dueAt) - parseSortableDate(right.dueAt))
              .slice(0, 3)
              .map((task) => `推进「${task.title}」`)
          : ['保持项目文档与里程碑同步']
      const weeklyGoal =
        pendingTasks[0]?.title ? `本周推进「${pendingTasks[0].title}」` : '补齐任务拆解与优先级'

      return {
        id: toNotesProjectId(projectName),
        name: projectName,
        summary:
          totalTasks > 0
            ? `共 ${projectFiles.length} 个文件，任务 ${totalTasks} 条（完成 ${doneCount} 条）。`
            : `共 ${projectFiles.length} 个文件，暂未识别到 task/*.md 任务。`,
        status,
        risk,
        progress,
        weeklyGoal,
        owner,
        tags: resolvedTags,
        updatedAt,
        updatedAtLabel: formatProjectUpdatedAtLabel(updatedAt),
        dueAt,
        dueAtLabel: formatProjectDueAtLabel(dueAt),
        blocker: blockers[0],
        milestones:
          totalTasks > 0
            ? [
                { label: `已录入任务 ${totalTasks} 条`, done: true },
                { label: `已完成任务 ${doneCount} 条`, done: doneCount > 0 },
                { label: '待办任务清零', done: pendingTasks.length === 0 }
              ]
            : [
                { label: '建立任务清单', done: false },
                { label: '补充项目摘要', done: false },
                { label: '定义阶段里程碑', done: false }
              ],
        nextActions
      }
    })
}

async function invokeNotesListFiles(input?: NotesListFilesInput): Promise<NotesListFilesResult> {
  const runtimeWindow = window as Window &
    Partial<{
      api: {
        notes?: {
          listFiles?: (args?: NotesListFilesInput) => Promise<NotesListFilesResult>
          readFile?: (args: NotesReadFileInput) => Promise<NotesReadFileResult>
          searchFiles?: (args: NotesSearchFilesInput) => Promise<NotesSearchFilesResult>
        }
      }
      electron: {
        ipcRenderer?: {
          invoke?: (channel: string, ...args: unknown[]) => Promise<unknown>
        }
      }
    }>

  if (runtimeWindow.api?.notes?.listFiles) {
    return runtimeWindow.api.notes.listFiles(input)
  }

  if (runtimeWindow.electron?.ipcRenderer?.invoke) {
    const parsedInput = notesListFilesInputSchema.parse(input ?? {})
    const result = await runtimeWindow.electron.ipcRenderer.invoke(NOTES_LIST_FILES_CHANNEL, parsedInput)
    return notesListFilesResultSchema.parse(result)
  }

  return {
    rootDir: input?.rootDir ?? '',
    files: [],
    truncated: false,
    error: '预加载 API 未就绪，请重启应用后重试。'
  }
}

async function invokeNotesReadFile(input: NotesReadFileInput): Promise<NotesReadFileResult> {
  const runtimeWindow = window as Window &
    Partial<{
      api: {
        notes?: {
          readFile?: (args: NotesReadFileInput) => Promise<NotesReadFileResult>
        }
      }
      electron: {
        ipcRenderer?: {
          invoke?: (channel: string, ...args: unknown[]) => Promise<unknown>
        }
      }
    }>

  if (runtimeWindow.api?.notes?.readFile) {
    return runtimeWindow.api.notes.readFile(input)
  }

  if (runtimeWindow.electron?.ipcRenderer?.invoke) {
    const parsedInput = notesReadFileInputSchema.parse(input)
    const result = await runtimeWindow.electron.ipcRenderer.invoke(NOTES_READ_FILE_CHANNEL, parsedInput)
    return notesReadFileResultSchema.parse(result)
  }

  return {
    rootDir: input.rootDir ?? '',
    relativePath: input.relativePath,
    content: '',
    truncated: false,
    error: '预加载 API 未就绪，请重启应用后重试。'
  }
}

async function invokeNotesReadAsset(input: NotesReadAssetInput): Promise<NotesReadAssetResult> {
  const runtimeWindow = window as Window &
    Partial<{
      api: {
        notes?: {
          readAsset?: (args: NotesReadAssetInput) => Promise<NotesReadAssetResult>
        }
      }
      electron: {
        ipcRenderer?: {
          invoke?: (channel: string, ...args: unknown[]) => Promise<unknown>
        }
      }
    }>

  if (runtimeWindow.api?.notes?.readAsset) {
    return runtimeWindow.api.notes.readAsset(input)
  }

  if (runtimeWindow.electron?.ipcRenderer?.invoke) {
    const parsedInput = notesReadAssetInputSchema.parse(input)
    const result = await runtimeWindow.electron.ipcRenderer.invoke(NOTES_READ_ASSET_CHANNEL, parsedInput)
    return notesReadAssetResultSchema.parse(result)
  }

  return {
    rootDir: input.rootDir ?? '',
    relativePath: input.relativePath,
    error: '预加载 API 未就绪，请重启应用后重试。'
  }
}

async function invokeNotesSearchFiles(input: NotesSearchFilesInput): Promise<NotesSearchFilesResult> {
  const runtimeWindow = window as Window &
    Partial<{
      api: {
        notes?: {
          searchFiles?: (args: NotesSearchFilesInput) => Promise<NotesSearchFilesResult>
        }
      }
      electron: {
        ipcRenderer?: {
          invoke?: (channel: string, ...args: unknown[]) => Promise<unknown>
        }
      }
    }>

  if (runtimeWindow.api?.notes?.searchFiles) {
    return runtimeWindow.api.notes.searchFiles(input)
  }

  if (runtimeWindow.electron?.ipcRenderer?.invoke) {
    const parsedInput = notesSearchFilesInputSchema.parse(input)
    const result = await runtimeWindow.electron.ipcRenderer.invoke(NOTES_SEARCH_FILES_CHANNEL, parsedInput)
    return notesSearchFilesResultSchema.parse(result)
  }

  return {
    rootDir: input.rootDir ?? '',
    query: input.query,
    files: [],
    truncated: false,
    error: '预加载 API 未就绪，请重启应用后重试。'
  }
}

type WorkspaceScreenProps = {
  settings: AppSettings
}

function WorkspaceScreen({ settings }: WorkspaceScreenProps): React.JSX.Element {
  const { pathname } = useLocation()
  const currentRoute = normalizeWorkspaceRoute(pathname)
  const workspaceConfig = workspaceConfigByRoute[currentRoute]
  const notesRootDir = settings.workspace.notesRootDir.trim() || fallbackAppSettings.workspace.notesRootDir
  const previewMaxChars = settings.preview.maxChars || DEFAULT_PREVIEW_MAX_CHARS
  const previewMaxAssetBytes = settings.preview.maxAssetBytes || DEFAULT_PREVIEW_MAX_ASSET_BYTES

  const [projectFilter, setProjectFilter] = useState<ProjectFilter>('all')
  const [projectQuery, setProjectQuery] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [projectSource, setProjectSource] = useState<ProjectRecord[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [projectsError, setProjectsError] = useState<string | null>(null)

  const [filesResult, setFilesResult] = useState<NotesListFilesResult | null>(null)
  const [filesLoading, setFilesLoading] = useState(false)
  const [filesError, setFilesError] = useState<string | null>(null)
  const [fileSearchQuery, setFileSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState<NotesSearchFilesResult | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [openFilePaths, setOpenFilePaths] = useState<string[]>([])
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [filePreview, setFilePreview] = useState<FilePreviewState | null>(null)
  const [filePreviewLoading, setFilePreviewLoading] = useState(false)
  const [fileAssetDataUrl, setFileAssetDataUrl] = useState<string | null>(null)
  const [fileAssetLoading, setFileAssetLoading] = useState(false)
  const [fileAssetError, setFileAssetError] = useState<string | null>(null)
  const [treeWidth] = useState(260)

  const loadFiles = useCallback(async (): Promise<void> => {
    setFilesLoading(true)
    setFilesError(null)

    try {
      const result = await invokeNotesListFiles({ rootDir: notesRootDir })
      setFilesResult(result)
      setFilesError(result.error ?? null)
    } catch (error) {
      setFilesResult(null)
      setFilesError(error instanceof Error ? error.message : '读取文件列表失败')
    } finally {
      setFilesLoading(false)
    }
  }, [notesRootDir])

  const loadProjectsFromNotes = useCallback(
    async (): Promise<{ projects: ProjectRecord[]; error: string | null }> => {
      const listResult = await invokeNotesListFiles({ rootDir: notesRootDir })
      const taskFiles = extractKanbanTaskFilesFromNotesFiles(listResult.files)
      const taskPayloads = await Promise.all(
        taskFiles.map(async (file) => {
          try {
            const readResult = await invokeNotesReadFile({
              rootDir: notesRootDir,
              relativePath: file.relativePath,
              maxChars: 200000
            })
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

      const parsedTasks = taskPayloads
        .filter((payload) => !payload.error)
        .map((payload) => buildTaskRecordFromNotesTaskFile(payload.file, payload.content))
      const taskFailedCount = taskPayloads.filter((payload) => payload.error).length
      const projects = buildProjectsFromNotes(listResult.files, parsedTasks)
      const errors = [listResult.error, taskFailedCount > 0 ? `任务读取失败 ${taskFailedCount} 条` : null]
        .filter(Boolean)
        .join('；')

      return {
        projects,
        error: errors.length > 0 ? errors : null
      }
    },
    [notesRootDir]
  )

  useEffect(() => {
    if (currentRoute === '/files') return

    let mounted = true
    setProjectsLoading(true)
    setProjectsError(null)

    void loadProjectsFromNotes()
      .then(({ projects, error }) => {
        if (!mounted) return
        setProjectSource(projects)
        setProjectsError(error)
      })
      .catch((error) => {
        if (!mounted) return
        setProjectSource([])
        setProjectsError(error instanceof Error ? error.message : '读取项目列表失败')
      })
      .finally(() => {
        if (mounted) setProjectsLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [currentRoute, loadProjectsFromNotes])

  useEffect(() => {
    if (currentRoute === '/files') return

    const runtimeWindow = window as Window &
      Partial<{
        api: {
          notes?: {
            onFilesChanged?: (listener: (payload: NotesFilesChangedPayload) => void) => () => void
          }
        }
      }>

    const onFilesChanged = runtimeWindow.api?.notes?.onFilesChanged
    if (!onFilesChanged) return

    let mounted = true
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const unsubscribe = onFilesChanged((payload) => {
      if (payload.rootDir !== notesRootDir) return
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        setProjectsLoading(true)
        void loadProjectsFromNotes()
          .then(({ projects, error }) => {
            if (!mounted) return
            setProjectSource(projects)
            setProjectsError(error)
          })
          .catch((error) => {
            if (!mounted) return
            setProjectsError(error instanceof Error ? error.message : '读取项目列表失败')
          })
          .finally(() => {
            if (mounted) setProjectsLoading(false)
          })
      }, 250)
    })

    return () => {
      mounted = false
      if (debounceTimer) clearTimeout(debounceTimer)
      unsubscribe()
    }
  }, [currentRoute, loadProjectsFromNotes, notesRootDir])

  useEffect(() => {
    if (currentRoute !== '/files') return

    let mounted = true

    const run = async (): Promise<void> => {
      setFilesLoading(true)
      setFilesError(null)
      try {
        const result = await invokeNotesListFiles({ rootDir: notesRootDir })
        if (!mounted) return
        setFilesResult(result)
        setFilesError(result.error ?? null)
      } catch (error) {
        if (!mounted) return
        setFilesResult(null)
        setFilesError(error instanceof Error ? error.message : '读取文件列表失败')
      } finally {
        if (mounted) setFilesLoading(false)
      }
    }

    void run()
    return () => {
      mounted = false
    }
  }, [currentRoute, notesRootDir])

  useEffect(() => {
    if (currentRoute !== '/files') return

    const runtimeWindow = window as Window &
      Partial<{
        api: {
          notes?: {
            onFilesChanged?: (listener: (payload: NotesFilesChangedPayload) => void) => () => void
          }
        }
      }>

    const onFilesChanged = runtimeWindow.api?.notes?.onFilesChanged
    if (!onFilesChanged) return

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const unsubscribe = onFilesChanged((payload) => {
      if (payload.rootDir !== notesRootDir) return
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        void loadFiles()
      }, 250)
    })

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      unsubscribe()
    }
  }, [currentRoute, loadFiles, notesRootDir])

  useEffect(() => {
    if (currentRoute !== '/files') return

    const query = fileSearchQuery.trim()
    if (!query) {
      setSearchLoading(false)
      setSearchResult(null)
      return
    }

    let mounted = true
    const timer = setTimeout(() => {
      setSearchLoading(true)
      void invokeNotesSearchFiles({
        rootDir: notesRootDir,
        query,
        limit: DEFAULT_NOTES_SEARCH_LIMIT
      })
        .then((result) => {
          if (!mounted) return
          setSearchResult(result)
        })
        .catch((error) => {
          if (!mounted) return
          setSearchResult({
            rootDir: notesRootDir,
            query,
            files: [],
            truncated: false,
            error: error instanceof Error ? error.message : '搜索失败'
          })
        })
        .finally(() => {
          if (mounted) setSearchLoading(false)
        })
    }, 220)

    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [currentRoute, fileSearchQuery, filesResult?.files, notesRootDir])

  const searchedFiles = useMemo(() => {
    const query = fileSearchQuery.trim()
    if (!query) return []
    return searchResult?.files ?? []
  }, [fileSearchQuery, searchResult?.files])

  const fileTree = useMemo(() => buildFileTree(filesResult?.files ?? []), [filesResult?.files])

  const filesByPath = useMemo(
    () => new Map((filesResult?.files ?? []).map((file) => [file.relativePath, file])),
    [filesResult?.files]
  )

  const selectedFile = useMemo(
    () => (selectedFilePath ? filesByPath.get(selectedFilePath) : undefined),
    [filesByPath, selectedFilePath]
  )

  const selectedPreviewMode = useMemo(() => getFilePreviewMode(selectedFile), [selectedFile])

  const allDirectoryPaths = useMemo(() => collectDirectoryPaths(fileTree), [fileTree])

  const filteredProjects = useMemo(() => {
    const query = projectQuery.trim().toLowerCase()
    const statusPriority: Record<ProjectStatus, number> = {
      blocked: 0,
      active: 1,
      done: 2
    }

    return projectSource
      .filter((project) => {
        if (projectFilter !== 'all' && project.status !== projectFilter) return false
        if (!query) return true
        const haystack = `${project.name} ${project.summary} ${project.owner} ${project.tags.join(' ')}`.toLowerCase()
        return haystack.includes(query)
      })
      .sort((left, right) => {
        const byStatus = statusPriority[left.status] - statusPriority[right.status]
        if (byStatus !== 0) return byStatus

        const byDue = parseSortableDate(left.dueAt) - parseSortableDate(right.dueAt)
        if (byDue !== 0) return byDue

        return parseSortableDate(right.updatedAt) - parseSortableDate(left.updatedAt)
      })
  }, [projectFilter, projectQuery, projectSource])

  const selectedProject = useMemo(
    () => filteredProjects.find((project) => project.id === selectedProjectId) ?? filteredProjects[0] ?? null,
    [filteredProjects, selectedProjectId]
  )

  const projectSummary = useMemo(() => {
    const total = projectSource.length
    const active = projectSource.filter((project) => project.status === 'active').length
    const blocked = projectSource.filter((project) => project.status === 'blocked').length
    const done = projectSource.filter((project) => project.status === 'done').length
    const avgProgress = total
      ? Math.round(projectSource.reduce((sum, project) => sum + project.progress, 0) / total)
      : 0

    return { total, active, blocked, done, avgProgress }
  }, [projectSource])

  const dashboardQuickActions = useMemo(() => {
    const statusHints: string[] = []
    if (projectsLoading) statusHints.push('正在扫描 Notes 项目目录…')
    if (projectsError) statusHints.push(`扫描提示：${projectsError}`)
    return [...statusHints, ...workspaceConfig.quickActions]
  }, [projectsError, projectsLoading, workspaceConfig.quickActions])

  const openFileInTab = useCallback((path: string): void => {
    setOpenFilePaths((prev) => (prev.includes(path) ? prev : [...prev, path]))
    setSelectedFilePath(path)
  }, [])

  const closeFileTab = useCallback((path: string): void => {
    setOpenFilePaths((prev) => {
      const next = prev.filter((item) => item !== path)
      setSelectedFilePath((current) => (current === path ? (next[next.length - 1] ?? null) : current))
      return next
    })
  }, [])

  const closeOtherTabs = useCallback((keepPath: string): void => {
    setOpenFilePaths((prev) => {
      if (!prev.includes(keepPath)) return prev
      setSelectedFilePath(keepPath)
      return [keepPath]
    })
  }, [])

  useEffect(() => {
    if (currentRoute !== '/files') return
    setExpandedPaths((prev) => {
      const validPaths = new Set(allDirectoryPaths)
      return new Set([...prev].filter((path) => validPaths.has(path)))
    })
  }, [currentRoute, allDirectoryPaths])

  useEffect(() => {
    if (currentRoute !== '/files') return

    const validPaths = new Set((filesResult?.files ?? []).map((file) => file.relativePath))

    if (validPaths.size === 0) {
      setOpenFilePaths([])
      setSelectedFilePath(null)
      setFilePreview(null)
      return
    }

    setOpenFilePaths((prev) => {
      const next = prev.filter((path) => validPaths.has(path))
      setSelectedFilePath((current) => {
        if (current && validPaths.has(current) && next.includes(current)) return current
        return next[next.length - 1] ?? null
      })
      return next
    })
  }, [currentRoute, filesResult?.files])

  useEffect(() => {
    if (currentRoute !== '/files' || !selectedFilePath || !selectedFile) {
      setFilePreview(null)
      setFilePreviewLoading(false)
      setFileAssetDataUrl(null)
      setFileAssetError(null)
      setFileAssetLoading(false)
      return
    }

    let mounted = true

    const run = async (): Promise<void> => {
      if (selectedPreviewMode === 'image' || selectedPreviewMode === 'pdf') {
        setFilePreview(null)
        setFilePreviewLoading(false)
        setFileAssetLoading(true)
        setFileAssetError(null)
        try {
          const result = await invokeNotesReadAsset({
            rootDir: notesRootDir,
            relativePath: selectedFilePath,
            maxBytes: previewMaxAssetBytes
          })
          if (!mounted) return
          setFileAssetDataUrl(result.dataUrl ?? null)
          setFileAssetError(result.error ?? null)
        } catch (error) {
          if (!mounted) return
          setFileAssetDataUrl(null)
          setFileAssetError(error instanceof Error ? error.message : '读取媒体预览失败')
        } finally {
          if (mounted) setFileAssetLoading(false)
        }
        return
      }

      if (selectedPreviewMode === 'unsupported') {
        setFilePreview(null)
        setFilePreviewLoading(false)
        setFileAssetDataUrl(null)
        setFileAssetError(null)
        setFileAssetLoading(false)
        return
      }

      setFileAssetDataUrl(null)
      setFileAssetError(null)
      setFileAssetLoading(false)
      setFilePreviewLoading(true)

      try {
        const result = await invokeNotesReadFile({
          rootDir: notesRootDir,
          relativePath: selectedFilePath,
          maxChars: previewMaxChars
        })
        if (!mounted) return
        setFilePreview({
          content: result.content,
          truncated: result.truncated,
          error: result.error ?? null
        })
      } catch (error) {
        if (!mounted) return
        setFilePreview({
          content: '',
          truncated: false,
          error: error instanceof Error ? error.message : '读取文件预览失败'
        })
      } finally {
        if (mounted) setFilePreviewLoading(false)
      }
    }

    void run()
    return () => {
      mounted = false
    }
  }, [
    currentRoute,
    selectedFilePath,
    selectedFile,
    selectedPreviewMode,
    notesRootDir,
    previewMaxChars,
    previewMaxAssetBytes
  ])

  useEffect(() => {
    if (currentRoute === '/files') return
    if (filteredProjects.length === 0) {
      setSelectedProjectId('')
      return
    }
    if (!filteredProjects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(filteredProjects[0].id)
    }
  }, [currentRoute, filteredProjects, selectedProjectId])

  if (currentRoute === '/files') {
    return (
      <FilesPage
        filePreviewCharLimit={previewMaxChars}
        treeWidth={treeWidth}
        fileSearchQuery={fileSearchQuery}
        filesLoading={filesLoading}
        searchedFiles={searchedFiles}
        searchLoading={searchLoading}
        searchTruncated={Boolean(searchResult?.truncated)}
        searchError={searchResult?.error}
        filesError={filesError}
        fileTree={fileTree}
        selectedFilePath={selectedFilePath}
        expandedPaths={expandedPaths}
        openFilePaths={openFilePaths}
        selectedFile={selectedFile}
        selectedPreviewMode={selectedPreviewMode}
        filePreviewLoading={filePreviewLoading}
        filePreview={filePreview}
        fileAssetLoading={fileAssetLoading}
        fileAssetError={fileAssetError}
        fileAssetDataUrl={fileAssetDataUrl}
        onFileSearchQueryChange={setFileSearchQuery}
        onToggleDirectory={(path) =>
          setExpandedPaths((prev) => {
            const next = new Set(prev)
            if (next.has(path)) next.delete(path)
            else next.add(path)
            return next
          })
        }
        onOpenFile={openFileInTab}
        onSelectOpenFile={setSelectedFilePath}
        onCloseOpenFile={closeFileTab}
        onCloseOtherFiles={closeOtherTabs}
      />
    )
  }

  return (
    <ProjectDashboardPage
      workspaceTitle={workspaceConfig.title}
      dashboardName={workspaceDashboardMeta.name}
      heroTone={workspaceConfig.heroTone}
      quickActions={dashboardQuickActions}
      projectQuery={projectQuery}
      projectFilter={projectFilter}
      projectFilterOptions={projectFilterOptions}
      projectSummary={projectSummary}
      filteredProjects={filteredProjects}
      selectedProject={selectedProject}
      onProjectQueryChange={setProjectQuery}
      onProjectFilterChange={setProjectFilter}
      onSelectProject={setSelectedProjectId}
      projectStatusLabel={projectStatusLabel}
      projectStatusClass={projectStatusClass}
      projectRiskLabel={projectRiskLabel}
      projectRiskClass={projectRiskClass}
    />
  )
}

function App(): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(() => fallbackAppSettings)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  const loadSettings = useCallback(async (): Promise<void> => {
    setSettingsLoading(true)
    try {
      const result = await invokeSettingsGet()
      setSettings(result.settings)
      setSettingsError(result.error ?? null)
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : '加载设置失败')
    } finally {
      setSettingsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  useEffect(() => {
    setI18nLanguage(settings.workspace.language)
  }, [settings.workspace.language])

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to={settings.workspace.defaultRoute} replace />} />
        <Route path="/notes" element={<WorkspaceScreen settings={settings} />} />
        <Route path="/files" element={<WorkspaceScreen settings={settings} />} />
        <Route path="/journal" element={<WorkspaceScreen settings={settings} />} />
        <Route path="/kanban" element={<KanbanPage />} />
        <Route path="/draw" element={<DrawStudioPage />} />
        <Route path="/imagen" element={<ImagenPage />} />
        <Route path="/chat" element={<ChatPage settings={settings} />} />
        <Route
          path="/settings"
          element={
            <SettingsPage
              settings={settings}
              settingsLoading={settingsLoading}
              settingsError={settingsError}
              onSettingsChanged={(next) => {
                setSettings(next)
                setSettingsError(null)
              }}
              onRefreshSettings={loadSettings}
            />
          }
        />
        <Route path="*" element={<Navigate to={settings.workspace.defaultRoute} replace />} />
      </Routes>
      <Toaster position="bottom-left" richColors closeButton />
    </>
  )
}

export default App
