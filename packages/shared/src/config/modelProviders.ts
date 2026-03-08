export const MODEL_PROVIDER_KEYS = [
  'anthropic',
  'openai',
  'kimi',
  'glm',
  'minimax',
  'custom'
] as const

export type ModelProviderKey = (typeof MODEL_PROVIDER_KEYS)[number]
export const MODEL_RUNTIME_APIS = [
  'openai-completions',
  'openai-responses',
  'anthropic-messages'
] as const

export type ModelRuntimeApi = (typeof MODEL_RUNTIME_APIS)[number]

export type ModelProviderConfig = {
  label: string
  providerId: string
  defaultBaseUrl: string
  defaultModelPrimary: string
  defaultModelFast: string
  modelOptions: readonly string[]
  lowercaseModel: boolean
  runtimeApi: ModelRuntimeApi
  reasoning: boolean
  supportedInputs: readonly ('text' | 'image')[]
  contextWindow: number
  maxTokens: number
}

export const MODEL_PROVIDER_CONFIGS: Record<ModelProviderKey, ModelProviderConfig> = {
  anthropic: {
    label: 'Anthropic',
    providerId: 'anthropic',
    defaultBaseUrl: '',
    defaultModelPrimary: 'claude-sonnet-4-20250514',
    defaultModelFast: 'claude-3-5-haiku-latest',
    modelOptions: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
    lowercaseModel: false,
    runtimeApi: 'anthropic-messages',
    reasoning: true,
    supportedInputs: ['text', 'image'],
    contextWindow: 200000,
    maxTokens: 8192
  },
  openai: {
    label: 'OpenAI',
    providerId: 'openai',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModelPrimary: 'gpt-4.1',
    defaultModelFast: 'gpt-4.1-mini',
    modelOptions: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o-mini'],
    lowercaseModel: false,
    runtimeApi: 'openai-responses',
    reasoning: true,
    supportedInputs: ['text', 'image'],
    contextWindow: 128000,
    maxTokens: 16384
  },
  kimi: {
    label: 'Kimi',
    providerId: 'moonshotai',
    defaultBaseUrl: 'https://api.moonshot.cn/anthropic',
    defaultModelPrimary: 'kimi-k2-preview',
    defaultModelFast: 'kimi-k2-turbo-preview',
    modelOptions: ['kimi-k2-preview', 'kimi-k2-turbo-preview', 'kimi-k2-thinking'],
    lowercaseModel: false,
    runtimeApi: 'anthropic-messages',
    reasoning: true,
    supportedInputs: ['text', 'image'],
    contextWindow: 128000,
    maxTokens: 8192
  },
  glm: {
    label: 'GLM',
    providerId: 'zhipuai',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/anthropic',
    defaultModelPrimary: 'GLM-4.7',
    defaultModelFast: 'GLM-4.6',
    modelOptions: ['GLM-4.7', 'GLM-4.6'],
    lowercaseModel: true,
    runtimeApi: 'anthropic-messages',
    reasoning: true,
    supportedInputs: ['text', 'image'],
    contextWindow: 128000,
    maxTokens: 8192
  },
  minimax: {
    label: 'MiniMax',
    providerId: 'minimax',
    defaultBaseUrl: 'https://api.minimaxi.com/anthropic',
    defaultModelPrimary: 'MiniMax-M2',
    defaultModelFast: 'MiniMax-M2',
    modelOptions: ['MiniMax-M2'],
    lowercaseModel: true,
    runtimeApi: 'anthropic-messages',
    reasoning: true,
    supportedInputs: ['text', 'image'],
    contextWindow: 128000,
    maxTokens: 8192
  },
  custom: {
    label: 'Custom',
    providerId: 'custom',
    defaultBaseUrl: '',
    defaultModelPrimary: 'custom-model',
    defaultModelFast: '',
    modelOptions: [],
    lowercaseModel: false,
    runtimeApi: 'openai-completions',
    reasoning: false,
    supportedInputs: ['text'],
    contextWindow: 128000,
    maxTokens: 8192
  }
}

export function getProviderConfig(providerKey: ModelProviderKey): ModelProviderConfig {
  return MODEL_PROVIDER_CONFIGS[providerKey]
}
