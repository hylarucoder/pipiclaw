import { describe, expect, it } from 'vitest'
import { createDefaultAppSettings } from '@pipiclaw/shared/rpc/settings'
import {
  resolveActiveModelConfig,
  resolveActiveModelSummary,
  resolveActivePiModelRuntime
} from '../modelResolver'

describe('modelResolver', () => {
  it('returns error when active provider key is missing', () => {
    const settings = createDefaultAppSettings('/tmp/notes')
    settings.models.activeProvider = 'anthropic'
    settings.models.providers.anthropic.apiKey = ''

    const resolved = resolveActiveModelConfig(settings)
    expect(resolved.config).toBeNull()
    expect(resolved.error).toContain('API Key')
  })

  it('normalizes lowercase model ids when provider requires lowercase', () => {
    const settings = createDefaultAppSettings('/tmp/notes')
    settings.models.activeProvider = 'glm'
    settings.models.providers.glm.apiKey = 'glm-token'
    settings.models.providers.glm.modelPrimary = 'GLM-4.7'

    const resolved = resolveActiveModelConfig(settings)
    expect(resolved.error).toBeNull()
    expect(resolved.config?.providerId).toBe('zhipuai')
    expect(resolved.config?.modelId).toBe('glm-4.7')
  })

  it('returns summary with hasApiKey and error state', () => {
    const settings = createDefaultAppSettings('/tmp/notes')
    settings.models.activeProvider = 'openai'
    settings.models.providers.openai.apiKey = ''

    const summary = resolveActiveModelSummary(settings)
    expect(summary.providerId).toBe('openai')
    expect(summary.hasApiKey).toBe(false)
    expect(summary.error).toContain('API Key')
  })

  it('uses pi-ai catalog models for openai/anthropic', () => {
    const settings = createDefaultAppSettings('/tmp/notes')
    settings.models.activeProvider = 'openai'
    settings.models.providers.openai.apiKey = 'openai-token'
    settings.models.providers.openai.modelPrimary = 'gpt-4.1'

    const resolved = resolveActivePiModelRuntime(settings)
    expect(resolved.error).toBeNull()
    expect(resolved.runtime?.source).toBe('catalog')
    expect(resolved.runtime?.model.provider).toBe('openai')
    expect(resolved.runtime?.model.api).toBe('openai-responses')
    expect(resolved.runtime?.options.apiKey).toBe('openai-token')
  })

  it('uses configured runtime descriptor for non-catalog providers', () => {
    const settings = createDefaultAppSettings('/tmp/notes')
    settings.models.activeProvider = 'kimi'
    settings.models.providers.kimi.apiKey = 'kimi-token'
    settings.models.providers.kimi.modelPrimary = 'kimi-k2-preview'

    const resolved = resolveActivePiModelRuntime(settings)
    expect(resolved.error).toBeNull()
    expect(resolved.runtime?.source).toBe('configured')
    expect(resolved.runtime?.model.provider).toBe('moonshotai')
    expect(resolved.runtime?.model.api).toBe('anthropic-messages')
    expect(resolved.runtime?.model.baseUrl).toBe('https://api.moonshot.cn/anthropic')
  })

  it('uses explicit runtime api for custom provider', () => {
    const settings = createDefaultAppSettings('/tmp/notes')
    settings.models.activeProvider = 'custom'
    settings.models.providers.custom.apiKey = 'custom-token'
    settings.models.providers.custom.baseUrl = 'http://localhost:11434/v1'
    settings.models.providers.custom.modelPrimary = 'llama3.1:8b'
    settings.models.providers.custom.runtimeApi = 'openai-completions'

    const resolved = resolveActivePiModelRuntime(settings)
    expect(resolved.error).toBeNull()
    expect(resolved.runtime?.source).toBe('configured')
    expect(resolved.runtime?.model.api).toBe('openai-completions')
  })
})
