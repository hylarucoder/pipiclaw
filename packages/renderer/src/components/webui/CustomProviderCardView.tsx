import type { CustomProvider } from '@renderer/features/webui/storage/stores/custom-providers-store.js'
import { Button } from '@renderer/components/ui/button'
import { i18n } from '@renderer/features/webui/utils/i18n.js'

type ProviderStatus = {
  modelCount: number
  status: 'connected' | 'disconnected' | 'checking'
}

export interface CustomProviderCardProps {
  provider: CustomProvider
  isAutoDiscovery?: boolean
  status?: ProviderStatus
  onRefresh?: (provider: CustomProvider) => void
  onEdit?: (provider: CustomProvider) => void
  onDelete?: (provider: CustomProvider) => void
}

export function CustomProviderCardView({
  provider,
  isAutoDiscovery = false,
  status,
  onRefresh,
  onEdit,
  onDelete
}: CustomProviderCardProps): React.JSX.Element {
  const renderStatus = (): React.JSX.Element => {
    if (!isAutoDiscovery) {
      return (
        <div className="mt-1 text-xs text-muted-foreground">
          {i18n('Models')}: {provider.models?.length || 0}
        </div>
      )
    }

    if (!status) {
      return <></>
    }

    const statusClass =
      status.status === 'connected'
        ? 'text-green-500'
        : status.status === 'checking'
          ? 'text-yellow-500'
          : 'text-red-500'

    const statusText =
      status.status === 'connected'
        ? `${status.modelCount} ${i18n('models')}`
        : status.status === 'checking'
          ? i18n('Checking...')
          : i18n('Disconnected')

    return (
      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <span className={statusClass}>●</span>
        {statusText}
      </div>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{provider.name}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">
            <span className="capitalize">{provider.type}</span>
            {provider.baseUrl ? ` • ${provider.baseUrl}` : ''}
          </div>
          {renderStatus()}
        </div>

        <div className="flex shrink-0 gap-2">
          {isAutoDiscovery && onRefresh ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onRefresh(provider)
              }}
            >
              {i18n('Refresh')}
            </Button>
          ) : null}

          {onEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onEdit(provider)
              }}
            >
              {i18n('Edit')}
            </Button>
          ) : null}

          {onDelete ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onDelete(provider)
              }}
            >
              {i18n('Delete')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
