import { getModel } from '@mariozechner/pi-ai/dist/models.js'
import type { Api, Model } from '@mariozechner/pi-ai/dist/types.js'
import { getProviderConfig } from '@pipiclaw/shared/config/modelProviders'
import type { AppSettings, ModelProviderKey } from '@pipiclaw/shared/rpc/settings'

export type PiModelRuntime = {
  model: Model<Api>
  apiKey: string
  source: 'catalog' | 'configured'
}

export type PiModelSlot = 'primary' | 'fast'

export type PiModelTarget = {
  providerKey: ModelProviderKey
  slot?: PiModelSlot
  modelId?: string
}

export type ConfiguredPiModelOption = {
  id: string
  providerKey: ModelProviderKey
  providerId: string
  providerLabel: string
  slot: PiModelSlot | 'catalog'
  modelId: string
  hasApiKey: boolean
  isActivePrimary: boolean
}

function normalizeModelId(providerKey: ModelProviderKey, modelId: string): string {
  const provider = getProviderConfig(providerKey)
  const trimmed = modelId.trim()
  if (!provider.lowercaseModel) return trimmed
  return trimmed.toLowerCase()
}

function resolveModelId(
  settings: AppSettings,
  providerKey: ModelProviderKey,
  slot: PiModelSlot
): string {
  const providerConfig = getProviderConfig(providerKey)
  const providerSettings = settings.models.providers[providerKey]
  const sourceModel =
    slot === 'fast'
      ? providerSettings.modelFast.trim() || providerSettings.modelPrimary.trim()
      : providerSettings.modelPrimary.trim()
  return normalizeModelId(providerKey, sourceModel || providerConfig.defaultModelPrimary)
}

function buildConfiguredPiModel(settings: AppSettings, target: PiModelTarget): Model<Api> {
  const providerKey = target.providerKey
  const providerConfig = getProviderConfig(providerKey)
  const modelId = normalizeModelId(
    providerKey,
    target.modelId?.trim() || resolveModelId(settings, providerKey, target.slot ?? 'primary')
  )
  const providerSettings = settings.models.providers[providerKey]
  const baseUrl = providerSettings.baseUrl.trim() || providerConfig.defaultBaseUrl
  const runtimeApi = providerKey === 'custom' ? providerSettings.runtimeApi : providerConfig.runtimeApi

  return {
    id: modelId,
    name: `${providerConfig.providerId}/${modelId}`,
    api: runtimeApi,
    provider: providerConfig.providerId,
    baseUrl,
    reasoning: providerConfig.reasoning,
    input: [...providerConfig.supportedInputs],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: providerConfig.contextWindow,
    maxTokens: providerConfig.maxTokens
  }
}

function tryResolveCatalogModel(settings: AppSettings, target: PiModelTarget): Model<Api> | null {
  const providerKey = target.providerKey
  if (providerKey !== 'openai' && providerKey !== 'anthropic') return null

  const modelId = normalizeModelId(
    providerKey,
    target.modelId?.trim() || resolveModelId(settings, providerKey, target.slot ?? 'primary')
  )
  const providerConfig = getProviderConfig(providerKey)
  const providerSettings = settings.models.providers[providerKey]
  const baseUrl = providerSettings.baseUrl.trim() || providerConfig.defaultBaseUrl

  try {
    const model = getModel(providerKey, modelId as never) as Model<Api>
    if (!baseUrl) return model
    return {
      ...model,
      baseUrl
    }
  } catch {
    return null
  }
}

export function resolvePiModelRuntime(
  settings: AppSettings,
  target?: PiModelTarget
): {
  runtime: PiModelRuntime | null
  error: string | null
} {
  const resolvedTarget: PiModelTarget = target ?? {
    providerKey: settings.models.activeProvider,
    slot: 'primary'
  }

  const providerKey = resolvedTarget.providerKey
  const providerConfig = getProviderConfig(providerKey)
  const providerSettings = settings.models.providers[providerKey]
  const apiKey = providerSettings.apiKey.trim()
  const modelId = normalizeModelId(
    providerKey,
    resolvedTarget.modelId?.trim() ||
      resolveModelId(settings, providerKey, resolvedTarget.slot ?? 'primary')
  )

  if (!apiKey) {
    return {
      runtime: null,
      error: `当前 Provider ${providerConfig.label} 缺少 API Key。`
    }
  }

  if (!modelId) {
    return {
      runtime: null,
      error: `当前 Provider ${providerConfig.label} 缺少模型配置。`
    }
  }

  const catalogModel = tryResolveCatalogModel(settings, resolvedTarget)
  if (catalogModel) {
    return {
      runtime: {
        model: catalogModel,
        apiKey,
        source: 'catalog'
      },
      error: null
    }
  }

  return {
    runtime: {
      model: buildConfiguredPiModel(settings, resolvedTarget),
      apiKey,
      source: 'configured'
    },
    error: null
  }
}

export function resolveActivePiModelRuntime(settings: AppSettings): {
  runtime: PiModelRuntime | null
  error: string | null
} {
  return resolvePiModelRuntime(settings, {
    providerKey: settings.models.activeProvider,
    slot: 'primary'
  })
}

export function listConfiguredPiModelOptions(settings: AppSettings): ConfiguredPiModelOption[] {
  const options: ConfiguredPiModelOption[] = []
  const seen = new Set<string>()

  const pushOption = (
    providerKey: ModelProviderKey,
    slot: PiModelSlot | 'catalog',
    modelIdSource?: string
  ): void => {
    const providerConfig = getProviderConfig(providerKey)
    const providerSettings = settings.models.providers[providerKey]
    const modelId =
      slot === 'catalog'
        ? normalizeModelId(providerKey, modelIdSource ?? '')
        : resolveModelId(settings, providerKey, slot)
    if (!modelId) return
    const dedupeKey = `${providerKey}:${modelId}`
    if (seen.has(dedupeKey)) return
    seen.add(dedupeKey)

    options.push({
      id: `${providerKey}:${slot}:${modelId}`,
      providerKey,
      providerId: providerConfig.providerId,
      providerLabel: providerConfig.label,
      slot,
      modelId,
      hasApiKey: providerSettings.apiKey.trim().length > 0,
      isActivePrimary: providerKey === settings.models.activeProvider && slot === 'primary'
    })
  }

  const providerKeys = Object.keys(settings.models.providers) as ModelProviderKey[]
  for (const providerKey of providerKeys) {
    pushOption(providerKey, 'primary')

    const fastModel = resolveModelId(settings, providerKey, 'fast')
    const primaryModel = resolveModelId(settings, providerKey, 'primary')
    if (fastModel && fastModel !== primaryModel) {
      pushOption(providerKey, 'fast')
    }

    const customModels = settings.models.providers[providerKey].modelCatalog
    for (const modelId of customModels) {
      pushOption(providerKey, 'catalog', modelId)
    }
  }

  options.sort((left, right) => {
    if (left.isActivePrimary && !right.isActivePrimary) return -1
    if (!left.isActivePrimary && right.isActivePrimary) return 1
    if (left.hasApiKey !== right.hasApiKey) return left.hasApiKey ? -1 : 1
    if (left.providerLabel !== right.providerLabel) {
      return left.providerLabel.localeCompare(right.providerLabel, 'zh-CN')
    }
    const slotOrder: Record<ConfiguredPiModelOption['slot'], number> = {
      primary: 0,
      fast: 1,
      catalog: 2
    }
    if (left.slot !== right.slot) return slotOrder[left.slot] - slotOrder[right.slot]
    return left.modelId.localeCompare(right.modelId, 'zh-CN')
  })

  return options
}
