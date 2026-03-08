import { useEffect, useMemo, useState } from 'react'
import type { Context } from '@mariozechner/pi-ai'
import { complete, getModel } from '@renderer/lib/piAiBrowserShim'
import { Button } from '@renderer/components/ui/button'
import { i18n } from '@renderer/features/webui/utils/i18n.js'
import { getAppStorage } from '@renderer/features/webui/storage/app-storage.js'
import { applyProxyIfNeeded } from '@renderer/features/webui/utils/proxy-utils.js'
import { Input } from './InputView'

const TEST_MODELS: Record<string, string> = {
  anthropic: 'claude-3-5-haiku-20241022',
  openai: 'gpt-4o-mini',
  google: 'gemini-2.5-flash',
  groq: 'openai/gpt-oss-20b',
  openrouter: 'z-ai/glm-4.6',
  'vercel-ai-gateway': 'anthropic/claude-opus-4.5',
  cerebras: 'gpt-oss-120b',
  xai: 'grok-4-fast-non-reasoning',
  zai: 'glm-4.5-air'
}

export interface ProviderKeyInputProps {
  provider: string
}

export function ProviderKeyInputView({ provider }: ProviderKeyInputProps): React.JSX.Element {
  const [keyInput, setKeyInput] = useState('')
  const [testing, setTesting] = useState(false)
  const [failed, setFailed] = useState(false)
  const [hasKey, setHasKey] = useState(false)
  const [inputChanged, setInputChanged] = useState(false)

  useEffect(() => {
    let cancelled = false

    const checkKeyStatus = async () => {
      try {
        const key = await getAppStorage().providerKeys.get(provider)
        if (!cancelled) {
          setHasKey(Boolean(key))
        }
      } catch (error) {
        console.error('Failed to check key status:', error)
      }
    }

    void checkKeyStatus()

    return () => {
      cancelled = true
    }
  }, [provider])

  const invalid = useMemo(() => failed, [failed])

  const testApiKey = async (providerId: string, apiKey: string): Promise<boolean> => {
    try {
      const modelId = TEST_MODELS[providerId]
      if (!modelId) return true

      let model = getModel(providerId as never, modelId)
      if (!model) return false

      const proxyEnabled = await getAppStorage().settings.get<boolean>('proxy.enabled')
      const proxyUrl = await getAppStorage().settings.get<string>('proxy.url')

      model = applyProxyIfNeeded(model, apiKey, proxyEnabled ? proxyUrl || undefined : undefined)

      const context: Context = {
        messages: [{ role: 'user', content: 'Reply with: ok', timestamp: Date.now() }]
      }

      const result = await complete(model, context, {
        apiKey,
        maxTokens: 200
      } as never)

      return result.stopReason === 'stop'
    } catch (error) {
      console.error(`API key test failed for ${providerId}:`, error)
      return false
    }
  }

  const saveKey = async () => {
    if (!keyInput) return

    setTesting(true)
    setFailed(false)

    const success = await testApiKey(provider, keyInput)
    setTesting(false)

    if (!success) {
      setFailed(true)
      window.setTimeout(() => {
        setFailed(false)
      }, 5000)
      return
    }

    try {
      await getAppStorage().providerKeys.set(provider, keyInput)
      setHasKey(true)
      setInputChanged(false)
    } catch (error) {
      console.error('Failed to save API key:', error)
      setFailed(true)
      window.setTimeout(() => {
        setFailed(false)
      }, 5000)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium capitalize text-foreground">{provider}</span>
        {testing ? (
          <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {i18n('Testing...')}
          </span>
        ) : hasKey ? (
          <span className="text-green-600 dark:text-green-400">✓</span>
        ) : null}

        {invalid ? (
          <span className="inline-flex items-center rounded-full border border-destructive/35 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
            {i18n('✗ Invalid')}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="password"
          placeholder={hasKey ? '••••••••••••' : i18n('Enter API key')}
          value={keyInput}
          onInput={(event) => {
            const target = event.target as HTMLInputElement
            setKeyInput(target.value)
            setInputChanged(true)
          }}
          className="flex-1"
        />

        <Button
          type="button"
          size="sm"
          onClick={() => {
            void saveKey()
          }}
          disabled={!keyInput || testing || (hasKey && !inputChanged)}
        >
          {i18n('Save')}
        </Button>
      </div>
    </div>
  )
}
