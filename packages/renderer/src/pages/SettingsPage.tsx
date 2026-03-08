import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Save, Settings2 } from 'lucide-react'
import { complete } from '@renderer/lib/piAiBrowserShim'
import { resolvePiModelRuntime } from '@pipiclaw/agent-core'
import { useTranslation } from 'react-i18next'
import { NavigationRail } from '@renderer/components/NavigationRail'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Checkbox } from '@renderer/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@renderer/components/ui/card'
import { Input } from '@renderer/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Textarea } from '@renderer/components/ui/textarea'
import { cn } from '@renderer/lib/utils'
import {
  type AppLanguage,
  type AppSettings,
  type AppSettingsUpdateInput,
  type DefaultRoute,
  type ModelProviderKey,
  type ModelProviderSettings
} from '@pipiclaw/shared/rpc/settings'
import {
  MODEL_PROVIDER_CONFIGS,
  MODEL_PROVIDER_KEYS,
  MODEL_RUNTIME_APIS,
  type ModelRuntimeApi
} from '@pipiclaw/shared/config/modelProviders'
import {
  invokeSettingsGet,
  invokeSettingsReset,
  invokeSettingsUpdate
} from '@renderer/lib/settings'

const unifiedHeaderClass = 'border-b border-border/70 bg-card/70 text-foreground'

type SettingsSection = 'general' | 'models'

type ProviderPingState = {
  status: 'idle' | 'checking' | 'ok' | 'error'
  message: string
  latencyMs?: number
}

const RUNTIME_API_LABELS: Record<ModelRuntimeApi, 'runtimeApiOpenAICompletions' | 'runtimeApiOpenAIResponses' | 'runtimeApiAnthropicMessages'> = {
  'openai-completions': 'runtimeApiOpenAICompletions',
  'openai-responses': 'runtimeApiOpenAIResponses',
  'anthropic-messages': 'runtimeApiAnthropicMessages'
}

function normalizeModelCatalogInput(raw: string): string[] {
  const items = raw
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  return [...new Set(items)]
}

export interface SettingsPageProps {
  settings: AppSettings
  settingsLoading: boolean
  settingsError: string | null
  onSettingsChanged: (settings: AppSettings) => void
  onRefreshSettings: () => Promise<void>
}

export function SettingsPage({
  settings,
  settingsLoading,
  settingsError,
  onSettingsChanged,
  onRefreshSettings
}: SettingsPageProps): React.JSX.Element {
  const { t } = useTranslation('settings')
  const [draft, setDraft] = useState<AppSettings>(settings)
  const [saving, setSaving] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null)
  const [activeSection, setActiveSection] = useState<SettingsSection>('general')
  const [focusedProvider, setFocusedProvider] = useState<ModelProviderKey>(
    settings.models.activeProvider
  )
  const [providerPingState, setProviderPingState] = useState<
    Partial<Record<ModelProviderKey, ProviderPingState>>
  >({})

  const defaultRouteLabels = useMemo<Record<DefaultRoute, string>>(
    () => ({
      '/notes': t('routeNotes'),
      '/files': t('routeFiles'),
      '/journal': t('routeJournal'),
      '/kanban': t('routeKanban'),
      '/draw': t('routeDraw'),
      '/chat': t('routeChat')
    }),
    [t]
  )

  const sectionLabels = useMemo<Record<SettingsSection, string>>(
    () => ({
      general: t('sectionGeneral'),
      models: t('sectionModels')
    }),
    [t]
  )

  useEffect(() => {
    setDraft(settings)
    setProviderPingState({})
  }, [settings])

  useEffect(() => {
    setFocusedProvider(draft.models.activeProvider)
  }, [draft.models.activeProvider])

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(settings),
    [draft, settings]
  )
  const isGeneralDirty = useMemo(
    () =>
      JSON.stringify({
        workspace: draft.workspace,
        preview: draft.preview
      }) !==
      JSON.stringify({
        workspace: settings.workspace,
        preview: settings.preview
      }),
    [draft.preview, draft.workspace, settings.preview, settings.workspace]
  )
  const isModelsDirty = useMemo(
    () => JSON.stringify(draft.models) !== JSON.stringify(settings.models),
    [draft.models, settings.models]
  )

  const activeProvider = draft.models.activeProvider
  const activeProviderConfig = MODEL_PROVIDER_CONFIGS[activeProvider]
  const focusedProviderConfig = MODEL_PROVIDER_CONFIGS[focusedProvider]
  const focusedProviderSettings = draft.models.providers[focusedProvider]
  const focusedPingState = providerPingState[focusedProvider]

  const pingProvider = async (providerKey: ModelProviderKey): Promise<void> => {
    const providerConfig = MODEL_PROVIDER_CONFIGS[providerKey]
    const providerSettings = draft.models.providers[providerKey]
    const selectedModelId =
      providerSettings.modelPrimary.trim() || providerConfig.defaultModelPrimary

    setProviderPingState((prev) => ({
      ...prev,
      [providerKey]: {
        status: 'checking',
        message: t('pingChecking')
      }
    }))

    const resolved = resolvePiModelRuntime(draft, {
      providerKey,
      modelId: selectedModelId
    })

    if (!resolved.runtime) {
      setProviderPingState((prev) => ({
        ...prev,
        [providerKey]: {
          status: 'error',
          message: resolved.error ?? t('runtimeResolveFailed')
        }
      }))
      return
    }

    const startedAt = Date.now()
    try {
      await complete(
        resolved.runtime.model,
        {
          messages: [
            {
              role: 'user',
              content: 'Reply with: pong',
              timestamp: Date.now()
            }
          ]
        },
        {
          apiKey: resolved.runtime.apiKey,
          maxTokens: 20
        } as never
      )

      const latencyMs = Date.now() - startedAt
      setProviderPingState((prev) => ({
        ...prev,
        [providerKey]: {
          status: 'ok',
          message: t('pingOk', { latencyMs }),
          latencyMs
        }
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : t('pingFailed')
      setProviderPingState((prev) => ({
        ...prev,
        [providerKey]: {
          status: 'error',
          message
        }
      }))
    }
  }

  const updateProviderField = (
    providerKey: ModelProviderKey,
    key: keyof Pick<ModelProviderSettings, 'apiKey' | 'baseUrl' | 'modelPrimary' | 'modelFast' | 'runtimeApi'>,
    value: string | ModelRuntimeApi
  ): void => {
    setDraft((prev) => ({
      ...prev,
      models: {
        ...prev.models,
        providers: {
          ...prev.models.providers,
          [providerKey]: {
            ...prev.models.providers[providerKey],
            [key]: value
          }
        }
      }
    }))
  }

  const updateProviderModelCatalog = (providerKey: ModelProviderKey, rawValue: string): void => {
    const modelCatalog = normalizeModelCatalogInput(rawValue)
    setDraft((prev) => ({
      ...prev,
      models: {
        ...prev.models,
        providers: {
          ...prev.models.providers,
          [providerKey]: {
            ...prev.models.providers[providerKey],
            modelCatalog
          }
        }
      }
    }))
  }

  const appendCatalogModel = (providerKey: ModelProviderKey, modelId: string): void => {
    const normalized = modelId.trim()
    if (!normalized) return

    setDraft((prev) => {
      const currentCatalog = prev.models.providers[providerKey].modelCatalog
      if (currentCatalog.includes(normalized)) return prev
      return {
        ...prev,
        models: {
          ...prev.models,
          providers: {
            ...prev.models.providers,
            [providerKey]: {
              ...prev.models.providers[providerKey],
              modelCatalog: [...currentCatalog, normalized]
            }
          }
        }
      }
    })
  }

  const persistSettingsPatch = async (
    patch: AppSettingsUpdateInput,
    options?: { successMessage?: string }
  ): Promise<void> => {
    setSaving(true)
    setMessage(null)
    setMessageType(null)

    try {
      const result = await invokeSettingsUpdate(patch)
      onSettingsChanged(result.settings)
      setMessageType(result.error ? 'error' : 'success')
      setMessage(result.error ?? options?.successMessage ?? t('settingsSaved'))
    } catch (error) {
      setMessageType('error')
      setMessage(error instanceof Error ? error.message : t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const saveGeneralSettings = async (): Promise<void> => {
    await persistSettingsPatch(
      {
        workspace: draft.workspace,
        preview: draft.preview
      },
      { successMessage: t('settingsSaved') }
    )
  }

  const saveModelSettings = async (): Promise<void> => {
    await persistSettingsPatch(
      {
        models: draft.models
      },
      { successMessage: t('modelsSaved') }
    )
  }

  const reloadSettings = async (): Promise<void> => {
    setMessage(null)
    setMessageType(null)

    try {
      const result = await invokeSettingsGet()
      onSettingsChanged(result.settings)
      setMessageType(result.error ? 'error' : 'success')
      setMessage(result.error ?? t('settingsReloaded'))
    } catch (error) {
      setMessageType('error')
      setMessage(error instanceof Error ? error.message : t('reloadFailed'))
    }

    await onRefreshSettings()
  }

  const resetSettings = async (): Promise<void> => {
    setSaving(true)
    setMessage(null)
    setMessageType(null)

    try {
      const result = await invokeSettingsReset()
      onSettingsChanged(result.settings)
      setMessageType(result.error ? 'error' : 'success')
      setMessage(result.error ?? t('settingsReset'))
    } catch (error) {
      setMessageType('error')
      setMessage(error instanceof Error ? error.message : t('resetFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="[-webkit-app-region:drag] h-8 shrink-0 border-b border-border/70 bg-card/70 px-2.5">
        <div className="flex h-full items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium tracking-wide text-foreground">{t('brand')}</span>
          <span>{t('pageTitle')}</span>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-x-auto p-2">
        <div className="grid h-full min-w-[1140px] w-full gap-2 grid-cols-[44px_minmax(0,1fr)]">
          <NavigationRail />

          <div className="flex h-full min-h-0 flex-col gap-2">
            <Card className="overflow-hidden border-primary/25">
              <CardContent className="bg-gradient-to-br from-primary/20 via-secondary/10 to-accent/25 p-2.5 text-foreground">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t('centerLabel')}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold">{t('centerTitle')}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{t('centerDescription')}</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-background/65 px-2.5 py-1.5 text-right">
                    <p className="text-[10px] text-muted-foreground">{t('currentProvider')}</p>
                    <p className="text-base font-semibold text-foreground">
                      {activeProviderConfig.label}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[260px_minmax(0,1fr)]">
              <Card className="h-full overflow-auto">
                <CardHeader className={cn(unifiedHeaderClass, 'gap-2')}>
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary">
                      <Settings2 className="size-4" />
                    </span>
                    <div>
                      <CardTitle>{t('navTitle')}</CardTitle>
                      <CardDescription>{t('navDescription')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2.5 p-2.5">
                  <div className="flex flex-col gap-1.5">
                    {(Object.keys(sectionLabels) as SettingsSection[]).map((section) => (
                      <Button
                        key={section}
                        size="sm"
                        variant={activeSection === section ? 'default' : 'outline'}
                        className="justify-start"
                        onClick={() => setActiveSection(section)}
                      >
                        {sectionLabels[section]}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="h-full overflow-auto">
                <CardHeader className={cn(unifiedHeaderClass, 'gap-1.5')}>
                  <CardTitle>
                    {activeSection === 'general' ? t('generalTitle') : t('modelsTitle')}
                  </CardTitle>
                  <CardDescription>
                    {activeSection === 'general' ? t('generalDescription') : t('modelsDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2.5 p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isDirty && <Badge variant="secondary">{t('badgeDirty')}</Badge>}
                    {settingsLoading && <Badge variant="secondary">{t('badgeLoading')}</Badge>}
                    {settingsError && (
                      <Badge variant="secondary" className="text-destructive">
                        {settingsError}
                      </Badge>
                    )}
                  </div>

                  {message && (
                    <div
                      className={cn(
                        'rounded-md border px-2 py-1 text-xs',
                        messageType === 'error'
                          ? 'border-destructive/40 bg-destructive/10 text-destructive'
                          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
                      )}
                    >
                      {message}
                    </div>
                  )}

                  {activeSection === 'general' && (
                    <div className="space-y-3">
                      <div className="grid gap-2 md:grid-cols-2">
                        <Card>
                          <CardHeader className={unifiedHeaderClass}>
                            <CardTitle className="text-base">{t('workspaceCardTitle')}</CardTitle>
                            <CardDescription>{t('workspaceCardDescription')}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3 pt-3">
                            <label className="block space-y-1">
                              <span className="text-xs text-muted-foreground">
                                {t('notesRootDirLabel')}
                              </span>
                              <Input
                                value={draft.workspace.notesRootDir}
                                onChange={(event) =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    workspace: {
                                      ...prev.workspace,
                                      notesRootDir: event.target.value
                                    }
                                  }))
                                }
                                placeholder="/Users/yourname/Workspace/PKM/Notes"
                              />
                            </label>

                            <label className="block space-y-1">
                              <span className="text-xs text-muted-foreground">
                                {t('defaultRouteLabel')}
                              </span>
                              <Select
                                value={draft.workspace.defaultRoute}
                                onValueChange={(value) =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    workspace: {
                                      ...prev.workspace,
                                      defaultRoute: value as DefaultRoute
                                    }
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={t('defaultRouteLabel')} />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(defaultRouteLabels).map(([route, label]) => (
                                    <SelectItem key={route} value={route}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </label>

                            <label className="block space-y-1">
                              <span className="text-xs text-muted-foreground">
                                {t('languageLabel')}
                              </span>
                              <Select
                                value={draft.workspace.language}
                                onValueChange={(value) =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    workspace: {
                                      ...prev.workspace,
                                      language: value as AppLanguage
                                    }
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={t('languageLabel')} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="zh-CN">{t('languageZhCN')}</SelectItem>
                                  <SelectItem value="en-US">{t('languageEnUS')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </label>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className={unifiedHeaderClass}>
                            <CardTitle className="text-base">{t('previewCardTitle')}</CardTitle>
                            <CardDescription>{t('previewCardDescription')}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3 pt-3">
                            <label className="block space-y-1">
                              <span className="text-xs text-muted-foreground">
                                {t('previewMaxCharsLabel')}
                              </span>
                              <Input
                                type="number"
                                min={200}
                                max={200000}
                                value={draft.preview.maxChars}
                                onChange={(event) =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    preview: {
                                      ...prev.preview,
                                      maxChars: Number(event.target.value) || prev.preview.maxChars
                                    }
                                  }))
                                }
                              />
                            </label>

                            <label className="block space-y-1">
                              <span className="text-xs text-muted-foreground">
                                {t('previewMaxAssetBytesLabel')}
                              </span>
                              <Input
                                type="number"
                                min={1024}
                                max={100 * 1024 * 1024}
                                value={draft.preview.maxAssetBytes}
                                onChange={(event) =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    preview: {
                                      ...prev.preview,
                                      maxAssetBytes:
                                        Number(event.target.value) || prev.preview.maxAssetBytes
                                    }
                                  }))
                                }
                              />
                            </label>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 border-t border-border/70 pt-2">
                        <Button
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() => void saveGeneralSettings()}
                          disabled={saving || !isGeneralDirty}
                        >
                          <Save className="mr-1 size-4" />
                          {saving ? t('actionSaving') : t('actionSave')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => void reloadSettings()}
                        >
                          <RefreshCw className="mr-1 size-4" />
                          {t('actionReload')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => void resetSettings()}
                          disabled={saving}
                        >
                          {t('actionReset')}
                        </Button>
                      </div>
                    </div>
                  )}

                  {activeSection === 'models' && (
                    <div className="space-y-3">
                      <div className="grid gap-2 xl:grid-cols-[320px_minmax(0,1fr)]">
                        <Card className="h-full overflow-auto">
                          <CardHeader className={unifiedHeaderClass}>
                            <CardTitle className="text-base">{t('summaryProvider')}</CardTitle>
                            <CardDescription>{t('modelsDescription')}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-2 pt-3">
                            {MODEL_PROVIDER_KEYS.map((providerKey) => {
                              const providerConfig = MODEL_PROVIDER_CONFIGS[providerKey]
                              const pingState = providerPingState[providerKey]
                              const isActive = activeProvider === providerKey
                              const isFocused = focusedProvider === providerKey
                              const hasApiKey =
                                draft.models.providers[providerKey].apiKey.trim().length > 0

                              return (
                                <div
                                  key={providerKey}
                                  className={cn(
                                    'rounded-lg border border-border/70 p-2 transition-colors',
                                    isFocused && 'border-primary/45 bg-primary/8'
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setFocusedProvider(providerKey)}
                                      className="h-auto justify-start p-0 text-left"
                                    >
                                      <span className="flex flex-col items-start">
                                        <p className="text-sm font-medium text-foreground">
                                          {providerConfig.label}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">
                                          {providerConfig.providerId}
                                        </p>
                                      </span>
                                    </Button>
                                    <div className="flex items-center gap-1">
                                      {isActive && (
                                        <Badge variant="secondary">{t('providerActive')}</Badge>
                                      )}
                                      {!isActive && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            setDraft((prev) => ({
                                              ...prev,
                                              models: {
                                                ...prev.models,
                                                activeProvider: providerKey
                                              }
                                            }))
                                          }
                                        >
                                          {t('providerSetActive')}
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="mt-2 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                      <span
                                        className={cn(
                                          'inline-flex size-2 rounded-full',
                                          pingState?.status === 'ok'
                                            ? 'bg-emerald-500'
                                            : pingState?.status === 'error'
                                              ? 'bg-destructive'
                                              : pingState?.status === 'checking'
                                                ? 'bg-amber-500'
                                                : 'bg-muted-foreground/50'
                                        )}
                                      />
                                      <span>
                                        {pingState?.status === 'ok'
                                          ? t('providerStatusOk')
                                          : pingState?.status === 'error'
                                            ? t('providerStatusError')
                                            : pingState?.status === 'checking'
                                              ? t('providerStatusChecking')
                                              : `${t('summaryApiKey')}: ${
                                                  hasApiKey
                                                    ? t('summaryApiKeyConfigured')
                                                    : t('summaryApiKeyMissing')
                                                }`}
                                      </span>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={pingState?.status === 'checking'}
                                      onClick={() => void pingProvider(providerKey)}
                                    >
                                      {pingState?.status === 'checking'
                                        ? t('providerPinging')
                                        : t('providerPing')}
                                    </Button>
                                  </div>
                                  {pingState && pingState.status !== 'idle' && (
                                    <p className="mt-1 text-[11px] text-muted-foreground">
                                      {pingState.message}
                                    </p>
                                  )}
                                </div>
                              )
                            })}
                          </CardContent>
                        </Card>

                        <Card className="h-full overflow-auto">
                          <CardHeader className={cn(unifiedHeaderClass, 'gap-2')}>
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <CardTitle className="text-base">
                                  {focusedProviderConfig.label}
                                </CardTitle>
                                <CardDescription>
                                  {focusedProviderConfig.providerId}
                                </CardDescription>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {focusedPingState?.status && focusedPingState.status !== 'idle' && (
                                  <Badge
                                    variant="secondary"
                                    className={cn(
                                      focusedPingState.status === 'ok'
                                        ? 'bg-emerald-500/15 text-emerald-700'
                                        : focusedPingState.status === 'error'
                                          ? 'bg-destructive/12 text-destructive'
                                          : 'bg-amber-500/12 text-amber-700'
                                    )}
                                  >
                                    {focusedPingState.status === 'ok'
                                      ? t('providerStatusOk')
                                      : focusedPingState.status === 'error'
                                        ? t('providerStatusError')
                                        : t('providerStatusChecking')}
                                  </Badge>
                                )}
                                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                                  <Checkbox
                                    checked={showApiKey}
                                    onCheckedChange={(checked) => setShowApiKey(checked === true)}
                                  />
                                  {t('showApiKey')}
                                </label>
                              </div>
                            </div>
                          </CardHeader>

                          <CardContent className="space-y-3 pt-3">
                            <div className="grid gap-2 md:grid-cols-2">
                              <label className="block space-y-1">
                                <span className="text-xs text-muted-foreground">
                                  {t('fieldApiKey')}
                                </span>
                                <Input
                                  type={showApiKey ? 'text' : 'password'}
                                  value={focusedProviderSettings.apiKey}
                                  onChange={(event) =>
                                    updateProviderField(
                                      focusedProvider,
                                      'apiKey',
                                      event.target.value
                                    )
                                  }
                                  placeholder={t('fieldApiKeyPlaceholder')}
                                />
                              </label>

                              <label className="block space-y-1">
                                <span className="text-xs text-muted-foreground">
                                  {t('fieldBaseUrl')}
                                </span>
                                <Input
                                  value={focusedProviderSettings.baseUrl}
                                  onChange={(event) =>
                                    updateProviderField(
                                      focusedProvider,
                                      'baseUrl',
                                      event.target.value
                                    )
                                  }
                                  placeholder={t('fieldBaseUrlPlaceholder')}
                                />
                              </label>

                              <label className="block space-y-1">
                                <span className="text-xs text-muted-foreground">
                                  {t('fieldRuntimeApi')}
                                </span>
                                <Select
                                  value={focusedProviderSettings.runtimeApi}
                                  onValueChange={(value) =>
                                    updateProviderField(
                                      focusedProvider,
                                      'runtimeApi',
                                      value as ModelRuntimeApi
                                    )
                                  }
                                  disabled={focusedProvider !== 'custom'}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder={t('fieldRuntimeApiPlaceholder')} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {MODEL_RUNTIME_APIS.map((runtimeApi) => (
                                      <SelectItem key={runtimeApi} value={runtimeApi}>
                                        {t(RUNTIME_API_LABELS[runtimeApi])}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </label>

                              <label className="block space-y-1">
                                <span className="text-xs text-muted-foreground">
                                  {t('fieldPrimaryModel')}
                                </span>
                                {focusedProviderConfig.modelOptions.length > 0 ? (
                                  <Select
                                    value={focusedProviderSettings.modelPrimary}
                                    onValueChange={(value) =>
                                      updateProviderField(
                                        focusedProvider,
                                        'modelPrimary',
                                        value ?? ''
                                      )
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder={t('fieldPrimaryModel')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {focusedProviderConfig.modelOptions.map((model) => (
                                        <SelectItem key={model} value={model}>
                                          {model}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Input
                                    value={focusedProviderSettings.modelPrimary}
                                    onChange={(event) =>
                                      updateProviderField(
                                        focusedProvider,
                                        'modelPrimary',
                                        event.target.value
                                      )
                                    }
                                  />
                                )}
                              </label>

                              <label className="block space-y-1">
                                <span className="text-xs text-muted-foreground">
                                  {t('fieldFastModel')}
                                </span>
                                <Input
                                  value={focusedProviderSettings.modelFast}
                                  onChange={(event) =>
                                    updateProviderField(
                                      focusedProvider,
                                      'modelFast',
                                      event.target.value
                                    )
                                  }
                                  placeholder={t('fieldFastModelPlaceholder')}
                                />
                              </label>
                            </div>

                            <label className="block space-y-1">
                              <span className="text-xs text-muted-foreground">
                                {t('fieldCatalog')}
                              </span>
                              <Textarea
                                value={focusedProviderSettings.modelCatalog.join('\n')}
                                onChange={(event) =>
                                  updateProviderModelCatalog(focusedProvider, event.target.value)
                                }
                                placeholder="gpt-4.1&#10;gpt-4.1-mini&#10;gpt-4o-mini"
                                className="min-h-[120px]"
                              />
                            </label>

                            {focusedProviderConfig.modelOptions.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">
                                  {t('recommendedModels')}
                                </span>
                                {focusedProviderConfig.modelOptions.map((model) => (
                                  <Button
                                    key={model}
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => appendCatalogModel(focusedProvider, model)}
                                    className="h-6 px-2 text-[11px]"
                                  >
                                    + {model}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 border-t border-border/70 pt-2">
                        <Button
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() => void saveModelSettings()}
                          disabled={saving || !isModelsDirty}
                        >
                          <Save className="mr-1 size-4" />
                          {saving ? t('actionSaving') : t('actionSave')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => void reloadSettings()}
                        >
                          <RefreshCw className="mr-1 size-4" />
                          {t('actionReload')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => void resetSettings()}
                          disabled={saving}
                        >
                          {t('actionReset')}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
