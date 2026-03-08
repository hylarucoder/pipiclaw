import {
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import type { Agent, AgentEvent, AgentMessage } from '@pipiclaw/agent-core'
import type { ToolResultMessage, Usage } from '@mariozechner/pi-ai'
import { streamSimple } from '@renderer/lib/piAiBrowserShim'
import { ModelSelector } from './dialogs/ModelSelector.js'
import { getAppStorage } from '@renderer/features/webui/storage/app-storage.js'
import type { Attachment } from '@renderer/features/webui/utils/attachment-utils.js'
import { formatUsage } from '@renderer/features/webui/utils/format.js'
import { i18n } from '@renderer/features/webui/utils/i18n.js'
import { createStreamFn } from '@renderer/features/webui/utils/proxy-utils.js'
import type { UserMessageWithAttachments } from '@renderer/features/webui/components/Messages.js'
import { MessageEditorView } from './MessageEditorView'
import { MessageListView } from './MessageListView'
import { StreamingMessageView } from './StreamingMessageView'

export interface AgentInterfaceController {
  setInput: (text: string, attachments?: Attachment[]) => void
  setAutoScroll: (enabled: boolean) => void
}

export interface AgentInterfaceViewProps {
  session: Agent
  enableAttachments?: boolean
  enableModelSelector?: boolean
  enableThinkingSelector?: boolean
  showThemeToggle?: boolean
  onApiKeyRequired?: (provider: string) => Promise<boolean>
  onBeforeSend?: () => void | Promise<void>
  onCostClick?: () => void
}

export const AgentInterfaceView = forwardRef<AgentInterfaceController, AgentInterfaceViewProps>(
  function AgentInterfaceView(
    {
      session,
      enableAttachments = true,
      enableModelSelector = true,
      enableThinkingSelector = true,
      showThemeToggle = false,
      onApiKeyRequired,
      onBeforeSend,
      onCostClick
    },
    ref
  ): React.JSX.Element {
    const [renderVersion, setRenderVersion] = useState(0)
    const [inputValue, setInputValue] = useState('')
    const [inputAttachments, setInputAttachments] = useState<Attachment[]>([])
    const [streamingMessage, setStreamingMessage] = useState<AgentMessage | null>(null)

    const autoScrollRef = useRef(true)
    const lastScrollTopRef = useRef(0)
    const lastClientHeightRef = useRef(0)

    const scrollContainerRef = useRef<HTMLDivElement | null>(null)

    useImperativeHandle(
      ref,
      () => ({
        setInput: (text: string, attachments?: Attachment[]) => {
          setInputValue(text)
          setInputAttachments(attachments ?? [])
        },
        setAutoScroll: (enabled: boolean) => {
          autoScrollRef.current = enabled
        }
      }),
      []
    )

    useEffect(() => {
      const scrollContainer = scrollContainerRef.current
      if (!scrollContainer) return

      const handleScroll = () => {
        const currentScrollTop = scrollContainer.scrollTop
        const scrollHeight = scrollContainer.scrollHeight
        const clientHeight = scrollContainer.clientHeight
        const distanceFromBottom = scrollHeight - currentScrollTop - clientHeight

        if (clientHeight < lastClientHeightRef.current) {
          lastClientHeightRef.current = clientHeight
          return
        }

        if (
          currentScrollTop !== 0 &&
          currentScrollTop < lastScrollTopRef.current &&
          distanceFromBottom > 50
        ) {
          autoScrollRef.current = false
        } else if (distanceFromBottom < 10) {
          autoScrollRef.current = true
        }

        lastScrollTopRef.current = currentScrollTop
        lastClientHeightRef.current = clientHeight
      }

      scrollContainer.addEventListener('scroll', handleScroll)

      const resizeObserver = new ResizeObserver(() => {
        if (autoScrollRef.current) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight
        }
      })
      const contentContainer = scrollContainer.querySelector('.max-w-3xl')
      if (contentContainer) {
        resizeObserver.observe(contentContainer)
      }

      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll)
        resizeObserver.disconnect()
      }
    }, [renderVersion])

    useEffect(() => {
      if (session.streamFn === streamSimple) {
        session.streamFn = createStreamFn(async () => {
          const enabled = await getAppStorage().settings.get<boolean>('proxy.enabled')
          return enabled
            ? (await getAppStorage().settings.get<string>('proxy.url')) || undefined
            : undefined
        })
      }

      if (!session.getApiKey) {
        session.getApiKey = async (provider: string) => {
          const key = await getAppStorage().providerKeys.get(provider)
          return key ?? undefined
        }
      }

      const unsubscribe = session.subscribe((ev: AgentEvent) => {
        switch (ev.type) {
          case 'message_start':
            setStreamingMessage(null)
            setRenderVersion((prev) => prev + 1)
            break
          case 'message_end':
          case 'turn_start':
          case 'turn_end':
          case 'agent_start':
            setRenderVersion((prev) => prev + 1)
            break
          case 'agent_end': {
            setStreamingMessage(null)
            setRenderVersion((prev) => prev + 1)
            break
          }
          case 'message_update': {
            setStreamingMessage(ev.message)
            setRenderVersion((prev) => prev + 1)
            break
          }
        }
      })

      return () => {
        unsubscribe()
      }
    }, [session])

    const sendMessage = useCallback(
      async (input: string, attachments?: Attachment[]) => {
        if ((!input.trim() && (attachments?.length ?? 0) === 0) || session.state.isStreaming) return
        if (!session.state.model) throw new Error('No model set on AgentInterface')

        const provider = session.state.model.provider
        const apiKey = await getAppStorage().providerKeys.get(provider)
        if (!apiKey) {
          if (!onApiKeyRequired) {
            console.error('No API key configured and no onApiKeyRequired handler set')
            return
          }

          const success = await onApiKeyRequired(provider)
          if (!success) return
        }

        if (onBeforeSend) {
          await onBeforeSend()
        }

        setInputValue('')
        setInputAttachments([])
        autoScrollRef.current = true

        if (attachments && attachments.length > 0) {
          const message: UserMessageWithAttachments = {
            role: 'user-with-attachments',
            content: input,
            attachments,
            timestamp: Date.now()
          }
          await session.prompt(message)
        } else {
          await session.prompt(input)
        }
      },
      [onApiKeyRequired, onBeforeSend, session]
    )

    const toolResultsById = useMemo(() => {
      void renderVersion
      const map = new Map<string, ToolResultMessage<any>>()
      for (const message of session.state.messages) {
        if (message.role === 'toolResult') {
          map.set(message.toolCallId, message)
        }
      }
      return map
    }, [renderVersion, session])

    const totals = session.state.messages
      .filter((message) => message.role === 'assistant')
      .reduce(
        (acc, message: any) => {
          const usage = message.usage
          if (usage) {
            acc.input += usage.input
            acc.output += usage.output
            acc.cacheRead += usage.cacheRead
            acc.cacheWrite += usage.cacheWrite
            acc.cost.total += usage.cost.total
          }
          return acc
        },
        {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
        } satisfies Usage
      )
    const hasTotals = totals.input || totals.output || totals.cacheRead || totals.cacheWrite
    const totalsText = hasTotals ? formatUsage(totals) : ''

    return (
      <div className="flex h-full flex-col bg-background text-foreground">
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4 pb-0">
            <MessageListView
              messages={session.state.messages}
              tools={session.state.tools}
              pendingToolCalls={session.state.pendingToolCalls}
              isStreaming={session.state.isStreaming}
              onCostClick={onCostClick}
            />
            {session.state.isStreaming ? (
              <StreamingMessageView
                message={streamingMessage}
                tools={session.state.tools}
                isStreaming={session.state.isStreaming}
                pendingToolCalls={session.state.pendingToolCalls}
                toolResultsById={toolResultsById}
                onCostClick={onCostClick}
              />
            ) : null}
          </div>
        </div>

        <div className="shrink-0">
          <div className="mx-auto max-w-3xl px-2">
            <MessageEditorView
              value={inputValue}
              attachments={inputAttachments}
              isStreaming={session.state.isStreaming}
              currentModel={session.state.model}
              thinkingLevel={session.state.thinkingLevel}
              showAttachmentButton={enableAttachments}
              showModelSelector={enableModelSelector}
              showThinkingSelector={enableThinkingSelector}
              onInput={setInputValue}
              onAttachmentsChange={setInputAttachments}
              onSend={(input: string, attachments: Attachment[]) => {
                void sendMessage(input, attachments)
              }}
              onAbort={() => session.abort()}
              onModelSelect={() => {
                ModelSelector.open(session.state.model, (model) => session.setModel(model))
              }}
              onThinkingChange={
                enableThinkingSelector
                  ? (level: 'off' | 'minimal' | 'low' | 'medium' | 'high') => {
                      session.setThinkingLevel(level)
                    }
                  : undefined
              }
            />
            <div className="flex h-5 items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                {showThemeToggle ? createElement('theme-toggle') : null}
              </div>
              <div className="ml-auto flex items-center gap-3">
                {totalsText ? (
                  onCostClick ? (
                    <span
                      className="cursor-pointer transition-colors hover:text-foreground"
                      onClick={onCostClick}
                    >
                      {totalsText}
                    </span>
                  ) : (
                    <span>{totalsText}</span>
                  )
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {session.state.messages.length === 0 ? (
          <div className="hidden p-4 text-center text-muted-foreground">{i18n('No session available')}</div>
        ) : null}
      </div>
    )
  }
)
