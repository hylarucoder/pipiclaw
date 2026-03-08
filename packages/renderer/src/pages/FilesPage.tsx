import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, FileText, FolderOpenDot, X } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { CanvasX6Preview } from '@renderer/components/CanvasX6Preview'
import { Card, CardContent } from '@renderer/components/ui/card'
import { ExcalidrawPreview } from '@renderer/components/ExcalidrawPreview'
import { NavigationRail } from '@renderer/components/NavigationRail'
import { Input } from '@renderer/components/ui/input'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { MarkdownReactContent } from '@renderer/components/MarkdownReactContent'
import { cn } from '@renderer/lib/utils'
import { type NotesFileItem } from '@pipiclaw/shared/rpc/notes'
import type { FilePreviewMode, FilePreviewState, FileTreeNode } from '@renderer/pages/files-types'

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatFileUpdatedAt(isoDate: string): string {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getPathBasename(path: string): string {
  const segments = path.split('/').filter(Boolean)
  return segments[segments.length - 1] ?? path
}

function FileTreeNodeRow({
  node,
  depth = 0,
  selectedPath,
  expandedPaths,
  onToggleDirectory,
  onOpenFile
}: {
  node: FileTreeNode
  depth?: number
  selectedPath: string | null
  expandedPaths: Set<string>
  onToggleDirectory: (path: string) => void
  onOpenFile: (path: string) => void
}): React.JSX.Element {
  const isDirectory = node.kind === 'directory'
  const isExpanded = isDirectory ? expandedPaths.has(node.path) : false
  const isSelected = !isDirectory && selectedPath === node.path

  return (
    <div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={cn(
          'h-auto w-full items-center justify-start gap-1.5 py-0.5 pr-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted/45',
          isSelected && 'bg-primary/12 text-primary'
        )}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
        title={node.path}
        onClick={() => {
          if (isDirectory) {
            onToggleDirectory(node.path)
            return
          }
          onOpenFile(node.path)
        }}
      >
        {isDirectory ? (
          isExpanded ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="size-3.5 shrink-0" />
        )}
        {isDirectory ? (
          <FolderOpenDot className="size-4 shrink-0 text-primary" />
        ) : (
          <FileText className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{node.name}</span>
        {!isDirectory && node.file && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            {formatFileSize(node.file.size)}
          </span>
        )}
      </Button>
      {isDirectory &&
        isExpanded &&
        node.children.map((child) => (
          <FileTreeNodeRow
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            expandedPaths={expandedPaths}
            onToggleDirectory={onToggleDirectory}
            onOpenFile={onOpenFile}
          />
        ))}
    </div>
  )
}

export interface FilesPageProps {
  filePreviewCharLimit: number
  treeWidth: number
  fileSearchQuery: string
  filesLoading: boolean
  searchedFiles: NotesFileItem[]
  searchLoading: boolean
  searchTruncated: boolean
  searchError?: string | null
  filesError?: string | null
  fileTree: FileTreeNode[]
  selectedFilePath: string | null
  expandedPaths: Set<string>
  openFilePaths: string[]
  selectedFile?: NotesFileItem
  selectedPreviewMode: FilePreviewMode
  filePreviewLoading: boolean
  filePreview: FilePreviewState | null
  fileAssetLoading: boolean
  fileAssetError: string | null
  fileAssetDataUrl: string | null
  onFileSearchQueryChange: (query: string) => void
  onToggleDirectory: (path: string) => void
  onOpenFile: (path: string) => void
  onSelectOpenFile: (path: string) => void
  onCloseOpenFile: (path: string) => void
  onCloseOtherFiles: (path: string) => void
}

export function FilesPage({
  filePreviewCharLimit,
  treeWidth,
  fileSearchQuery,
  filesLoading,
  searchedFiles,
  searchLoading,
  searchTruncated,
  searchError,
  filesError,
  fileTree,
  selectedFilePath,
  expandedPaths,
  openFilePaths,
  selectedFile,
  selectedPreviewMode,
  filePreviewLoading,
  filePreview,
  fileAssetLoading,
  fileAssetError,
  fileAssetDataUrl,
  onFileSearchQueryChange,
  onToggleDirectory,
  onOpenFile,
  onSelectOpenFile,
  onCloseOpenFile,
  onCloseOtherFiles
}: FilesPageProps): React.JSX.Element {
  const commandInputRef = useRef<HTMLInputElement>(null)
  const tabContextMenuRef = useRef<HTMLDivElement>(null)
  const [isCommandOpen, setIsCommandOpen] = useState(false)
  const [activeSearchIndex, setActiveSearchIndex] = useState(0)
  const [tabContextMenu, setTabContextMenu] = useState<{
    path: string
    x: number
    y: number
  } | null>(null)
  const trimmedSearchQuery = fileSearchQuery.trim()
  const hasSearchQuery = trimmedSearchQuery.length > 0
  const activeSearchFile = hasSearchQuery ? searchedFiles[activeSearchIndex] : undefined
  const commandResultCountLabel = useMemo(() => {
    if (searchLoading) return '搜索中…'
    if (!hasSearchQuery) return '输入关键字搜索文件'
    if (searchError) return searchError
    if (searchedFiles.length === 0) return '未找到匹配文件'
    if (searchTruncated) return `显示前 ${searchedFiles.length} 条结果`
    return `找到 ${searchedFiles.length} 个文件`
  }, [hasSearchQuery, searchError, searchLoading, searchTruncated, searchedFiles.length])

  const closeCommandDialog = (): void => {
    setIsCommandOpen(false)
    setActiveSearchIndex(0)
    onFileSearchQueryChange('')
  }

  const openFileFromCommand = (path: string): void => {
    onOpenFile(path)
    closeCommandDialog()
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase()
      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault()
        setIsCommandOpen(true)
        return
      }
      if (key === 'escape') {
        setTabContextMenu(null)
        if (isCommandOpen) {
          event.preventDefault()
          setIsCommandOpen(false)
          setActiveSearchIndex(0)
          onFileSearchQueryChange('')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isCommandOpen, onFileSearchQueryChange])

  useEffect(() => {
    if (!isCommandOpen) return
    const timer = window.setTimeout(() => {
      commandInputRef.current?.focus()
      commandInputRef.current?.select()
    }, 0)
    return () => {
      window.clearTimeout(timer)
    }
  }, [isCommandOpen])

  useEffect(() => {
    setActiveSearchIndex((current) => {
      if (!hasSearchQuery || searchedFiles.length === 0) return 0
      return Math.min(current, searchedFiles.length - 1)
    })
  }, [hasSearchQuery, searchedFiles.length])

  useEffect(() => {
    if (!tabContextMenu) return

    const handlePointerDown = (event: MouseEvent): void => {
      if (tabContextMenuRef.current?.contains(event.target as Node)) return
      setTabContextMenu(null)
    }

    const handleAnyScroll = (): void => {
      setTabContextMenu(null)
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('scroll', handleAnyScroll, true)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('scroll', handleAnyScroll, true)
    }
  }, [tabContextMenu])

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="[-webkit-app-region:drag] h-8 shrink-0 border-b border-border/70 bg-card/70 px-2.5">
        <div className="flex h-full items-center text-xs text-muted-foreground">
          <span className="font-medium tracking-wide text-foreground">PiPiClaw Workspace</span>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-x-auto p-2">
        <div className="grid h-full min-w-[1080px] w-full gap-2 grid-cols-[44px_minmax(0,1fr)]">
          <NavigationRail />

          <Card className="h-full overflow-hidden">
            <CardContent className="flex h-full min-h-0 flex-col gap-1.5 p-2 pt-2">
              <div className="min-h-0 flex flex-1 gap-1.5">
                <ScrollArea
                  className="min-h-0 shrink-0 overflow-auto rounded-md border border-border/35 bg-background/25 p-1"
                  style={{ width: `${treeWidth}px` }}
                >
                  {filesLoading && fileTree.length === 0 ? (
                    <p className="p-1.5 text-sm text-muted-foreground">正在读取文件树…</p>
                  ) : filesError ? (
                    <p className="p-1.5 text-sm text-destructive">{filesError}</p>
                  ) : fileTree.length > 0 ? (
                    <div className="space-y-px">
                      {fileTree.map((node) => (
                        <FileTreeNodeRow
                          key={node.path}
                          node={node}
                          selectedPath={selectedFilePath}
                          expandedPaths={expandedPaths}
                          onToggleDirectory={onToggleDirectory}
                          onOpenFile={onOpenFile}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="p-1.5 text-sm text-muted-foreground">
                      暂无可展示文件。请确认目录可访问后再刷新。
                    </p>
                  )}
                </ScrollArea>

                <div className="min-h-0 min-w-0 flex flex-1 flex-col overflow-hidden rounded-md border border-border/55 bg-background/35">
                  <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border/55 px-2 py-1.5">
                    {openFilePaths.length === 0 ? (
                      <span className="text-xs text-muted-foreground">暂无已打开文件</span>
                    ) : (
                      openFilePaths.map((path) => {
                        const isActive = selectedFilePath === path
                        return (
                          <div
                            key={path}
                            className={cn(
                              'group flex max-w-[280px] items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
                              isActive
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-card/75 hover:text-foreground'
                            )}
                            onContextMenu={(event) => {
                              event.preventDefault()
                              setTabContextMenu({
                                path,
                                x: event.clientX,
                                y: event.clientY
                              })
                            }}
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-auto truncate p-0 text-left"
                              title={path}
                              onClick={() => onSelectOpenFile(path)}
                            >
                              {getPathBasename(path)}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-5 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                              title={`关闭 ${getPathBasename(path)}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                onCloseOpenFile(path)
                              }}
                            >
                              <X className="size-3" />
                            </Button>
                          </div>
                        )
                      })
                    )}
                  </div>

                  <div className="min-h-0 flex-1 overflow-auto p-2">
                    {!selectedFilePath ? (
                      <p className="text-sm text-muted-foreground">点击左侧文件打开并在此预览。</p>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {selectedFilePath}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {selectedFile
                                ? `${formatFileSize(selectedFile.size)} · ${formatFileUpdatedAt(selectedFile.updatedAt)}`
                                : '-'}
                            </p>
                          </div>
                        </div>

                        {selectedPreviewMode === 'image' && (
                          <>
                            {fileAssetLoading ? (
                              <p className="text-sm text-muted-foreground">正在加载图片…</p>
                            ) : fileAssetError ? (
                              <p className="text-sm text-destructive">{fileAssetError}</p>
                            ) : fileAssetDataUrl ? (
                              <div className="flex min-h-[320px] items-center justify-center rounded-md bg-card/70 p-2">
                                <img
                                  src={fileAssetDataUrl}
                                  alt={selectedFilePath}
                                  className="max-h-[78vh] max-w-full object-contain"
                                />
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                当前图片暂无可用预览。
                              </p>
                            )}
                          </>
                        )}

                        {selectedPreviewMode === 'pdf' && (
                          <>
                            {fileAssetLoading ? (
                              <p className="text-sm text-muted-foreground">正在加载 PDF…</p>
                            ) : fileAssetError ? (
                              <p className="text-sm text-destructive">{fileAssetError}</p>
                            ) : fileAssetDataUrl ? (
                              <iframe
                                title={selectedFilePath}
                                src={fileAssetDataUrl}
                                className="h-[78vh] w-full rounded-md bg-card/70"
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                当前 PDF 暂无可用预览。
                              </p>
                            )}
                          </>
                        )}

                        {selectedPreviewMode === 'markdown' && (
                          <>
                            {filePreviewLoading ? (
                              <p className="text-sm text-muted-foreground">正在加载 Markdown…</p>
                            ) : filePreview?.error ? (
                              <p className="text-sm text-destructive">{filePreview.error}</p>
                            ) : (
                              <MarkdownReactContent
                                markdown={filePreview?.content || ''}
                                className="rounded-md bg-card/70 p-2.5 text-sm text-foreground"
                              />
                            )}
                          </>
                        )}

                        {selectedPreviewMode === 'canvas' && (
                          <>
                            {filePreviewLoading ? (
                              <p className="text-sm text-muted-foreground">正在加载 Canvas…</p>
                            ) : filePreview?.error ? (
                              <p className="text-sm text-destructive">{filePreview.error}</p>
                            ) : (
                              <CanvasX6Preview
                                canvasPath={selectedFilePath}
                                content={filePreview?.content || ''}
                                onOpenFile={onOpenFile}
                              />
                            )}
                          </>
                        )}

                        {selectedPreviewMode === 'excalidraw' && (
                          <>
                            {filePreviewLoading ? (
                              <p className="text-sm text-muted-foreground">正在加载 Excalidraw…</p>
                            ) : filePreview?.error ? (
                              <p className="text-sm text-destructive">{filePreview.error}</p>
                            ) : (
                              <ExcalidrawPreview content={filePreview?.content || ''} />
                            )}
                          </>
                        )}

                        {selectedPreviewMode === 'text' && (
                          <>
                            {filePreviewLoading ? (
                              <p className="text-sm text-muted-foreground">正在加载预览…</p>
                            ) : filePreview?.error ? (
                              <p className="text-sm text-destructive">{filePreview.error}</p>
                            ) : (
                              <pre className="overflow-auto rounded-md bg-card/70 p-2 text-xs leading-relaxed whitespace-pre-wrap break-words">
                                {filePreview?.content || '(空文件)'}
                              </pre>
                            )}
                          </>
                        )}

                        {selectedPreviewMode === 'unsupported' && (
                          <p className="text-sm text-muted-foreground">
                            当前文件类型暂不支持内嵌预览，请用系统应用打开。
                          </p>
                        )}

                        {(selectedPreviewMode === 'markdown' ||
                          selectedPreviewMode === 'canvas' ||
                          selectedPreviewMode === 'excalidraw' ||
                          selectedPreviewMode === 'text') &&
                          filePreview?.truncated && (
                            <p className="text-xs text-muted-foreground">
                              仅预览前 {filePreviewCharLimit} 个字符。
                            </p>
                          )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {tabContextMenu && (
        <div
          className="fixed inset-0 z-40"
          onMouseDown={() => setTabContextMenu(null)}
          onContextMenu={(event) => event.preventDefault()}
        >
          <Card
            ref={tabContextMenuRef}
            className="absolute w-36 border-border/80 bg-card/98 p-1"
            style={{ left: `${tabContextMenu.x}px`, top: `${tabContextMenu.y}px` }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-full justify-start px-2 text-xs"
              onClick={() => {
                onCloseOpenFile(tabContextMenu.path)
                setTabContextMenu(null)
              }}
            >
              关闭当前
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-full justify-start px-2 text-xs"
              onClick={() => {
                onCloseOtherFiles(tabContextMenu.path)
                setTabContextMenu(null)
              }}
            >
              关闭其他
            </Button>
          </Card>
        </div>
      )}

      {isCommandOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-background/50 p-4 pt-16 backdrop-blur-[1px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCommandDialog()
          }}
        >
          <Card
            className="w-full max-w-2xl overflow-hidden border-border/80 bg-card/98"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="border-b border-border/70 p-2">
              <Input
                ref={commandInputRef}
                value={fileSearchQuery}
                onChange={(event) => {
                  setActiveSearchIndex(0)
                  onFileSearchQueryChange(event.target.value)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    closeCommandDialog()
                    return
                  }
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    if (searchedFiles.length === 0) return
                    setActiveSearchIndex((current) => (current + 1) % searchedFiles.length)
                    return
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    if (searchedFiles.length === 0) return
                    setActiveSearchIndex(
                      (current) => (current - 1 + searchedFiles.length) % searchedFiles.length
                    )
                    return
                  }
                  if (event.key === 'Enter' && activeSearchFile) {
                    event.preventDefault()
                    openFileFromCommand(activeSearchFile.relativePath)
                  }
                }}
                placeholder="输入文件名，回车打开…"
                className="h-9 text-sm"
              />
              <p className="mt-1 px-1 text-[11px] text-muted-foreground">{commandResultCountLabel}</p>
            </div>

            <ScrollArea className="max-h-[58vh] p-1.5">
              {hasSearchQuery && searchedFiles.length > 0 ? (
                <div className="space-y-1">
                  {searchedFiles.map((file, index) => (
                    <Button
                      key={file.relativePath}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'h-8 w-full justify-start truncate px-2 text-xs',
                        activeSearchIndex === index && 'bg-primary/12 text-primary'
                      )}
                      title={file.relativePath}
                      onMouseEnter={() => setActiveSearchIndex(index)}
                      onClick={() => openFileFromCommand(file.relativePath)}
                    >
                      {file.relativePath}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="px-2 py-2 text-xs text-muted-foreground">
                  通过命令面板搜索文件，左侧文件树保持完整目录结构。
                </p>
              )}
            </ScrollArea>
          </Card>
        </div>
      )}
    </div>
  )
}
