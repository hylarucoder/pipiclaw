import { useMemo, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { NavigationRail } from '@renderer/components/NavigationRail'
import { PiWebChatPanel } from '@renderer/components/PiWebChatPanel'
import { Button } from '@renderer/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@renderer/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import {
  listConfiguredPiModelOptions,
  type ConfiguredPiModelOption,
  type PiModelTarget
} from '@pipiclaw/agent-core'
import type { AppSettings } from '@pipiclaw/shared/rpc/settings'
import { cn } from '@renderer/lib/utils'

const unifiedHeaderClass = 'border-b border-border/70 bg-card/70 text-foreground'

export interface ChatPageProps {
  settings: AppSettings
}

function getModelOptionLabel(t: TFunction<'chat'>, option: ConfiguredPiModelOption): string {
  const slotLabel =
    option.slot === 'primary'
      ? t('slotPrimary')
      : option.slot === 'fast'
        ? t('slotFast')
        : t('slotCatalog')
  return `${option.providerLabel} · ${slotLabel} · ${option.modelId}`
}

export function ChatPage({ settings }: ChatPageProps): React.JSX.Element {
  const { t } = useTranslation('chat')
  const modelOptions = useMemo(() => listConfiguredPiModelOptions(settings), [settings])
  const hasModelWithKey = useMemo(
    () => modelOptions.some((option) => option.hasApiKey),
    [modelOptions]
  )

  const defaultSelectedOptionId = useMemo(() => {
    const activeWithKey = modelOptions.find((item) => item.isActivePrimary && item.hasApiKey)
    if (activeWithKey) return activeWithKey.id
    const firstWithKey = modelOptions.find((item) => item.hasApiKey)
    if (firstWithKey) return firstWithKey.id
    return modelOptions[0]?.id ?? ''
  }, [modelOptions])

  const [selectedOptionIdDraft, setSelectedOptionIdDraft] = useState(defaultSelectedOptionId)
  const selectedOptionId = useMemo(() => {
    if (selectedOptionIdDraft) {
      const selectedDraft = modelOptions.find((item) => item.id === selectedOptionIdDraft)
      if (selectedDraft?.hasApiKey) {
        return selectedOptionIdDraft
      }
    }
    return defaultSelectedOptionId
  }, [defaultSelectedOptionId, modelOptions, selectedOptionIdDraft])

  const selectedOption = useMemo(
    () => modelOptions.find((item) => item.id === selectedOptionId) ?? null,
    [modelOptions, selectedOptionId]
  )

  const selectedModelTarget = useMemo<PiModelTarget | undefined>(() => {
    if (!selectedOption) return undefined
    return {
      providerKey: selectedOption.providerKey,
      modelId: selectedOption.modelId
    }
  }, [selectedOption])

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="[-webkit-app-region:drag] h-8 shrink-0 border-b border-border/70 bg-card/70 px-2.5">
        <div className="flex h-full items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium tracking-wide text-foreground">{t('brand')}</span>
          <span>{t('subtitle')}</span>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-x-auto p-2">
        <div className="grid h-full min-w-[960px] w-full gap-2 grid-cols-[44px_minmax(0,1fr)]">
          <NavigationRail />

          <Card className="flex h-full min-h-0 flex-col overflow-hidden">
            <CardHeader className={cn(unifiedHeaderClass, 'gap-2')}>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="size-4 text-primary" />
                {t('title')}
              </CardTitle>
              <CardDescription>{t('description')}</CardDescription>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span>{t('sessionModel')}</span>
                <Select
                  value={selectedOptionId}
                  onValueChange={(value) => setSelectedOptionIdDraft(value ?? '')}
                >
                  <SelectTrigger className="min-w-[360px]">
                    <SelectValue placeholder={t('sessionModel')} />
                  </SelectTrigger>
                  <SelectContent>
                    {modelOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id} disabled={!option.hasApiKey}>
                        {getModelOptionLabel(t, option)}
                        {option.hasApiKey ? '' : t('modelNoKeySuffix')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedOption && (
                  <span>
                    {t('currentModel', {
                      providerId: selectedOption.providerId,
                      modelId: selectedOption.modelId
                    })}
                  </span>
                )}
              </div>
              {hasModelWithKey && (
                <p className="text-[11px] text-muted-foreground">{t('firstMessageHint')}</p>
              )}
            </CardHeader>
            <CardContent className="min-h-0 flex-1 p-0">
              {hasModelWithKey ? (
                <PiWebChatPanel settings={settings} modelTarget={selectedModelTarget} />
              ) : (
                <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 px-4 text-center">
                  <p className="text-sm font-medium text-foreground">{t('missingKeyTitle')}</p>
                  <p className="max-w-md text-xs text-muted-foreground">
                    {t('missingKeyDescription')}
                  </p>
                  <Button size="sm" nativeButton={false} render={<Link to="/settings" />}>
                    {t('goToSettings')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
