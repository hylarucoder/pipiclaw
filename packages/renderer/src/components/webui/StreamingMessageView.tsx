import { useEffect, useRef, useState } from 'react'
import type { AgentMessage, AgentTool } from '@pipiclaw/agent-core'
import type {
  AssistantMessage as AssistantMessageType,
  ToolResultMessage as ToolResultMessageType
} from '@mariozechner/pi-ai'
import { AssistantMessageElement } from './MessageElementsView'

export interface StreamingMessageViewProps {
  message: AgentMessage | null
  tools: AgentTool<any>[]
  isStreaming: boolean
  pendingToolCalls?: Set<string>
  toolResultsById?: Map<string, ToolResultMessageType>
  onCostClick?: () => void
}

export function StreamingMessageView({
  message,
  tools,
  isStreaming,
  pendingToolCalls,
  toolResultsById,
  onCostClick
}: StreamingMessageViewProps): React.JSX.Element | null {
  const [renderedMessage, setRenderedMessage] = useState<AgentMessage | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    if (message === null) {
      setRenderedMessage(null)
      return
    }

    if (!isStreaming) {
      setRenderedMessage(message)
      return
    }

    rafRef.current = requestAnimationFrame(() => {
      setRenderedMessage(JSON.parse(JSON.stringify(message)) as AgentMessage)
      rafRef.current = null
    })

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [isStreaming, message])

  if (!renderedMessage) {
    return isStreaming ? (
      <div className="mb-3 flex flex-col gap-3">
        <span className="mx-4 inline-block h-4 w-2 animate-pulse bg-muted-foreground" />
      </div>
    ) : null
  }

  if (renderedMessage.role !== 'assistant') return null

  return (
    <div className="mb-3 flex flex-col gap-3">
      <AssistantMessageElement
        message={renderedMessage as AssistantMessageType}
        tools={tools}
        pendingToolCalls={pendingToolCalls}
        toolResultsById={toolResultsById}
        isStreaming={isStreaming}
        hidePendingToolCalls={false}
        onCostClick={onCostClick}
      />
      {isStreaming ? (
        <span className="mx-4 inline-block h-4 w-2 animate-pulse bg-muted-foreground" />
      ) : null}
    </div>
  )
}
