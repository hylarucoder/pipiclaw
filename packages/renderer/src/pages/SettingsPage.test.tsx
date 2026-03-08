/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import '@renderer/i18n'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MODEL_PROVIDER_KEYS } from '@pipiclaw/shared/config/modelProviders'
import {
  createDefaultAppSettings,
  type AppSettings,
  type AppSettingsResolveActiveModelResult
} from '@pipiclaw/shared/rpc/settings'

const settingsApiMocks = vi.hoisted(() => ({
  invokeResolveActiveModel: vi.fn(),
  invokeSettingsGet: vi.fn(),
  invokeSettingsReset: vi.fn(),
  invokeSettingsUpdate: vi.fn()
}))

const runtimeMocks = vi.hoisted(() => ({
  resolvePiModelRuntime: vi.fn()
}))

const completeMock = vi.hoisted(() => vi.fn())

vi.mock('@renderer/lib/settings', () => settingsApiMocks)
vi.mock('@pipiclaw/agent-core', () => ({
  resolvePiModelRuntime: runtimeMocks.resolvePiModelRuntime
}))
vi.mock('@renderer/lib/piAiBrowserShim', () => ({
  complete: completeMock
}))

import { SettingsPage } from './SettingsPage'

function buildModelSummary(settings: AppSettings): AppSettingsResolveActiveModelResult {
  const providerKey = settings.models.activeProvider
  const providerSettings = settings.models.providers[providerKey]
  return {
    providerKey,
    providerId: providerKey,
    modelId: providerSettings.modelPrimary,
    baseUrl: providerSettings.baseUrl,
    hasApiKey: providerSettings.apiKey.trim().length > 0,
    error: undefined
  }
}

function createMockRuntime(providerKey: string): {
  model: {
    id: string
    name: string
    provider: string
    api: string
    baseUrl: string
    reasoning: boolean
    input: string[]
    cost: { input: number; output: number; cacheRead: number; cacheWrite: number }
    contextWindow: number
    maxTokens: number
  }
  apiKey: string
  source: 'configured'
} {
  return {
    model: {
      id: `${providerKey}-mock-model`,
      name: `${providerKey}-mock-model`,
      provider: providerKey,
      api: 'openai-completions',
      baseUrl: '',
      reasoning: true,
      input: ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 8192
    },
    apiKey: `${providerKey}-token`,
    source: 'configured' as const
  }
}

function renderSettingsPage(settings: AppSettings): void {
  const onSettingsChanged = vi.fn()
  const onRefreshSettings = vi.fn().mockResolvedValue(undefined)

  render(
    <MemoryRouter initialEntries={['/settings']}>
      <SettingsPage
        settings={settings}
        settingsLoading={false}
        settingsError={null}
        onSettingsChanged={onSettingsChanged}
        onRefreshSettings={onRefreshSettings}
      />
    </MemoryRouter>
  )
}

describe('SettingsPage', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()

    const settings = createDefaultAppSettings('/tmp/notes')
    settings.models.activeProvider = 'openai'
    settings.models.providers.openai.apiKey = 'openai-token'

    settingsApiMocks.invokeResolveActiveModel.mockResolvedValue(buildModelSummary(settings))
    settingsApiMocks.invokeSettingsGet.mockResolvedValue({ settings })
    settingsApiMocks.invokeSettingsUpdate.mockResolvedValue({ settings })
    settingsApiMocks.invokeSettingsReset.mockResolvedValue({ settings })

    runtimeMocks.resolvePiModelRuntime.mockImplementation(
      (_settings: AppSettings, target?: { providerKey?: string }) => {
        const providerKey = target?.providerKey ?? 'openai'
        return {
          runtime: createMockRuntime(providerKey),
          error: null
        }
      }
    )
    completeMock.mockResolvedValue({ content: 'pong' })
  })

  it('switches sections between general and model settings', async () => {
    const user = userEvent.setup()
    const settings = createDefaultAppSettings('/tmp/notes')

    renderSettingsPage(settings)

    expect(screen.getByText('设置导航')).toBeInTheDocument()
    expect(screen.getByText('通用设置')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '模型' }))

    expect(screen.getByText('模型设置')).toBeInTheDocument()
    expect(screen.getByText('显示 API Key')).toBeInTheDocument()
  })

  it('pings a provider successfully and shows connectivity status', async () => {
    const user = userEvent.setup()
    const settings = createDefaultAppSettings('/tmp/notes')
    settings.models.providers.openai.apiKey = 'openai-token'

    renderSettingsPage(settings)
    await user.click(screen.getByRole('button', { name: '模型' }))

    const openaiIndex = MODEL_PROVIDER_KEYS.indexOf('openai')
    const pingButtons = screen.getAllByRole('button', { name: 'Ping' })
    await user.click(pingButtons[openaiIndex])

    await waitFor(() => expect(completeMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByText(/连通正常/)).toBeInTheDocument())
  })

  it('shows runtime resolve error when ping target cannot build runtime', async () => {
    const user = userEvent.setup()
    const settings = createDefaultAppSettings('/tmp/notes')

    runtimeMocks.resolvePiModelRuntime.mockImplementation(
      (_settings: AppSettings, target?: { providerKey?: string }) => {
        if (target?.providerKey === 'openai') {
          return {
            runtime: null,
            error: '缺少 API Key'
          }
        }

        return {
          runtime: createMockRuntime(target?.providerKey ?? 'anthropic'),
          error: null
        }
      }
    )

    renderSettingsPage(settings)
    await user.click(screen.getByRole('button', { name: '模型' }))

    const openaiIndex = MODEL_PROVIDER_KEYS.indexOf('openai')
    const pingButtons = screen.getAllByRole('button', { name: 'Ping' })
    await user.click(pingButtons[openaiIndex])

    await waitFor(() => expect(screen.getByText('缺少 API Key')).toBeInTheDocument())
    expect(completeMock).not.toHaveBeenCalled()
  })
})
