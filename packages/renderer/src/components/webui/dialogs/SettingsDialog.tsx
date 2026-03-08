import { useEffect, useState } from 'react'
import { getProviders } from '@renderer/lib/piAiBrowserShim'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
import { getAppStorage } from '@renderer/features/webui/storage/app-storage.js'
import { i18n } from '@renderer/features/webui/utils/i18n.js'
import { ProviderKeyInputView } from '../ProviderKeyInputView'
import { mountDialog } from './dialogHost'

export abstract class SettingsTab {
  abstract getTabName(): string
  abstract render(): React.JSX.Element
}

function ApiKeysTabView(): React.JSX.Element {
  const providers = getProviders()

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        {i18n('Configure API keys for LLM providers. Keys are stored locally in your browser.')}
      </p>
      {providers.map((provider) => (
        <ProviderKeyInputView key={provider} provider={provider} />
      ))}
    </div>
  )
}

function ProxyTabView(): React.JSX.Element {
  const [proxyEnabled, setProxyEnabled] = useState(false)
  const [proxyUrl, setProxyUrl] = useState('http://localhost:3001')

  useEffect(() => {
    let cancelled = false

    const loadSettings = async () => {
      try {
        const storage = getAppStorage()
        const enabled = await storage.settings.get<boolean>('proxy.enabled')
        const url = await storage.settings.get<string>('proxy.url')

        if (!cancelled) {
          if (enabled !== null) {
            setProxyEnabled(enabled)
          }
          if (url !== null) {
            setProxyUrl(url)
          }
        }
      } catch (error) {
        console.error('Failed to load proxy settings:', error)
      }
    }

    void loadSettings()

    return () => {
      cancelled = true
    }
  }, [])

  const saveProxySettings = async (enabled: boolean, url: string) => {
    try {
      const storage = getAppStorage()
      await storage.settings.set('proxy.enabled', enabled)
      await storage.settings.set('proxy.url', url)
    } catch (error) {
      console.error('Failed to save proxy settings:', error)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {i18n(
          'Allows browser-based apps to bypass CORS restrictions when calling LLM providers. Required for Z-AI and Anthropic with OAuth token.'
        )}
      </p>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{i18n('Use CORS Proxy')}</span>
        <Switch
          checked={proxyEnabled}
          onCheckedChange={(checked) => {
            const enabled = checked === true
            setProxyEnabled(enabled)
            void saveProxySettings(enabled, proxyUrl)
          }}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="proxy-url" className="text-xs font-medium text-foreground">
          {i18n('Proxy URL')}
        </label>
        <Input
          id="proxy-url"
          value={proxyUrl}
          disabled={!proxyEnabled}
          onChange={(event) => {
            setProxyUrl(event.target.value)
          }}
          onBlur={() => {
            void saveProxySettings(proxyEnabled, proxyUrl)
          }}
        />
        <p className="text-xs text-muted-foreground">
          {i18n('Format: The proxy must accept requests as <proxy-url>/?url=<target-url>')}
        </p>
      </div>
    </div>
  )
}

export class ApiKeysTab extends SettingsTab {
  getTabName(): string {
    return i18n('API Keys')
  }

  render(): React.JSX.Element {
    return <ApiKeysTabView />
  }
}

export class ProxyTab extends SettingsTab {
  getTabName(): string {
    return i18n('Proxy')
  }

  render(): React.JSX.Element {
    return <ProxyTabView />
  }
}

function SettingsModal({
  tabs,
  onClose
}: {
  tabs: SettingsTab[]
  onClose: () => void
}): React.JSX.Element | null {
  const [activeTabIndex, setActiveTabIndex] = useState(0)

  if (!tabs.length) {
    return null
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
      <DialogContent className="sm:h-[90vh] sm:max-w-[1000px]">
        <DialogHeader className="border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle>{i18n('Settings')}</DialogTitle>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              {i18n('Cancel')}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex h-full flex-col overflow-hidden">
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border pb-3 md:hidden">
            {tabs.map((tab, index) => {
              const isActive = activeTabIndex === index
              return (
                <button
                  key={tab.getTabName()}
                  type="button"
                  className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => {
                    setActiveTabIndex(index)
                  }}
                >
                  {tab.getTabName()}
                </button>
              )
            })}
          </div>

          <div className="flex flex-1 overflow-hidden pt-4">
            <div className="hidden w-64 shrink-0 space-y-1 md:block">
              {tabs.map((tab, index) => {
                const isActive = activeTabIndex === index
                return (
                  <button
                    key={tab.getTabName()}
                    type="button"
                    className={`inline-flex h-9 w-full items-center justify-start rounded-md px-4 text-left text-sm transition-colors ${
                      isActive
                        ? 'bg-muted font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    }`}
                    onClick={() => {
                      setActiveTabIndex(index)
                    }}
                  >
                    {tab.getTabName()}
                  </button>
                )
              })}
            </div>

            <div className="flex-1 overflow-y-auto md:pl-6">{tabs[activeTabIndex].render()}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export class SettingsDialog {
  static async open(tabs: SettingsTab[]): Promise<void> {
    mountDialog((destroy) => <SettingsModal tabs={tabs} onClose={destroy} />)
  }
}
