import { preloadReactRenderers, type ThemeMode } from '@renderer/lib/markdownToReact'

let preloadPromise: Promise<void> | null = null

export function ensureMarkdownPipelinePreloaded(modes?: ThemeMode[]): Promise<void> {
  if (!preloadPromise) {
    const targetModes = modes && modes.length > 0 ? modes : undefined
    preloadPromise = preloadReactRenderers(targetModes)
  }

  return preloadPromise
}

export function stripFrontmatter(content?: string): string {
  if (!content) return ''

  const lines = content.split(/\r?\n/)
  if (lines[0]?.trim() === '---') {
    for (let index = 1; index < lines.length; index += 1) {
      if (lines[index]?.trim() === '---') {
        return lines.slice(index + 1).join('\n')
      }
    }
  }

  return content
}
