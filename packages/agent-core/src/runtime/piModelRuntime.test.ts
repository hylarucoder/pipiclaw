import { describe, expect, it } from 'vitest'
import { createDefaultAppSettings } from '@pipiclaw/shared/rpc/settings'
import { listConfiguredPiModelOptions, resolvePiModelRuntime } from './piModelRuntime'

describe('piModelRuntime', () => {
  it('resolves runtime with explicit model id override', () => {
    const settings = createDefaultAppSettings('/tmp/notes')
    settings.models.providers.openai.apiKey = 'openai-token'
    settings.models.providers.openai.modelPrimary = 'gpt-4.1'

    const resolved = resolvePiModelRuntime(settings, {
      providerKey: 'openai',
      modelId: 'gpt-4.1-mini'
    })

    expect(resolved.error).toBeNull()
    expect(resolved.runtime).not.toBeNull()
    expect(resolved.runtime?.source).toBe('catalog')
    expect(resolved.runtime?.model.id).toBe('gpt-4.1-mini')
    expect(resolved.runtime?.apiKey).toBe('openai-token')
  })

  it('uses slot model when modelId override is not provided', () => {
    const settings = createDefaultAppSettings('/tmp/notes')
    settings.models.providers.openai.apiKey = 'openai-token'
    settings.models.providers.openai.modelPrimary = 'gpt-4.1'
    settings.models.providers.openai.modelFast = 'gpt-4.1-mini'

    const resolved = resolvePiModelRuntime(settings, {
      providerKey: 'openai',
      slot: 'fast'
    })

    expect(resolved.error).toBeNull()
    expect(resolved.runtime?.model.id).toBe('gpt-4.1-mini')
  })

  it('returns API key error when provider key is missing', () => {
    const settings = createDefaultAppSettings('/tmp/notes')
    settings.models.providers.openai.apiKey = ''

    const resolved = resolvePiModelRuntime(settings, {
      providerKey: 'openai',
      modelId: 'gpt-4.1'
    })

    expect(resolved.runtime).toBeNull()
    expect(resolved.error).toContain('API Key')
  })

  it('builds configured runtime for non-catalog providers', () => {
    const settings = createDefaultAppSettings('/tmp/notes')
    settings.models.providers.kimi.apiKey = 'kimi-token'
    settings.models.providers.kimi.modelPrimary = 'kimi-k2-preview'

    const resolved = resolvePiModelRuntime(settings, {
      providerKey: 'kimi',
      slot: 'primary'
    })

    expect(resolved.error).toBeNull()
    expect(resolved.runtime?.source).toBe('configured')
    expect(resolved.runtime?.model.provider).toBe('moonshotai')
    expect(resolved.runtime?.model.api).toBe('anthropic-messages')
  })

  it('builds deduped configured model options with active provider first', () => {
    const settings = createDefaultAppSettings('/tmp/notes')
    settings.models.activeProvider = 'openai'
    settings.models.providers.openai.apiKey = 'openai-token'
    settings.models.providers.openai.modelPrimary = 'gpt-4.1'
    settings.models.providers.openai.modelFast = 'gpt-4.1-mini'
    settings.models.providers.openai.modelCatalog = ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o-mini']
    settings.models.providers.anthropic.apiKey = 'anthropic-token'
    settings.models.providers.anthropic.modelCatalog = ['claude-sonnet-4-20250514']

    const options = listConfiguredPiModelOptions(settings)

    expect(options.length).toBeGreaterThanOrEqual(4)
    expect(options[0].providerKey).toBe('openai')
    expect(options[0].slot).toBe('primary')
    expect(options.some((item) => item.slot === 'fast' && item.providerKey === 'openai')).toBe(true)
    expect(options.some((item) => item.slot === 'catalog' && item.modelId === 'gpt-4o-mini')).toBe(
      true
    )

    const duplicated = options.filter(
      (item) => item.providerKey === 'openai' && item.modelId === 'gpt-4.1'
    )
    expect(duplicated).toHaveLength(1)
  })
})
