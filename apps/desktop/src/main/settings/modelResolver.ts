import { getModel } from '@mariozechner/pi-ai/dist/models.js'
import type { Api, Model, StreamOptions } from '@mariozechner/pi-ai/dist/types.js'
import { getProviderConfig } from '@pipiclaw/shared/config/modelProviders'
import type {
  AppSettings,
  AppSettingsResolveActiveModelResult,
  ModelProviderKey
} from '@pipiclaw/shared/rpc/settings'

export type ResolvedModelConfig = {
  providerKey: ModelProviderKey
  providerId: string
  baseUrl: string
  modelId: string
  apiKey: string
  runtimeApi: AppSettings['models']['providers'][ModelProviderKey]['runtimeApi']
}

export type ResolvedPiModelRuntime = {
  model: Model<Api>
  options: StreamOptions
  source: 'catalog' | 'configured'
}

function normalizeModelId(providerKey: ModelProviderKey, modelId: string): string {
  const provider = getProviderConfig(providerKey)
  const trimmed = modelId.trim()
  if (!provider.lowercaseModel) return trimmed
  return trimmed.toLowerCase()
}

function buildConfiguredPiModel(config: ResolvedModelConfig): Model<Api> {
  const providerConfig = getProviderConfig(config.providerKey)

  return {
    id: config.modelId,
    name: `${config.providerId}/${config.modelId}`,
    api: config.runtimeApi,
    provider: config.providerId,
    baseUrl: config.baseUrl,
    reasoning: providerConfig.reasoning,
    input: [...providerConfig.supportedInputs],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: providerConfig.contextWindow,
    maxTokens: providerConfig.maxTokens
  }
}

function tryResolveCatalogModel(config: ResolvedModelConfig): Model<Api> | null {
  if (config.providerKey !== 'anthropic' && config.providerKey !== 'openai') return null

  try {
    const model = getModel(config.providerKey, config.modelId as never)
    if (!config.baseUrl) return model
    return { ...model, baseUrl: config.baseUrl }
  } catch {
    return null
  }
}

export function resolveActiveModelConfig(settings: AppSettings): {
  config: ResolvedModelConfig | null
  error: string | null
} {
  const providerKey = settings.models.activeProvider
  const providerConfig = getProviderConfig(providerKey)
  const providerSettings = settings.models.providers[providerKey]

  const modelSource = providerSettings.modelPrimary.trim() || providerConfig.defaultModelPrimary
  const modelId = normalizeModelId(providerKey, modelSource)
  const baseUrl = providerSettings.baseUrl.trim() || providerConfig.defaultBaseUrl
  const apiKey = providerSettings.apiKey.trim()

  if (!modelId) {
    return {
      config: null,
      error: `当前 Provider ${providerConfig.label} 缺少模型配置。`
    }
  }

  if (!apiKey) {
    return {
      config: null,
      error: `当前 Provider ${providerConfig.label} 缺少 API Key。`
    }
  }

  return {
    config: {
      providerKey,
      providerId: providerConfig.providerId,
      baseUrl,
      modelId,
      apiKey,
      runtimeApi: providerKey === 'custom' ? providerSettings.runtimeApi : providerConfig.runtimeApi
    },
    error: null
  }
}

export function resolveActivePiModelRuntime(settings: AppSettings): {
  runtime: ResolvedPiModelRuntime | null
  error: string | null
} {
  const resolved = resolveActiveModelConfig(settings)
  if (!resolved.config) {
    return {
      runtime: null,
      error: resolved.error
    }
  }

  const catalogModel = tryResolveCatalogModel(resolved.config)
  if (catalogModel) {
    return {
      runtime: {
        model: catalogModel,
        options: {
          apiKey: resolved.config.apiKey
        },
        source: 'catalog'
      },
      error: null
    }
  }

  return {
    runtime: {
      model: buildConfiguredPiModel(resolved.config),
      options: {
        apiKey: resolved.config.apiKey
      },
      source: 'configured'
    },
    error: null
  }
}

export function resolveActiveModelSummary(settings: AppSettings): AppSettingsResolveActiveModelResult {
  const providerKey = settings.models.activeProvider
  const providerConfig = getProviderConfig(providerKey)
  const providerSettings = settings.models.providers[providerKey]
  const modelSource = providerSettings.modelPrimary.trim() || providerConfig.defaultModelPrimary
  const modelId = normalizeModelId(providerKey, modelSource)
  const baseUrl = providerSettings.baseUrl.trim() || providerConfig.defaultBaseUrl
  const hasApiKey = providerSettings.apiKey.trim().length > 0

  const result: AppSettingsResolveActiveModelResult = {
    providerKey,
    providerId: providerConfig.providerId,
    modelId,
    baseUrl,
    hasApiKey
  }

  if (!modelId) {
    result.error = `当前 Provider ${providerConfig.label} 缺少模型配置。`
    return result
  }

  if (!hasApiKey) {
    result.error = `当前 Provider ${providerConfig.label} 缺少 API Key。`
  }

  return result
}
