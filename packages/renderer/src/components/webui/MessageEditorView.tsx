import { useCallback, useEffect, useRef, useState } from 'react'
import type { Model } from '@mariozechner/pi-ai'
import type { ThinkingLevel } from '@pipiclaw/agent-core'
import { Brain, Loader2, Paperclip, Send, Sparkles, Square } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { cn } from '@renderer/lib/utils'
import type { Attachment } from '@renderer/features/webui/utils/attachment-utils.js'
import { loadAttachment } from '@renderer/features/webui/utils/attachment-utils.js'
import { i18n } from '@renderer/features/webui/utils/i18n.js'
import { AttachmentTileView } from './AttachmentTileView'

type ThinkingOption = Extract<ThinkingLevel, 'off' | 'minimal' | 'low' | 'medium' | 'high'>

const DEFAULT_MAX_FILES = 10
const DEFAULT_MAX_FILE_SIZE = 20 * 1024 * 1024
const DEFAULT_ACCEPTED_TYPES =
  'image/*,application/pdf,.docx,.pptx,.xlsx,.xls,.txt,.md,.json,.xml,.html,.css,.js,.ts,.jsx,.tsx,.yml,.yaml'

const THINKING_OPTIONS: Array<{ value: ThinkingOption; label: string }> = [
  { value: 'off', label: i18n('Off') },
  { value: 'minimal', label: i18n('Minimal') },
  { value: 'low', label: i18n('Low') },
  { value: 'medium', label: i18n('Medium') },
  { value: 'high', label: i18n('High') }
]

export interface MessageEditorViewProps {
  value: string
  attachments: Attachment[]
  isStreaming: boolean
  currentModel?: Model<any> | null
  thinkingLevel: ThinkingLevel
  showAttachmentButton?: boolean
  showModelSelector?: boolean
  showThinkingSelector?: boolean
  maxFiles?: number
  maxFileSize?: number
  acceptedTypes?: string
  onInput: (value: string) => void
  onAttachmentsChange: (files: Attachment[]) => void
  onSend: (input: string, attachments: Attachment[]) => void
  onAbort?: () => void
  onModelSelect?: () => void
  onThinkingChange?: (level: ThinkingOption) => void
}

export function MessageEditorView({
  value,
  attachments,
  isStreaming,
  currentModel,
  thinkingLevel,
  showAttachmentButton = true,
  showModelSelector = true,
  showThinkingSelector = true,
  maxFiles = DEFAULT_MAX_FILES,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  onInput,
  onAttachmentsChange,
  onSend,
  onAbort,
  onModelSelect,
  onThinkingChange
}: MessageEditorViewProps): React.JSX.Element {
  const [processingFiles, setProcessingFiles] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [attachmentError, setAttachmentError] = useState('')

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const processFiles = useCallback(
    async (files: File[], pastedImage = false) => {
      if (files.length === 0) return
      if (files.length + attachments.length > maxFiles) {
        setAttachmentError(`Maximum ${maxFiles} files allowed`)
        return
      }
      setAttachmentError('')
      setProcessingFiles(true)

      const newAttachments: Attachment[] = []
      const sizeInMb = Math.round(maxFileSize / 1024 / 1024)

      for (const file of files) {
        try {
          if (file.size > maxFileSize) {
            setAttachmentError(
              pastedImage
                ? `Image exceeds maximum size of ${sizeInMb}MB`
                : `${file.name} exceeds maximum size of ${sizeInMb}MB`
            )
            continue
          }
          const attachment = await loadAttachment(file)
          newAttachments.push(attachment)
        } catch (error) {
          const details = String(error)
          setAttachmentError(
            pastedImage
              ? `Failed to process pasted image: ${details}`
              : `Failed to process ${file.name}: ${details}`
          )
        }
      }

      if (newAttachments.length > 0) {
        onAttachmentsChange([...attachments, ...newAttachments])
      }
      setProcessingFiles(false)
    },
    [attachments, maxFileSize, maxFiles, onAttachmentsChange]
  )

  const handleSend = useCallback(() => {
    onSend(value, attachments)
  }, [attachments, onSend, value])

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items
      if (!items) return

      const imageFiles: File[] = []
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i]
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) imageFiles.push(file)
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault()
        void processFiles(imageFiles, true)
      }
    },
    [processFiles]
  )

  const supportsThinking = currentModel?.reasoning === true
  const sendDisabled = (!value.trim() && attachments.length === 0) || processingFiles

  return (
    <div
      className={cn(
        'relative rounded-xl border bg-card shadow-sm',
        isDragging ? 'border-2 border-primary bg-primary/5' : 'border-border'
      )}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!isDragging) setIsDragging(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        e.stopPropagation()
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const x = e.clientX
        const y = e.clientY
        if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
          setIsDragging(false)
        }
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
        const files = Array.from(e.dataTransfer.files || [])
        if (files.length > 0) void processFiles(files)
      }}
    >
      {isDragging ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-primary/10">
          <div className="font-medium text-primary">{i18n('Drop files here')}</div>
        </div>
      ) : null}

      {attachments.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-4 pb-2 pt-3">
          {attachments.map((attachment) => (
            <AttachmentTileView
              key={attachment.id}
              attachment={attachment}
              onDelete={() => onAttachmentsChange(attachments.filter((item) => item.id !== attachment.id))}
            />
          ))}
        </div>
      ) : null}

      {attachmentError ? (
        <div className="px-4 pt-2">
          <Alert variant="destructive">
            <AlertTitle>{i18n('Error loading file')}</AlertTitle>
            <AlertDescription>{attachmentError}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <textarea
        ref={textareaRef}
        className="field-sizing-content w-full resize-none overflow-y-auto bg-transparent p-4 text-foreground placeholder-muted-foreground outline-none"
        placeholder={i18n('Type a message...')}
        rows={1}
        style={{ maxHeight: 200, minHeight: '1lh', height: 'auto' }}
        value={value}
        onChange={(e) => onInput(e.target.value)}
        onPaste={handlePaste}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (!isStreaming && !processingFiles && (value.trim() || attachments.length > 0)) {
              handleSend()
            }
            return
          }
          if (e.key === 'Escape' && isStreaming) {
            e.preventDefault()
            onAbort?.()
          }
        }}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes}
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || [])
          e.currentTarget.value = ''
          if (files.length > 0) void processFiles(files)
        }}
      />

      <div className="flex items-center justify-between px-2 pb-2">
        <div className="flex items-center gap-2">
          {showAttachmentButton ? (
            processingFiles ? (
              <div className="flex h-8 w-8 items-center justify-center">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="size-4" />
              </Button>
            )
          ) : null}

          {supportsThinking && showThinkingSelector ? (
            <Select value={thinkingLevel} onValueChange={(next) => onThinkingChange?.(next as ThinkingOption)}>
              <SelectTrigger size="sm" className="h-8 w-[92px] border-none bg-transparent hover:bg-muted">
                <SelectValue placeholder={i18n('Off')} />
              </SelectTrigger>
              <SelectContent align="start">
                {THINKING_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className="flex items-center gap-1.5">
                      <Brain className="size-3.5" />
                      {option.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {showModelSelector && currentModel ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 truncate text-xs"
              onClick={() => {
                textareaRef.current?.focus()
                requestAnimationFrame(() => {
                  onModelSelect?.()
                })
              }}
            >
              <Sparkles className="size-4" />
              <span className="ml-1">{currentModel.id}</span>
            </Button>
          ) : null}

          {isStreaming ? (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onAbort}>
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleSend}
              disabled={sendDisabled}
            >
              <Send className="size-4 -rotate-45" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
