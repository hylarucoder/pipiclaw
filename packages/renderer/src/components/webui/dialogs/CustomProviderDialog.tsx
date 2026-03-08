import { useMemo, useState } from 'react'
import type { Model } from '@mariozechner/pi-ai'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { i18n } from '@renderer/features/webui/utils/i18n.js'
import { getAppStorage } from '@renderer/features/webui/storage/app-storage.js'
import {
  type AutoDiscoveryProviderType,
  type CustomProvider,
  type CustomProviderType
} from '@renderer/features/webui/storage/stores/custom-providers-store.js'
import { discoverModels } from '@renderer/features/webui/utils/model-discovery.js'
import { mountDialog } from './dialogHost'

const AUTO_DISCOVERY_TYPES: AutoDiscoveryProviderType[] = ['ollama', 'llama.cpp', 'vllm', 'lmstudio']

const PROVIDER_TYPES: Array<{ value: CustomProviderType; label: string }> = [
  { value: 'ollama', label: 'Ollama (auto-discovery)' },
  { value: 'llama.cpp', label: 'llama.cpp (auto-discovery)' },
  { value: 'vllm', label: 'vLLM (auto-discovery)' },
  { value: 'lmstudio', label: 'LM Studio (auto-discovery)' },
  { value: 'openai-completions', label: 'OpenAI Completions Compatible' },
  { value: 'openai-responses', label: 'OpenAI Responses Compatible' },
  { value: 'anthropic-messages', label: 'Anthropic Messages Compatible' }
]

const DEFAULT_BASE_URLS: Record<CustomProviderType, string> = {
  ollama: 'http://localhost:11434',
  'llama.cpp': 'http://localhost:8080',
  vllm: 'http://localhost:8000',
  lmstudio: 'http://localhost:1234',
  'openai-completions': '',
  'openai-responses': '',
  'anthropic-messages': ''
}

function isAutoDiscoveryType(type: CustomProviderType): type is AutoDiscoveryProviderType {
  return AUTO_DISCOVERY_TYPES.includes(type as AutoDiscoveryProviderType)
}

function CustomProviderModal({
  provider,
  initialType,
  onSave,
  onClose
}: {
  provider?: CustomProvider
  initialType?: CustomProviderType
  onSave?: () => void
  onClose: () => void
}): React.JSX.Element {
  const [name, setName] = useState(provider?.name || '')
  const [type, setType] = useState<CustomProviderType>(provider?.type || initialType || 'openai-completions')
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl || DEFAULT_BASE_URLS[provider?.type || initialType || 'openai-completions'])
  const [apiKey, setApiKey] = useState(provider?.apiKey || '')
  const [testing, setTesting] = useState(false)
  const [testError, setTestError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [discoveredModels, setDiscoveredModels] = useState<Model<any>[]>(provider?.models || [])

  const autoDiscovery = useMemo(() => isAutoDiscoveryType(type), [type])

  const testConnection = async () => {
    if (!autoDiscovery) return

    setTesting(true)
    setTestError('')
    setDiscoveredModels([])

    try {
      const models = await discoverModels(type as AutoDiscoveryProviderType, baseUrl, apiKey || undefined)
      setDiscoveredModels(
        models.map((model) => ({
          ...model,
          provider: name || type
        }))
      )
    } catch (error) {
      setTestError(error instanceof Error ? error.message : String(error))
      setDiscoveredModels([])
    } finally {
      setTesting(false)
    }
  }

  const save = async () => {
    if (!name || !baseUrl) {
      setSaveError(i18n('Please fill in all required fields'))
      return
    }

    setSaveError('')

    try {
      const customProvider: CustomProvider = {
        id: provider?.id || crypto.randomUUID(),
        name,
        type,
        baseUrl,
        apiKey: apiKey || undefined,
        models: autoDiscovery ? undefined : provider?.models || []
      }

      await getAppStorage().customProviders.set(customProvider)
      onSave?.()
      onClose()
    } catch (error) {
      console.error('Failed to save provider:', error)
      setSaveError(i18n('Failed to save provider'))
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-h-[90vh] sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>{provider ? i18n('Edit Provider') : i18n('Add Provider')}</DialogTitle>
          <DialogDescription>
            {i18n('Configure custom model provider settings and optional model auto-discovery.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-1">
          {saveError ? (
            <div className="rounded-md border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <div className="font-medium">Save failed</div>
              <div className="mt-1">{saveError}</div>
            </div>
          ) : null}

          <div className="space-y-2">
            <label htmlFor="provider-name" className="text-xs font-medium text-foreground">
              {i18n('Provider Name')}
            </label>
            <Input
              id="provider-name"
              value={name}
              placeholder={i18n('e.g., My Ollama Server')}
              onChange={(event) => {
                setName(event.target.value)
              }}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="provider-type" className="text-xs font-medium text-foreground">
              {i18n('Provider Type')}
            </label>
            <select
              id="provider-type"
              className="border-input bg-input/20 dark:bg-input/30 h-7 w-full rounded-md border px-2 text-xs/relaxed outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              value={type}
              onChange={(event) => {
                const nextType = event.target.value as CustomProviderType
                setType(nextType)
                setBaseUrl(DEFAULT_BASE_URLS[nextType])
                setDiscoveredModels([])
                setTestError('')
              }}
            >
              {PROVIDER_TYPES.map((providerType) => (
                <option key={providerType.value} value={providerType.value}>
                  {providerType.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="base-url" className="text-xs font-medium text-foreground">
              {i18n('Base URL')}
            </label>
            <Input
              id="base-url"
              value={baseUrl}
              placeholder={i18n('e.g., http://localhost:11434')}
              onChange={(event) => {
                setBaseUrl(event.target.value)
              }}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="api-key" className="text-xs font-medium text-foreground">
              {i18n('API Key (Optional)')}
            </label>
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              placeholder={i18n('Leave empty if not required')}
              onChange={(event) => {
                setApiKey(event.target.value)
              }}
            />
          </div>

          {autoDiscovery ? (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void testConnection()
                }}
                disabled={testing || !baseUrl}
              >
                {testing ? i18n('Testing...') : i18n('Test Connection')}
              </Button>

              {testError ? <div className="text-sm text-destructive">{testError}</div> : null}

              {discoveredModels.length > 0 ? (
                <div className="text-sm text-muted-foreground">
                  {i18n('Discovered')} {discoveredModels.length} {i18n('models')}:
                  <ul className="mt-2 ml-4 list-disc space-y-1">
                    {discoveredModels.slice(0, 5).map((model) => (
                      <li key={model.id}>{model.name}</li>
                    ))}
                    {discoveredModels.length > 5 ? (
                      <li>
                        ...{i18n('and')} {discoveredModels.length - 5} {i18n('more')}
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              {i18n('For manual provider types, add models after saving the provider.')}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {i18n('Cancel')}
          </Button>
          <Button type="button" onClick={() => void save()} disabled={!name || !baseUrl}>
            {i18n('Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export class CustomProviderDialog {
  static async open(
    provider: CustomProvider | undefined,
    initialType: CustomProviderType | undefined,
    onSave?: () => void
  ): Promise<void> {
    mountDialog((destroy) => (
      <CustomProviderModal
        provider={provider}
        initialType={initialType}
        onSave={onSave}
        onClose={destroy}
      />
    ))
  }
}
