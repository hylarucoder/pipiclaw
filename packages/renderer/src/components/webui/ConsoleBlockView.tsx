import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { i18n } from '@renderer/features/webui/utils/i18n.js'

export interface ConsoleBlockProps {
  content: string
  variant?: 'default' | 'error'
}

export function ConsoleBlockView({
  content,
  variant = 'default'
}: ConsoleBlockProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
  }, [content])

  const textClass = useMemo(
    () => (variant === 'error' ? 'text-destructive' : 'text-foreground'),
    [variant]
  )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content || '')
      setCopied(true)
      window.setTimeout(() => {
        setCopied(false)
      }, 1500)
    } catch (error) {
      console.error('Copy failed', error)
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted px-3 py-1.5">
        <span className="font-mono text-xs text-muted-foreground">{i18n('console')}</span>
        <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={copy} title={i18n('Copy output')}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? <span>{i18n('Copied!')}</span> : null}
        </Button>
      </div>
      <div ref={scrollRef} className="max-h-64 overflow-auto">
        <pre className={`m-0 whitespace-pre-wrap bg-background p-3 font-mono text-xs ${textClass}`}>{content || ''}</pre>
      </div>
    </div>
  )
}
