import { z } from 'zod'
import { MODEL_PROVIDER_CONFIGS, MODEL_PROVIDER_KEYS, MODEL_RUNTIME_APIS } from '../config/modelProviders'

export const SETTINGS_GET_CHANNEL = 'settings:get'
export const SETTINGS_UPDATE_CHANNEL = 'settings:update'
export const SETTINGS_RESET_CHANNEL = 'settings:reset'
export const SETTINGS_RESOLVE_ACTIVE_MODEL_CHANNEL = 'settings:resolve-active-model'

export const DEFAULT_NOTES_ROOT_DIR = '/Users/lucasay/Workspace/PKM/Notes'
export const DEFAULT_PREVIEW_MAX_CHARS = 20000
export const DEFAULT_PREVIEW_MAX_ASSET_BYTES = 25 * 1024 * 1024
export const DEFAULT_IMAGEN_BASE_URL = 'https://generativelanguage.googleapis.com'
export const DEFAULT_IMAGEN_MODEL_ID = 'gemini-3-pro-image-preview'

const defaultRouteValues = ['/notes', '/files', '/journal', '/kanban', '/draw', '/chat'] as const
export const defaultRouteSchema = z.enum(defaultRouteValues)
export const modelProviderKeySchema = z.enum(MODEL_PROVIDER_KEYS)
const appLanguageValues = ['zh-CN', 'en-US'] as const
export const appLanguageSchema = z.enum(appLanguageValues)

const modelCatalogSchema = z.array(z.string().min(1)).max(100)
export const modelRuntimeApiSchema = z.enum(MODEL_RUNTIME_APIS)

export const modelProviderSettingsSchema = z.object({
  apiKey: z.string(),
  baseUrl: z.string(),
  modelPrimary: z.string().min(1),
  modelFast: z.string(),
  modelCatalog: modelCatalogSchema,
  runtimeApi: modelRuntimeApiSchema
})

export const appSettingsSchema = z.object({
  workspace: z.object({
    notesRootDir: z.string().min(1),
    defaultRoute: defaultRouteSchema,
    language: appLanguageSchema
  }),
  preview: z.object({
    maxChars: z.number().int().min(200).max(200000),
    maxAssetBytes: z
      .number()
      .int()
      .min(1024)
      .max(100 * 1024 * 1024)
  }),
  models: z.object({
    activeProvider: modelProviderKeySchema,
    providers: z.object({
      anthropic: modelProviderSettingsSchema,
      openai: modelProviderSettingsSchema,
      kimi: modelProviderSettingsSchema,
      glm: modelProviderSettingsSchema,
      minimax: modelProviderSettingsSchema,
      custom: modelProviderSettingsSchema
    })
  }),
  imagen: z.object({
    bearerToken: z.string(),
    baseUrl: z.string().min(1),
    modelId: z.string().min(1)
  })
})

const modelProviderSettingsUpdateSchema = modelProviderSettingsSchema.partial()

export const appSettingsUpdateInputSchema = z.object({
  workspace: appSettingsSchema.shape.workspace.partial().optional(),
  preview: appSettingsSchema.shape.preview.partial().optional(),
  models: z
    .object({
      activeProvider: modelProviderKeySchema.optional(),
      providers: z
        .object({
          anthropic: modelProviderSettingsUpdateSchema.optional(),
          openai: modelProviderSettingsUpdateSchema.optional(),
          kimi: modelProviderSettingsUpdateSchema.optional(),
          glm: modelProviderSettingsUpdateSchema.optional(),
          minimax: modelProviderSettingsUpdateSchema.optional(),
          custom: modelProviderSettingsUpdateSchema.optional()
        })
        .optional()
    })
    .optional(),
  imagen: appSettingsSchema.shape.imagen.partial().optional()
})

export const appSettingsResultSchema = z.object({
  settings: appSettingsSchema,
  error: z.string().optional()
})

export const appSettingsResolveActiveModelResultSchema = z.object({
  providerKey: modelProviderKeySchema,
  providerId: z.string(),
  modelId: z.string(),
  baseUrl: z.string(),
  hasApiKey: z.boolean(),
  error: z.string().optional()
})

function buildDefaultProviderSettings(
  providerKey: keyof typeof MODEL_PROVIDER_CONFIGS
): z.infer<typeof modelProviderSettingsSchema> {
  const config = MODEL_PROVIDER_CONFIGS[providerKey]
  const modelCatalog = [
    ...new Set(
      [config.defaultModelPrimary, config.defaultModelFast, ...config.modelOptions].filter(
        (item) => item.trim().length > 0
      )
    )
  ]

  return {
    apiKey: '',
    baseUrl: config.defaultBaseUrl,
    modelPrimary: config.defaultModelPrimary,
    modelFast: config.defaultModelFast,
    modelCatalog,
    runtimeApi: config.runtimeApi
  }
}

export function createDefaultAppSettings(notesRootDir = DEFAULT_NOTES_ROOT_DIR): AppSettings {
  return appSettingsSchema.parse({
    workspace: {
      notesRootDir,
      defaultRoute: '/notes',
      language: 'zh-CN'
    },
    preview: {
      maxChars: DEFAULT_PREVIEW_MAX_CHARS,
      maxAssetBytes: DEFAULT_PREVIEW_MAX_ASSET_BYTES
    },
    models: {
      activeProvider: 'anthropic',
      providers: {
        anthropic: buildDefaultProviderSettings('anthropic'),
        openai: buildDefaultProviderSettings('openai'),
        kimi: buildDefaultProviderSettings('kimi'),
        glm: buildDefaultProviderSettings('glm'),
        minimax: buildDefaultProviderSettings('minimax'),
        custom: buildDefaultProviderSettings('custom')
      }
    },
    imagen: {
      bearerToken: '',
      baseUrl: DEFAULT_IMAGEN_BASE_URL,
      modelId: DEFAULT_IMAGEN_MODEL_ID
    }
  })
}

export function mergeAppSettings(current: AppSettings, patch: AppSettingsUpdateInput): AppSettings {
  const next = {
    workspace: {
      ...current.workspace,
      ...patch.workspace
    },
    preview: {
      ...current.preview,
      ...patch.preview
    },
    models: {
      activeProvider: patch.models?.activeProvider ?? current.models.activeProvider,
      providers: {
        anthropic: {
          ...current.models.providers.anthropic,
          ...patch.models?.providers?.anthropic
        },
        openai: {
          ...current.models.providers.openai,
          ...patch.models?.providers?.openai
        },
        kimi: {
          ...current.models.providers.kimi,
          ...patch.models?.providers?.kimi
        },
        glm: {
          ...current.models.providers.glm,
          ...patch.models?.providers?.glm
        },
        minimax: {
          ...current.models.providers.minimax,
          ...patch.models?.providers?.minimax
        },
        custom: {
          ...current.models.providers.custom,
          ...patch.models?.providers?.custom
        }
      }
    },
    imagen: {
      ...current.imagen,
      ...patch.imagen
    }
  }

  return appSettingsSchema.parse(next)
}

export type DefaultRoute = z.infer<typeof defaultRouteSchema>
export type AppLanguage = z.infer<typeof appLanguageSchema>
export type ModelProviderKey = z.infer<typeof modelProviderKeySchema>
export type ModelProviderSettings = z.infer<typeof modelProviderSettingsSchema>
export type AppSettings = z.infer<typeof appSettingsSchema>
export type AppSettingsUpdateInput = z.infer<typeof appSettingsUpdateInputSchema>
export type AppSettingsResult = z.infer<typeof appSettingsResultSchema>
export type AppSettingsResolveActiveModelResult = z.infer<
  typeof appSettingsResolveActiveModelResultSchema
>
