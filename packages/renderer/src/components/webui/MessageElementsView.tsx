import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentTool } from '@pipiclaw/agent-core'
import type {
  AssistantMessage as AssistantMessageType,
  ToolCall,
  ToolResultMessage as ToolResultMessageType,
  UserMessage as UserMessageType
} from '@mariozechner/pi-ai'
import { render as renderLit, nothing as litNothing, type TemplateResult } from 'lit-html'
import { ChevronRight } from 'lucide-react'
import { MarkdownReactContent } from '../MarkdownReactContent'
import type { UserMessageWithAttachments } from '@renderer/features/webui/components/Messages.js'
import { renderTool } from '@renderer/features/webui/tools/index.js'
import { formatUsage } from '@renderer/features/webui/utils/format.js'
import { i18n } from '@renderer/features/webui/utils/i18n.js'
import { AttachmentTileView } from './AttachmentTileView'

function MarkdownBlockView({
  content
}: {
  content: string
}): React.JSX.Element {
  return <MarkdownReactContent markdown={content} stripFrontmatter={false} />
}

function ThinkingBlockView({
  content,
  isStreaming
}: {
  content: string
  isStreaming: boolean
}): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const shimmerClasses = isStreaming
    ? 'animate-shimmer bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-[length:200%_100%] bg-clip-text text-transparent'
    : ''

  return (
    <div className="thinking-block">
      <div
        className="thinking-header flex cursor-pointer select-none items-center gap-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <span className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
          <ChevronRight className="size-4" />
        </span>
        <span className={shimmerClasses}>Thinking...</span>
      </div>
      {isExpanded ? <MarkdownBlockView content={content} /> : null}
    </div>
  )
}

function LitTemplateContent({
  template,
  className
}: {
  template: TemplateResult
  className?: string
}): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    renderLit(template, container)
    return () => {
      renderLit(litNothing, container)
    }
  }, [template])

  return <div ref={containerRef} className={className} />
}

function ToolMessageView({
  toolCall,
  tool,
  result,
  pending,
  aborted,
  isStreaming
}: {
  toolCall: ToolCall
  tool?: AgentTool<any>
  result?: ToolResultMessageType
  pending: boolean
  aborted: boolean
  isStreaming: boolean
}): React.JSX.Element {
  const toolName = tool?.name || toolCall.name

  const renderResult = useMemo(
    () => {
      const normalizedResult = aborted
        ? ({
            role: 'toolResult',
            isError: true,
            content: [],
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            timestamp: Date.now()
          } satisfies ToolResultMessageType)
        : result

      return renderTool(
        toolName,
        toolCall.arguments,
        normalizedResult,
        !aborted && (isStreaming || pending)
      )
    },
    [aborted, isStreaming, pending, result, toolCall.arguments, toolCall.id, toolCall.name, toolName]
  )

  if (renderResult.isCustom) {
    return <LitTemplateContent template={renderResult.content} className="contents" />
  }

  return (
    <div className="rounded-md border border-border bg-card p-2.5 text-card-foreground shadow-xs">
      <LitTemplateContent template={renderResult.content} />
    </div>
  )
}

export function UserMessageElement({
  message
}: {
  message: UserMessageType | UserMessageWithAttachments
}): React.JSX.Element {
  const content = useMemo(
    () =>
      typeof message.content === 'string'
        ? message.content
        : message.content.find((chunk) => chunk.type === 'text')?.text || '',
    [message.content]
  )

  const attachments =
    message.role === 'user-with-attachments' && message.attachments ? message.attachments : []

  return (
    <div className="mx-4 flex justify-start">
      <div className="user-message-container rounded-xl px-4 py-2">
        <MarkdownBlockView content={content} />
        {attachments.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <AttachmentTileView key={attachment.id} attachment={attachment} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function AssistantMessageElement({
  message,
  tools,
  pendingToolCalls,
  toolResultsById,
  isStreaming,
  hidePendingToolCalls,
  onCostClick
}: {
  message: AssistantMessageType
  tools: AgentTool<any>[]
  pendingToolCalls?: Set<string>
  toolResultsById?: Map<string, ToolResultMessageType>
  isStreaming: boolean
  hidePendingToolCalls: boolean
  onCostClick?: () => void
}): React.JSX.Element {
  const orderedParts = useMemo(() => {
    const parts: React.JSX.Element[] = []

    message.content.forEach((chunk, index) => {
      if (chunk.type === 'text' && chunk.text.trim() !== '') {
        parts.push(<MarkdownBlockView key={`text:${index}`} content={chunk.text} />)
        return
      }
      if (chunk.type === 'thinking' && chunk.thinking.trim() !== '') {
        parts.push(
          <ThinkingBlockView key={`thinking:${index}`} content={chunk.thinking} isStreaming={isStreaming} />
        )
        return
      }
      if (chunk.type === 'toolCall') {
        const tool = tools.find((candidate) => candidate.name === chunk.name)
        const pending = pendingToolCalls?.has(chunk.id) ?? false
        const result = toolResultsById?.get(chunk.id)
        if (hidePendingToolCalls && pending && !result) return
        const aborted = message.stopReason === 'aborted' && !result
        parts.push(
          <ToolMessageView
            key={chunk.id}
            toolCall={chunk}
            tool={tool}
            result={result}
            pending={pending}
            aborted={aborted}
            isStreaming={isStreaming}
          />
        )
      }
    })

    return parts
  }, [hidePendingToolCalls, isStreaming, message.content, message.stopReason, pendingToolCalls, toolResultsById, tools])

  return (
    <div>
      {orderedParts.length > 0 ? <div className="flex flex-col gap-3 px-4">{orderedParts}</div> : null}
      {message.usage && !isStreaming ? (
        onCostClick ? (
          <div
            className="mt-2 cursor-pointer px-4 text-xs text-muted-foreground transition-colors hover:text-foreground"
            onClick={onCostClick}
          >
            {formatUsage(message.usage)}
          </div>
        ) : (
          <div className="mt-2 px-4 text-xs text-muted-foreground">{formatUsage(message.usage)}</div>
        )
      ) : null}
      {message.stopReason === 'error' && message.errorMessage ? (
        <div className="mx-4 mt-3 overflow-hidden rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <strong>{i18n('Error:')}</strong> {message.errorMessage}
        </div>
      ) : null}
      {message.stopReason === 'aborted' ? (
        <span className="text-sm italic text-destructive">{i18n('Request aborted')}</span>
      ) : null}
    </div>
  )
}
