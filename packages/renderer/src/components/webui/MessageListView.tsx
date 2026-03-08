import { useMemo } from 'react'
import type { AgentMessage, AgentTool } from '@pipiclaw/agent-core'
import type {
  AssistantMessage as AssistantMessageType,
  ToolResultMessage as ToolResultMessageType
} from '@mariozechner/pi-ai'
import { AssistantMessageElement, UserMessageElement } from './MessageElementsView'

export interface MessageListViewProps {
  messages: AgentMessage[]
  tools: AgentTool<any>[]
  pendingToolCalls?: Set<string>
  isStreaming: boolean
  onCostClick?: () => void
}

export function MessageListView({
  messages,
  tools,
  pendingToolCalls,
  isStreaming,
  onCostClick
}: MessageListViewProps): React.JSX.Element {
  const resultByCallId = useMemo(() => {
    const map = new Map<string, ToolResultMessageType>()
    for (const message of messages) {
      if (message.role === 'toolResult') {
        map.set(message.toolCallId, message)
      }
    }
    return map
  }, [messages])

  return (
    <div className="flex flex-col gap-3">
      {messages.map((message, index) => {
        if (message.role === 'artifact' || message.role === 'toolResult') return null
        if (message.role === 'user' || message.role === 'user-with-attachments') {
          return <UserMessageElement key={`msg:${index}`} message={message} />
        }
        if (message.role === 'assistant') {
          return (
            <AssistantMessageElement
              key={`msg:${index}`}
              message={message as AssistantMessageType}
              tools={tools}
              pendingToolCalls={pendingToolCalls}
              toolResultsById={resultByCallId}
              isStreaming={false}
              hidePendingToolCalls={isStreaming}
              onCostClick={onCostClick}
            />
          )
        }
        return null
      })}
    </div>
  )
}
