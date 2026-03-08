import { lazy, Suspense, useMemo } from 'react'
import { parseExcalidrawContent } from '@renderer/lib/excalidraw'
import { cn } from '@renderer/lib/utils'
import '@excalidraw/excalidraw/index.css'

const LazyExcalidraw = lazy(async () => {
  const module = await import('@excalidraw/excalidraw')
  return { default: module.Excalidraw as React.ComponentType<Record<string, unknown>> }
})

export interface ExcalidrawPreviewProps {
  content: string
  className?: string
}

const VIEW_ONLY_UI_OPTIONS: Record<string, unknown> = {
  canvasActions: {
    changeViewBackgroundColor: false,
    clearCanvas: false,
    export: false,
    loadScene: false,
    saveAsImage: false,
    saveToActiveFile: false,
    toggleTheme: false
  }
}

export function ExcalidrawPreview({ content, className }: ExcalidrawPreviewProps): React.JSX.Element {
  const { scene, error } = useMemo(() => parseExcalidrawContent(content), [content])

  if (error) {
    return (
      <div className={cn('rounded-md border border-border/70 bg-card/70 p-3', className)}>
        <p className="text-sm text-destructive">{error}</p>
        <pre className="mt-2 overflow-auto text-xs leading-relaxed whitespace-pre-wrap break-words text-muted-foreground">
          {content || '(空文件)'}
        </pre>
      </div>
    )
  }

  if (!scene) {
    return (
      <div className={cn('rounded-md border border-border/70 bg-card/70 p-3', className)}>
        <p className="text-sm text-muted-foreground">暂无可渲染的 Excalidraw 场景。</p>
      </div>
    )
  }

  return (
    <div className={cn('h-[78vh] overflow-hidden rounded-md border border-border/70 bg-card/70', className)}>
      <Suspense
        fallback={<p className="p-3 text-sm text-muted-foreground">正在加载 Excalidraw 预览…</p>}
      >
        <LazyExcalidraw
          viewModeEnabled
          zenModeEnabled
          gridModeEnabled
          UIOptions={VIEW_ONLY_UI_OPTIONS}
          initialData={{
            elements: scene.elements,
            appState: {
              ...(scene.appState ?? {}),
              viewModeEnabled: true,
              zenModeEnabled: true,
              gridModeEnabled: true
            },
            files: scene.files ?? {}
          }}
        />
      </Suspense>
    </div>
  )
}
