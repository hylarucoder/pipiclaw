import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Agent,
  DEFAULT_AGENT_SYSTEM_PROMPT,
  resolvePiModelRuntime,
  buildChatSessionId,
  createBufferedChatSessionPersistence,
  createPersistedChatSessionState,
  normalizeThinkingLevel,
  type PiModelTarget
} from '@pipiclaw/agent-core'
import { streamSimple } from '@renderer/lib/piAiBrowserShim'
import { AppStorage, setAppStorage } from '@renderer/features/webui/storage/app-storage.js'
import { IndexedDBStorageBackend } from '@renderer/features/webui/storage/backends/indexeddb-storage-backend.js'
import { CustomProvidersStore } from '@renderer/features/webui/storage/stores/custom-providers-store.js'
import { ProviderKeysStore } from '@renderer/features/webui/storage/stores/provider-keys-store.js'
import { SessionsStore } from '@renderer/features/webui/storage/stores/sessions-store.js'
import { SettingsStore } from '@renderer/features/webui/storage/stores/settings-store.js'
import '../styles/webui.css'
import { getProviderConfig } from '@pipiclaw/shared/config/modelProviders'
import type { AppSettings } from '@pipiclaw/shared/rpc/settings'
import { invokeSettingsGet } from '@renderer/lib/settings'
import { ipcChatSessionStore } from '@renderer/lib/chatSessionStore'
import { ChatPanelView } from './webui/ChatPanelView'

type PiWebStorageRuntime = {
  providerKeysStore: ProviderKeysStore
}

let storageInitPromise: Promise<PiWebStorageRuntime> | null = null

async function ensurePiWebStorage(): Promise<PiWebStorageRuntime> {
  if (storageInitPromise) return storageInitPromise

  storageInitPromise = (async () => {
    const settingsStore = new SettingsStore()
    const providerKeysStore = new ProviderKeysStore()
    const sessionsStore = new SessionsStore()
    const customProvidersStore = new CustomProvidersStore()

    const backend = new IndexedDBStorageBackend({
      dbName: 'pipiclaw-pi-web-ui',
      version: 1,
      stores: [
        settingsStore.getConfig(),
        providerKeysStore.getConfig(),
        sessionsStore.getConfig(),
        SessionsStore.getMetadataConfig(),
        customProvidersStore.getConfig()
      ]
    })

    settingsStore.setBackend(backend)
    providerKeysStore.setBackend(backend)
    sessionsStore.setBackend(backend)
    customProvidersStore.setBackend(backend)

    const storage = new AppStorage(
      settingsStore,
      providerKeysStore,
      sessionsStore,
      customProvidersStore,
      backend
    )
    setAppStorage(storage)

    return { providerKeysStore }
  })()

  return storageInitPromise
}

export interface PiWebChatPanelProps {
  settings?: AppSettings
  modelTarget?: PiModelTarget
}

export function PiWebChatPanel({ settings, modelTarget }: PiWebChatPanelProps): React.JSX.Element {
  const storageRuntimeRef = useRef<PiWebStorageRuntime | null>(null)
  const [agentInstance, setAgentInstance] = useState<Agent | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  const handleApiKeyRequired = useCallback(async (provider: string) => {
    const runtime = storageRuntimeRef.current
    if (!runtime) return false
    const key = await runtime.providerKeysStore.get(provider)
    return key !== null && key.trim().length > 0
  }, [])

  useEffect(() => {
    let disposed = false
    let agent: Agent | null = null
    let sessionId = ''
    let unsubscribePersist: (() => void) | null = null
    let sessionPersistence: ReturnType<typeof createBufferedChatSessionPersistence> | null = null

    const run = async (): Promise<void> => {
      setStatus('loading')
      setError(null)

      try {
        const storage = await ensurePiWebStorage()
        storageRuntimeRef.current = storage
        const currentSettings = settings ?? (await invokeSettingsGet()).settings
        const resolved = resolvePiModelRuntime(currentSettings, modelTarget)

        if (!resolved.runtime) {
          throw new Error(resolved.error ?? '模型运行时配置失败')
        }

        sessionId = buildChatSessionId(
          String(resolved.runtime.model.provider),
          String(resolved.runtime.model.id)
        )
        const persistedState = await ipcChatSessionStore.load(sessionId)

        for (const providerKey of Object.keys(currentSettings.models.providers) as Array<
          keyof AppSettings['models']['providers']
        >) {
          const typedProviderKey = providerKey
          const providerSettings = currentSettings.models.providers[typedProviderKey]
          const key = providerSettings.apiKey.trim()
          if (!key) continue
          const providerId = getProviderConfig(typedProviderKey).providerId
          await storage.providerKeysStore.set(providerId, key)
        }

        await storage.providerKeysStore.set(
          String(resolved.runtime.model.provider),
          resolved.runtime.apiKey
        )

        agent = new Agent({
          initialState: {
            systemPrompt: persistedState?.systemPrompt || DEFAULT_AGENT_SYSTEM_PROMPT,
            model: resolved.runtime.model,
            thinkingLevel: normalizeThinkingLevel(persistedState?.thinkingLevel),
            messages: (persistedState?.messages as never[] | undefined) ?? [],
            tools: []
          },
          streamFn: streamSimple,
          getApiKey: async (providerKey) => {
            const key = await storage.providerKeysStore.get(providerKey)
            return key ?? undefined
          }
        })

        sessionPersistence = createBufferedChatSessionPersistence({
          sessionStore: ipcChatSessionStore,
          sessionId,
          getState: () => {
            if (!agent) return null
            return createPersistedChatSessionState(agent, DEFAULT_AGENT_SYSTEM_PROMPT)
          }
        })

        unsubscribePersist = agent.subscribe(() => {
          sessionPersistence?.schedulePersist()
        })

        if (disposed) return
        setAgentInstance(agent)
        setStatus('ready')
      } catch (setupError) {
        if (disposed) return
        const message = setupError instanceof Error ? setupError.message : '聊天面板初始化失败'
        setError(message)
        setStatus('error')
      }
    }

    void run()

    return () => {
      disposed = true
      setAgentInstance(null)
      storageRuntimeRef.current = null
      unsubscribePersist?.()
      void sessionPersistence?.dispose()
      agent?.abort()
    }
  }, [modelTarget, settings])

  return (
    <div className="relative h-full min-h-0">
      {status !== 'ready' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/75 px-3 text-center text-xs text-muted-foreground">
          {status === 'loading'
            ? '正在加载 pi-web-ui 聊天面板…'
            : `聊天面板加载失败：${error ?? '未知错误'}`}
        </div>
      )}
      <div className="h-full min-h-0">
        {agentInstance ? <ChatPanelView agent={agentInstance} onApiKeyRequired={handleApiKeyRequired} /> : null}
      </div>
    </div>
  )
}
