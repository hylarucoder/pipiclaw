import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'
import { ensureMarkdownPipelinePreloaded, stripFrontmatter } from '@renderer/lib/markdown'
import { renderMarkdownToReact, type ThemeMode } from '@renderer/lib/markdownToReact'

export interface MarkdownReactContentProps {
  markdown: string
  stripFrontmatter?: boolean
  className?: string
  themeMode?: ThemeMode
}

function detectThemeMode(): ThemeMode {
  if (typeof document === 'undefined') return 'light'

  if (document.documentElement.classList.contains('dark')) {
    return 'dark'
  }

  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }

  return 'light'
}

export function MarkdownReactContent({
  markdown,
  stripFrontmatter: shouldStripFrontmatter = true,
  className,
  themeMode
}: MarkdownReactContentProps): React.JSX.Element {
  const [content, setContent] = useState<ReactNode | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [detectedThemeMode, setDetectedThemeMode] = useState<ThemeMode>(detectThemeMode())
  const resolvedThemeMode = themeMode ?? detectedThemeMode

  const processedMarkdown = useMemo(
    () => (shouldStripFrontmatter ? stripFrontmatter(markdown) : markdown),
    [shouldStripFrontmatter, markdown]
  )

  useEffect(() => {
    if (themeMode) return

    const updateTheme = (): void => {
      setDetectedThemeMode(detectThemeMode())
    }

    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => {
      observer.disconnect()
    }
  }, [themeMode])

  useEffect(() => {
    void ensureMarkdownPipelinePreloaded(['light', 'dark'])
  }, [])

  useEffect(() => {
    let cancelled = false

    if (!processedMarkdown.trim()) return

    // Reset the loading state before starting a new async markdown render.
    setIsLoading(true)
    void renderMarkdownToReact(processedMarkdown, resolvedThemeMode)
      .then((result) => {
        if (!cancelled) setContent(result)
      })
      .catch((error: unknown) => {
        console.error('[MarkdownReactContent] render failed:', error)
        if (!cancelled) setContent(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [processedMarkdown, resolvedThemeMode])

  if (!processedMarkdown.trim()) {
    return (
      <div className={cn('markdown-body', className)}>
        <p>(空文档)</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={cn('markdown-body', className)}>
        <p className="text-sm text-muted-foreground">正在渲染 Markdown…</p>
      </div>
    )
  }

  return <div className={cn('markdown-body', className)}>{content}</div>
}
