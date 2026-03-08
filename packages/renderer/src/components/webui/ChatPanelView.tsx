import { useEffect, useMemo, useRef, useState } from 'react'
import type { Agent, AgentTool } from '@pipiclaw/agent-core'
import { ArtifactsRuntimeProvider } from '@renderer/features/webui/components/sandbox/ArtifactsRuntimeProvider.js'
import { AttachmentsRuntimeProvider } from '@renderer/features/webui/components/sandbox/AttachmentsRuntimeProvider.js'
import type { SandboxRuntimeProvider } from '@renderer/features/webui/components/sandbox/SandboxRuntimeProvider.js'
import type { ArtifactsPanel } from '@renderer/features/webui/tools/artifacts/artifacts.js'
import { ArtifactsToolRenderer } from '@renderer/features/webui/tools/artifacts/artifacts-tool-renderer.js'
import { registerToolRenderer } from '@renderer/features/webui/tools/renderer-registry.js'
import type { Attachment } from '@renderer/features/webui/utils/attachment-utils.js'
import { i18n } from '@renderer/features/webui/utils/i18n.js'
import '@renderer/features/webui/tools/artifacts/artifacts.js'
import { AgentInterfaceView, type AgentInterfaceController } from './AgentInterfaceView'

const BREAKPOINT = 800

type ChatPanelToolsFactory = (
  agent: Agent,
  agentInterface: AgentInterfaceController,
  artifactsPanel: ArtifactsPanel,
  runtimeProvidersFactory: () => SandboxRuntimeProvider[]
) => AgentTool<any>[]

export interface ChatPanelViewProps {
  agent: Agent
  onApiKeyRequired?: (provider: string) => Promise<boolean>
  onBeforeSend?: () => void | Promise<void>
  onCostClick?: () => void
  sandboxUrlProvider?: () => string
  toolsFactory?: ChatPanelToolsFactory
}

export function ChatPanelView({
  agent,
  onApiKeyRequired,
  onBeforeSend,
  onCostClick,
  sandboxUrlProvider,
  toolsFactory
}: ChatPanelViewProps): React.JSX.Element {
  const agentInterfaceControllerRef = useRef<AgentInterfaceController | null>(null)
  const artifactsHostRef = useRef<HTMLDivElement | null>(null)
  const artifactsPanelRef = useRef<ArtifactsPanel | null>(null)

  const [hasArtifacts, setHasArtifacts] = useState(false)
  const [artifactCount, setArtifactCount] = useState(0)
  const [showArtifactsPanel, setShowArtifactsPanel] = useState(false)
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window === 'undefined' ? BREAKPOINT : window.innerWidth
  )

  const isMobile = useMemo(() => windowWidth < BREAKPOINT, [windowWidth])

  useEffect(() => {
    const resizeHandler = () => {
      setWindowWidth(window.innerWidth)
    }

    window.addEventListener('resize', resizeHandler)
    return () => {
      window.removeEventListener('resize', resizeHandler)
    }
  }, [])

  useEffect(() => {
    let disposed = false

    const setup = async (): Promise<void> => {
      const artifactsPanel = document.createElement('artifacts-panel') as ArtifactsPanel
      artifactsPanel.agent = agent
      if (sandboxUrlProvider) {
        artifactsPanel.sandboxUrlProvider = sandboxUrlProvider
      }

      registerToolRenderer('artifacts', new ArtifactsToolRenderer(artifactsPanel))

      const runtimeProvidersFactory = () => {
        const attachments: Attachment[] = []
        for (const message of agent.state.messages) {
          if (message.role === 'user-with-attachments') {
            message.attachments?.forEach((attachment) => {
              attachments.push(attachment)
            })
          }
        }

        const providers: SandboxRuntimeProvider[] = []
        if (attachments.length > 0) {
          providers.push(new AttachmentsRuntimeProvider(attachments))
        }
        providers.push(new ArtifactsRuntimeProvider(artifactsPanel, agent, true))
        return providers
      }

      artifactsPanel.onArtifactsChange = () => {
        const count = artifactsPanel.artifacts.size
        setHasArtifacts(count > 0)
        setArtifactCount((prev) => {
          if (count > prev) {
            setShowArtifactsPanel(true)
          } else if (count === 0) {
            setShowArtifactsPanel(false)
          }
          return count
        })
      }

      artifactsPanel.onClose = () => {
        setShowArtifactsPanel(false)
      }

      artifactsPanel.onOpen = () => {
        setShowArtifactsPanel(true)
      }

      const additionalTools =
        toolsFactory?.(
          agent,
          agentInterfaceControllerRef.current ?? {
            setInput: () => {},
            setAutoScroll: () => {}
          },
          artifactsPanel,
          runtimeProvidersFactory
        ) ?? []
      agent.setTools([artifactsPanel.tool, ...additionalTools])

      const originalCallback = artifactsPanel.onArtifactsChange
      artifactsPanel.onArtifactsChange = undefined
      await artifactsPanel.reconstructFromMessages(agent.state.messages)
      artifactsPanel.onArtifactsChange = originalCallback

      if (disposed) {
        artifactsPanel.remove()
        return
      }

      const count = artifactsPanel.artifacts.size
      setHasArtifacts(count > 0)
      setArtifactCount(count)

      if (artifactsHostRef.current) {
        artifactsHostRef.current.innerHTML = ''
        artifactsHostRef.current.appendChild(artifactsPanel)
      }

      artifactsPanelRef.current = artifactsPanel
    }

    void setup()

    return () => {
      disposed = true
      artifactsPanelRef.current?.remove()
      artifactsPanelRef.current = null
    }
  }, [agent, onApiKeyRequired, onBeforeSend, onCostClick, sandboxUrlProvider, toolsFactory])

  useEffect(() => {
    const artifactsPanel = artifactsPanelRef.current
    if (!artifactsPanel) return
    artifactsPanel.collapsed = !showArtifactsPanel
    artifactsPanel.overlay = isMobile
    artifactsPanel.requestUpdate()
  }, [isMobile, showArtifactsPanel])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="flex h-full">
        <div
          className="h-full"
          style={{
            width: !isMobile && showArtifactsPanel && hasArtifacts ? '50%' : '100%'
          }}
        >
          <AgentInterfaceView
            ref={agentInterfaceControllerRef}
            session={agent}
            enableAttachments={true}
            enableModelSelector={true}
            enableThinkingSelector={true}
            showThemeToggle={false}
            onApiKeyRequired={onApiKeyRequired}
            onBeforeSend={onBeforeSend}
            onCostClick={onCostClick}
          />
        </div>

        {hasArtifacts && !showArtifactsPanel ? (
          <button
            type="button"
            className="absolute left-1/2 top-4 z-30 inline-flex h-7 -translate-x-1/2 items-center rounded-md border border-border/70 bg-primary px-2 text-xs font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-95"
            onClick={() => setShowArtifactsPanel(true)}
            title={i18n('Show artifacts')}
          >
            <span className="inline-flex items-center gap-1">
              <span>{i18n('Artifacts')}</span>
              <span className="rounded bg-primary-foreground/20 px-1 font-mono text-[10px] leading-none tabular-nums text-primary-foreground">
                {artifactCount}
              </span>
            </span>
          </button>
        ) : null}

        <div
          className={`h-full ${isMobile ? 'pointer-events-none absolute inset-0' : ''}`}
          style={
            !isMobile
              ? !hasArtifacts || !showArtifactsPanel
                ? { display: 'none' }
                : { width: '50%' }
              : undefined
          }
        >
          <div ref={artifactsHostRef} className="h-full min-h-0" />
        </div>
      </div>
    </div>
  )
}
