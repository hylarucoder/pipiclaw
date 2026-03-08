import { useEffect, useMemo, useState } from 'react'
import { getProviders } from '@renderer/lib/piAiBrowserShim'
import { i18n } from '@renderer/features/webui/utils/i18n.js'
import { getAppStorage } from '@renderer/features/webui/storage/app-storage.js'
import {
  type AutoDiscoveryProviderType,
  type CustomProvider,
  type CustomProviderType
} from '@renderer/features/webui/storage/stores/custom-providers-store.js'
import { discoverModels } from '@renderer/features/webui/utils/model-discovery.js'
import { CustomProviderCardView } from '../CustomProviderCardView'
import { ProviderKeyInputView } from '../ProviderKeyInputView'
import { ConfirmDialog } from './ConfirmDialog'
import { CustomProviderDialog } from './CustomProviderDialog'
import { SettingsTab } from './SettingsDialog'

function isAutoDiscoveryProviderType(type: string): type is AutoDiscoveryProviderType {
  return type === 'ollama' || type === 'llama.cpp' || type === 'vllm' || type === 'lmstudio'
}

function ProvidersModelsTabView(): React.JSX.Element {
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>([])
  const [providerStatus, setProviderStatus] = useState<
    Map<string, { modelCount: number; status: 'connected' | 'disconnected' | 'checking' }>
  >(new Map())
  const [operationError, setOperationError] = useState('')

  const knownProviders = useMemo(() => getProviders(), [])

  const checkProviderStatus = async (provider: CustomProvider) => {
    setProviderStatus((prev) => {
      const next = new Map(prev)
      next.set(provider.id, { modelCount: 0, status: 'checking' })
      return next
    })

    try {
      const models = await discoverModels(provider.type as AutoDiscoveryProviderType, provider.baseUrl, provider.apiKey)
      setProviderStatus((prev) => {
        const next = new Map(prev)
        next.set(provider.id, { modelCount: models.length, status: 'connected' })
        return next
      })
    } catch {
      setProviderStatus((prev) => {
        const next = new Map(prev)
        next.set(provider.id, { modelCount: 0, status: 'disconnected' })
        return next
      })
    }
  }

  const loadCustomProviders = async () => {
    setOperationError('')
    try {
      const providers = await getAppStorage().customProviders.getAll()
      setCustomProviders(providers)

      for (const provider of providers) {
        if (isAutoDiscoveryProviderType(provider.type)) {
          void checkProviderStatus(provider)
        }
      }
    } catch (error) {
      console.error('Failed to load custom providers:', error)
    }
  }

  useEffect(() => {
    void loadCustomProviders()
  }, [])

  const addCustomProvider = async (type: CustomProviderType) => {
    await CustomProviderDialog.open(undefined, type, () => {
      void loadCustomProviders()
    })
  }

  const editProvider = async (provider: CustomProvider) => {
    await CustomProviderDialog.open(provider, undefined, () => {
      void loadCustomProviders()
    })
  }

  const refreshProvider = async (provider: CustomProvider) => {
    setProviderStatus((prev) => {
      const next = new Map(prev)
      next.set(provider.id, { modelCount: 0, status: 'checking' })
      return next
    })
    setOperationError('')

    try {
      const models = await discoverModels(provider.type as AutoDiscoveryProviderType, provider.baseUrl, provider.apiKey)
      setProviderStatus((prev) => {
        const next = new Map(prev)
        next.set(provider.id, { modelCount: models.length, status: 'connected' })
        return next
      })
      console.log(`Refreshed ${models.length} models from ${provider.name}`)
    } catch (error) {
      setProviderStatus((prev) => {
        const next = new Map(prev)
        next.set(provider.id, { modelCount: 0, status: 'disconnected' })
        return next
      })
      setOperationError(`Failed to refresh provider: ${error instanceof Error ? error.message : String(error)}`)
      console.error(`Failed to refresh provider ${provider.name}:`, error)
    }
  }

  const deleteProvider = async (provider: CustomProvider) => {
    const confirmed = await ConfirmDialog.confirm({
      title: 'Delete provider',
      message: i18n('Are you sure you want to delete this provider?'),
      confirmLabel: i18n('Delete'),
      destructive: true
    })

    if (!confirmed) return

    try {
      setOperationError('')
      await getAppStorage().customProviders.delete(provider.id)
      await loadCustomProviders()
    } catch (error) {
      console.error('Failed to delete provider:', error)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {operationError ? (
        <div className="rounded-md border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <div className="font-medium">Operation failed</div>
          <div className="mt-1">{operationError}</div>
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Cloud Providers</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Cloud LLM providers with predefined models. API keys are stored locally in your browser.
          </p>
        </div>
        <div className="flex flex-col gap-6">
          {knownProviders.map((provider) => (
            <ProviderKeyInputView key={provider} provider={provider} />
          ))}
        </div>
      </div>

      <div className="border-t border-border" />

      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Custom Providers</h3>
            <p className="text-sm text-muted-foreground">
              User-configured servers with auto-discovered or manually defined models.
            </p>
          </div>

          <select
            className="border-input bg-input/20 dark:bg-input/30 h-7 min-w-56 rounded-md border px-2 text-xs/relaxed outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            defaultValue=""
            onChange={(event) => {
              const value = event.target.value as CustomProviderType
              if (!value) return
              void addCustomProvider(value)
              event.currentTarget.value = ''
            }}
          >
            <option value="">{i18n('Add Provider')}</option>
            <option value="ollama">Ollama</option>
            <option value="llama.cpp">llama.cpp</option>
            <option value="vllm">vLLM</option>
            <option value="lmstudio">LM Studio</option>
            <option value="openai-completions">{i18n('OpenAI Completions Compatible')}</option>
            <option value="openai-responses">{i18n('OpenAI Responses Compatible')}</option>
            <option value="anthropic-messages">{i18n('Anthropic Messages Compatible')}</option>
          </select>
        </div>

        {customProviders.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No custom providers configured. Click 'Add Provider' to get started.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {customProviders.map((provider) => (
              <CustomProviderCardView
                key={provider.id}
                provider={provider}
                isAutoDiscovery={isAutoDiscoveryProviderType(provider.type)}
                status={providerStatus.get(provider.id)}
                onRefresh={(p) => {
                  void refreshProvider(p)
                }}
                onEdit={(p) => {
                  void editProvider(p)
                }}
                onDelete={(p) => {
                  void deleteProvider(p)
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export class ProvidersModelsTab extends SettingsTab {
  getTabName(): string {
    return 'Providers & Models'
  }

  render(): React.JSX.Element {
    return <ProvidersModelsTabView />
  }
}
