import {
  SETTINGS_GET_CHANNEL,
  SETTINGS_RESET_CHANNEL,
  SETTINGS_RESOLVE_ACTIVE_MODEL_CHANNEL,
  SETTINGS_UPDATE_CHANNEL,
  appSettingsResolveActiveModelResultSchema,
  appSettingsResultSchema,
  appSettingsUpdateInputSchema,
  createDefaultAppSettings,
  type AppSettingsResolveActiveModelResult,
  type AppSettingsResult,
  type AppSettingsUpdateInput
} from '@pipiclaw/shared/rpc/settings'

type RuntimeWindow = Window &
  Partial<{
    api: {
      settings?: {
        get?: () => Promise<AppSettingsResult>
        update?: (input: AppSettingsUpdateInput) => Promise<AppSettingsResult>
        reset?: () => Promise<AppSettingsResult>
        resolveActiveModel?: () => Promise<AppSettingsResolveActiveModelResult>
      }
    }
    electron: {
      ipcRenderer?: {
        invoke?: (channel: string, ...args: unknown[]) => Promise<unknown>
      }
    }
  }>

function fallbackResult(error?: string): AppSettingsResult {
  return {
    settings: createDefaultAppSettings(),
    error
  }
}

export async function invokeSettingsGet(): Promise<AppSettingsResult> {
  const runtimeWindow = window as RuntimeWindow

  if (runtimeWindow.api?.settings?.get) {
    return runtimeWindow.api.settings.get()
  }

  if (runtimeWindow.electron?.ipcRenderer?.invoke) {
    const result = await runtimeWindow.electron.ipcRenderer.invoke(SETTINGS_GET_CHANNEL)
    return appSettingsResultSchema.parse(result)
  }

  return fallbackResult('预加载 Settings API 未就绪，请重启应用后重试。')
}

export async function invokeSettingsUpdate(input: AppSettingsUpdateInput): Promise<AppSettingsResult> {
  const runtimeWindow = window as RuntimeWindow

  if (runtimeWindow.api?.settings?.update) {
    return runtimeWindow.api.settings.update(input)
  }

  if (runtimeWindow.electron?.ipcRenderer?.invoke) {
    const parsedInput = appSettingsUpdateInputSchema.parse(input)
    const result = await runtimeWindow.electron.ipcRenderer.invoke(SETTINGS_UPDATE_CHANNEL, parsedInput)
    return appSettingsResultSchema.parse(result)
  }

  return fallbackResult('预加载 Settings API 未就绪，请重启应用后重试。')
}

export async function invokeSettingsReset(): Promise<AppSettingsResult> {
  const runtimeWindow = window as RuntimeWindow

  if (runtimeWindow.api?.settings?.reset) {
    return runtimeWindow.api.settings.reset()
  }

  if (runtimeWindow.electron?.ipcRenderer?.invoke) {
    const result = await runtimeWindow.electron.ipcRenderer.invoke(SETTINGS_RESET_CHANNEL)
    return appSettingsResultSchema.parse(result)
  }

  return fallbackResult('预加载 Settings API 未就绪，请重启应用后重试。')
}

export async function invokeResolveActiveModel(): Promise<AppSettingsResolveActiveModelResult> {
  const runtimeWindow = window as RuntimeWindow

  if (runtimeWindow.api?.settings?.resolveActiveModel) {
    return runtimeWindow.api.settings.resolveActiveModel()
  }

  if (runtimeWindow.electron?.ipcRenderer?.invoke) {
    const result = await runtimeWindow.electron.ipcRenderer.invoke(SETTINGS_RESOLVE_ACTIVE_MODEL_CHANNEL)
    return appSettingsResolveActiveModelResultSchema.parse(result)
  }

  return {
    providerKey: 'anthropic',
    providerId: 'anthropic',
    modelId: '',
    baseUrl: '',
    hasApiKey: false,
    error: '预加载 Settings API 未就绪，请重启应用后重试。'
  }
}
