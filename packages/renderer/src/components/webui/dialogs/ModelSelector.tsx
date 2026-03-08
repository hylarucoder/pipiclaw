import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Brain, Check, Image as ImageIcon, X } from 'lucide-react'
import type { Model } from '@mariozechner/pi-ai'
import { getModels, getProviders, modelsAreEqual } from '@renderer/lib/piAiBrowserShim'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { getAppStorage } from '@renderer/features/webui/storage/app-storage.js'
import type { AutoDiscoveryProviderType } from '@renderer/features/webui/storage/stores/custom-providers-store.js'
import { formatModelCost } from '@renderer/features/webui/utils/format.js'
import { i18n } from '@renderer/features/webui/utils/i18n.js'
import { discoverModels } from '@renderer/features/webui/utils/model-discovery.js'

type ModelItem = { provider: string; id: string; model: Model<any> }

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(0)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}`
  return String(tokens)
}

function collectModels(customProviderModels: Model<any>[]): ModelItem[] {
  const allModels: ModelItem[] = []
  for (const provider of getProviders()) {
    for (const model of getModels(provider as any)) {
      allModels.push({ provider, id: model.id, model })
    }
  }

  for (const model of customProviderModels) {
    allModels.push({ provider: model.provider, id: model.id, model })
  }

  return allModels
}

function ModelSelectorModal({
  currentModel,
  onClose,
  onSelect
}: {
  currentModel: Model<any> | null
  onClose: () => void
  onSelect: (model: Model<any>) => void
}): React.JSX.Element {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterThinking, setFilterThinking] = useState(false)
  const [filterVision, setFilterVision] = useState(false)
  const [customProvidersLoading, setCustomProvidersLoading] = useState(false)
  const [customProviderModels, setCustomProviderModels] = useState<Model<any>[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [navigationMode, setNavigationMode] = useState<'mouse' | 'keyboard'>('mouse')

  const panelRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const lastMousePositionRef = useRef({ x: 0, y: 0 })

  const filteredModels = useMemo(() => {
    let models = collectModels(customProviderModels)

    if (searchQuery.trim()) {
      const searchTokens = searchQuery
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)

      models = models.filter(({ provider, id, model }) => {
        const text = `${provider} ${id} ${model.name}`.toLowerCase()
        return searchTokens.every((token) => text.includes(token))
      })
    }

    if (filterThinking) {
      models = models.filter(({ model }) => model.reasoning)
    }

    if (filterVision) {
      models = models.filter(({ model }) => model.input.includes('image'))
    }

    models.sort((a, b) => {
      const aIsCurrent = modelsAreEqual(currentModel, a.model)
      const bIsCurrent = modelsAreEqual(currentModel, b.model)
      if (aIsCurrent && !bIsCurrent) return -1
      if (!aIsCurrent && bIsCurrent) return 1
      return a.provider.localeCompare(b.provider)
    })

    return models
  }, [currentModel, customProviderModels, filterThinking, filterVision, searchQuery])

  useEffect(() => {
    const storage = getAppStorage()
    let cancelled = false

    const loadCustomProviders = async () => {
      setCustomProvidersLoading(true)
      const allCustomModels: Model<any>[] = []

      try {
        const customProviders = await storage.customProviders.getAll()
        for (const provider of customProviders) {
          const isAutoDiscovery =
            provider.type === 'ollama' ||
            provider.type === 'llama.cpp' ||
            provider.type === 'vllm' ||
            provider.type === 'lmstudio'

          if (isAutoDiscovery) {
            try {
              const models = await discoverModels(
                provider.type as AutoDiscoveryProviderType,
                provider.baseUrl,
                provider.apiKey
              )
              allCustomModels.push(...models.map((model) => ({ ...model, provider: provider.name })))
            } catch (error) {
              console.debug(`Failed to load models from ${provider.name}:`, error)
            }
            continue
          }

          if (provider.models) {
            allCustomModels.push(...provider.models)
          }
        }
      } catch (error) {
        console.error('Failed to load custom providers:', error)
      } finally {
        if (!cancelled) {
          setCustomProviderModels(allCustomModels)
          setCustomProvidersLoading(false)
        }
      }
    }

    void loadCustomProviders()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (filteredModels.length === 0) {
      setSelectedIndex(0)
      return
    }
    if (selectedIndex >= filteredModels.length) {
      setSelectedIndex(filteredModels.length - 1)
    }
  }, [filteredModels.length, selectedIndex])

  useEffect(() => {
    if (navigationMode !== 'keyboard') return
    const container = scrollContainerRef.current
    if (!container) return
    const selected = container.querySelectorAll('[data-model-item]')[selectedIndex] as HTMLElement | undefined
    selected?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [navigationMode, selectedIndex])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (filteredModels.length === 0) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setNavigationMode('keyboard')
        setSelectedIndex((prev) => Math.min(prev + 1, filteredModels.length - 1))
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setNavigationMode('keyboard')
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        const item = filteredModels[selectedIndex]
        if (item) {
          onSelect(item.model)
          onClose()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [filteredModels, onClose, onSelect, selectedIndex])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseMove={(event) => {
        const last = lastMousePositionRef.current
        if (event.clientX !== last.x || event.clientY !== last.y) {
          lastMousePositionRef.current = { x: event.clientX, y: event.clientY }
          if (navigationMode === 'keyboard') {
            setNavigationMode('mouse')
          }
        }
      }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="flex h-[min(80vh,720px)] w-[min(400px,90vw)] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">{i18n('Select Model')}</h2>
          <Button size="icon-sm" variant="ghost" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-b border-border p-4">
          <input
            ref={searchInputRef}
            className="bg-input/20 dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/30 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 file:text-foreground placeholder:text-muted-foreground h-7 w-full min-w-0 rounded-md border px-2 py-0.5 text-sm transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs/relaxed file:font-medium focus-visible:ring-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2 md:text-xs/relaxed"
            placeholder={i18n('Search models...')}
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value)
              setSelectedIndex(0)
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = 0
              }
            }}
          />
          <div className="flex gap-2">
            <Button
              variant={filterThinking ? 'default' : 'secondary'}
              size="sm"
              className="rounded-full"
              onClick={() => {
                setFilterThinking((prev) => !prev)
                setSelectedIndex(0)
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollTop = 0
                }
              }}
            >
              <Brain className="size-3.5" />
              {i18n('Thinking')}
            </Button>
            <Button
              variant={filterVision ? 'default' : 'secondary'}
              size="sm"
              className="rounded-full"
              onClick={() => {
                setFilterVision((prev) => !prev)
                setSelectedIndex(0)
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollTop = 0
                }
              }}
            >
              <ImageIcon className="size-3.5" />
              {i18n('Vision')}
            </Button>
          </div>
        </div>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
          {filteredModels.map(({ provider, id, model }, index) => {
            const isCurrent = modelsAreEqual(currentModel, model)
            const isSelected = index === selectedIndex
            return (
              <button
                key={`${provider}:${id}:${index}`}
                type="button"
                data-model-item
                className={cn(
                  'w-full cursor-pointer border-b border-border px-4 py-3 text-left',
                  navigationMode === 'mouse' ? 'hover:bg-muted' : '',
                  isSelected ? 'bg-accent' : ''
                )}
                onClick={() => {
                  onSelect(model)
                  onClose()
                }}
                onMouseEnter={() => {
                  if (navigationMode === 'mouse') {
                    setSelectedIndex(index)
                  }
                }}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{id}</span>
                    {isCurrent ? <Check className="size-4 text-green-500" /> : null}
                  </div>
                  <Badge variant="outline">{provider}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className={model.reasoning ? '' : 'opacity-30'}>
                      <Brain className="size-3.5" />
                    </span>
                    <span className={model.input.includes('image') ? '' : 'opacity-30'}>
                      <ImageIcon className="size-3.5" />
                    </span>
                    <span>
                      {formatTokens(model.contextWindow)}K/{formatTokens(model.maxTokens)}K
                    </span>
                  </div>
                  <span>{formatModelCost(model.cost)}</span>
                </div>
              </button>
            )
          })}

          {!customProvidersLoading && filteredModels.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">No models found</div>
          ) : null}
          {customProvidersLoading ? (
            <div className="px-4 py-2 text-center text-xs text-muted-foreground">Loading...</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export class ModelSelector {
  static async open(currentModel: Model<any> | null, onSelect: (model: Model<any>) => void): Promise<void> {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    const close = () => {
      root.unmount()
      host.remove()
    }

    root.render(
      <ModelSelectorModal
        currentModel={currentModel}
        onClose={close}
        onSelect={(model) => {
          onSelect(model)
        }}
      />
    )
  }
}
