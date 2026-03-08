import type { AgentMessage } from '@pipiclaw/agent-core'
import type { ImageContent, Message, TextContent } from '@mariozechner/pi-ai'
import type { Attachment } from '../utils/attachment-utils.js'

export type UserMessageWithAttachments = {
  role: 'user-with-attachments'
  content: string | (TextContent | ImageContent)[]
  timestamp: number
  attachments?: Attachment[]
}

// Artifact message type for session persistence
export interface ArtifactMessage {
  role: 'artifact'
  action: 'create' | 'update' | 'delete'
  filename: string
  content?: string
  title?: string
  timestamp: string
}

declare module '@pipiclaw/agent-core' {
  interface CustomAgentMessages {
    'user-with-attachments': UserMessageWithAttachments
    artifact: ArtifactMessage
  }
}

/**
 * Convert attachments to content blocks for LLM.
 * - Images become ImageContent blocks
 * - Documents with extractedText become TextContent blocks with filename header
 */
export function convertAttachments(attachments: Attachment[]): (TextContent | ImageContent)[] {
  const content: (TextContent | ImageContent)[] = []
  for (const attachment of attachments) {
    if (attachment.type === 'image') {
      content.push({
        type: 'image',
        data: attachment.content,
        mimeType: attachment.mimeType
      } as ImageContent)
      continue
    }
    if (attachment.type === 'document' && attachment.extractedText) {
      content.push({
        type: 'text',
        text: `\n\n[Document: ${attachment.fileName}]\n${attachment.extractedText}`
      } as TextContent)
    }
  }
  return content
}

/**
 * Check if a message is a UserMessageWithAttachments.
 */
export function isUserMessageWithAttachments(msg: AgentMessage): msg is UserMessageWithAttachments {
  return (msg as UserMessageWithAttachments).role === 'user-with-attachments'
}

/**
 * Check if a message is an ArtifactMessage.
 */
export function isArtifactMessage(msg: AgentMessage): msg is ArtifactMessage {
  return (msg as ArtifactMessage).role === 'artifact'
}

/**
 * Default convertToLlm for web-ui apps.
 *
 * Handles:
 * - UserMessageWithAttachments: converts to user message with content blocks
 * - ArtifactMessage: filtered out (UI-only, for session reconstruction)
 * - Standard LLM messages (user, assistant, toolResult): passed through
 */
export function defaultConvertToLlm(messages: AgentMessage[]): Message[] {
  return messages
    .filter((message) => !isArtifactMessage(message))
    .map((message): Message | null => {
      if (isUserMessageWithAttachments(message)) {
        const content: (TextContent | ImageContent)[] =
          typeof message.content === 'string'
            ? [{ type: 'text', text: message.content }]
            : [...message.content]

        if (message.attachments) {
          content.push(...convertAttachments(message.attachments))
        }

        return {
          role: 'user',
          content,
          timestamp: message.timestamp
        } as Message
      }

      if (message.role === 'user' || message.role === 'assistant' || message.role === 'toolResult') {
        return message as Message
      }

      return null
    })
    .filter((message): message is Message => message !== null)
}
