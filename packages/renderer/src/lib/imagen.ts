import {
  IMAGEN_GENERATE_CHANNEL,
  imagenGenerateInputSchema,
  imagenGenerateResultSchema,
  type ImagenGenerateInput,
  type ImagenGenerateResult
} from '@pipiclaw/shared/rpc/imagen'

type RuntimeWindow = Window &
  Partial<{
    api: {
      imagen?: {
        generate?: (input: ImagenGenerateInput) => Promise<ImagenGenerateResult>
      }
    }
    electron: {
      ipcRenderer?: {
        invoke?: (channel: string, ...args: unknown[]) => Promise<unknown>
      }
    }
  }>

export async function invokeImagenGenerate(
  input: ImagenGenerateInput
): Promise<ImagenGenerateResult> {
  const runtimeWindow = window as RuntimeWindow

  if (runtimeWindow.api?.imagen?.generate) {
    return runtimeWindow.api.imagen.generate(input)
  }

  if (runtimeWindow.electron?.ipcRenderer?.invoke) {
    const parsedInput = imagenGenerateInputSchema.parse(input)
    const result = await runtimeWindow.electron.ipcRenderer.invoke(
      IMAGEN_GENERATE_CHANNEL,
      parsedInput
    )
    return imagenGenerateResultSchema.parse(result)
  }

  return {
    modelId: '',
    images: [],
    error: '预加载 Imagen API 未就绪，请重启应用后重试。'
  }
}
