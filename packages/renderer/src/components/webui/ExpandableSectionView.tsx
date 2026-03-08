import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

export interface ExpandableSectionProps {
  summary: string
  defaultExpanded?: boolean
  children?: React.ReactNode
}

export function ExpandableSectionView({
  summary,
  defaultExpanded = false,
  children
}: ExpandableSectionProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setExpanded((prev) => !prev)
        }}
        className="inline-flex w-full items-center justify-start gap-2 rounded-md px-0 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <span>{summary}</span>
      </button>
      {expanded ? <div className="mt-2">{children}</div> : null}
    </div>
  )
}
