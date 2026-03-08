import { describe, expect, it } from 'vitest'
import { createDefaultAppSettings, mergeAppSettings } from './settings'

describe('settings schema helpers', () => {
  it('creates defaults with provided notes root', () => {
    const settings = createDefaultAppSettings('/tmp/notes')
    expect(settings.workspace.notesRootDir).toBe('/tmp/notes')
    expect(settings.workspace.language).toBe('zh-CN')
    expect(settings.models.activeProvider).toBe('anthropic')
    expect(settings.models.providers.kimi.modelPrimary).toBeTruthy()
    expect(settings.models.providers.kimi.modelCatalog.length).toBeGreaterThan(0)
    expect(settings.models.providers.custom.runtimeApi).toBe('openai-completions')
    expect(settings.imagen.modelId).toBe('gemini-3-pro-image-preview')
    expect(settings.imagen.baseUrl).toBe('https://generativelanguage.googleapis.com')
  })

  it('merges nested updates without dropping existing providers', () => {
    const defaults = createDefaultAppSettings('/tmp/notes')
    const merged = mergeAppSettings(defaults, {
      workspace: { defaultRoute: '/files' },
      models: {
        activeProvider: 'glm',
        providers: {
          glm: {
            apiKey: 'glm-token',
            modelPrimary: 'GLM-4.6',
            modelCatalog: ['GLM-4.6', 'GLM-4.7']
          }
        }
      }
    })

    expect(merged.workspace.defaultRoute).toBe('/files')
    expect(merged.workspace.language).toBe('zh-CN')
    expect(merged.models.activeProvider).toBe('glm')
    expect(merged.models.providers.glm.apiKey).toBe('glm-token')
    expect(merged.models.providers.glm.modelPrimary).toBe('GLM-4.6')
    expect(merged.models.providers.glm.modelCatalog).toEqual(['GLM-4.6', 'GLM-4.7'])
    expect(merged.models.providers.glm.runtimeApi).toBe('anthropic-messages')
    expect(merged.models.providers.kimi.modelPrimary).toBe(
      defaults.models.providers.kimi.modelPrimary
    )
    expect(merged.imagen.modelId).toBe(defaults.imagen.modelId)
  })

  it('merges imagen settings', () => {
    const defaults = createDefaultAppSettings('/tmp/notes')
    const merged = mergeAppSettings(defaults, {
      imagen: {
        bearerToken: 'test-bearer',
        baseUrl: 'https://api.example.com/v1beta',
        modelId: 'gemini-2.5-flash-image'
      }
    })

    expect(merged.imagen.bearerToken).toBe('test-bearer')
    expect(merged.imagen.baseUrl).toBe('https://api.example.com/v1beta')
    expect(merged.imagen.modelId).toBe('gemini-2.5-flash-image')
  })
})
