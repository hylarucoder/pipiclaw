/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import '@renderer/i18n'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultAppSettings } from '@pipiclaw/shared/rpc/settings'
import { ChatPage } from './ChatPage'

vi.mock('@renderer/components/PiWebChatPanel', () => ({
  PiWebChatPanel: ({
    modelTarget
  }: {
    modelTarget?: { providerKey?: string; modelId?: string }
  }) => (
    <div
      data-testid="pi-web-chat-panel"
      data-provider={modelTarget?.providerKey ?? ''}
      data-model={modelTarget?.modelId ?? ''}
    />
  )
}))

function renderChatPage(): void {
  const settings = createDefaultAppSettings('/tmp/notes')
  settings.models.activeProvider = 'openai'
  settings.models.providers.openai.apiKey = 'openai-token'
  settings.models.providers.anthropic.apiKey = ''

  render(
    <MemoryRouter initialEntries={['/chat']}>
      <ChatPage settings={settings} />
    </MemoryRouter>
  )
}

afterEach(() => {
  cleanup()
})

describe('ChatPage', () => {
  it('falls back to first model with key when active provider model has no key', () => {
    const settings = createDefaultAppSettings('/tmp/notes')
    settings.models.activeProvider = 'anthropic'
    settings.models.providers.anthropic.apiKey = ''
    settings.models.providers.glm.apiKey = 'glm-token'

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <ChatPage settings={settings} />
      </MemoryRouter>
    )

    const panel = screen.getByTestId('pi-web-chat-panel')
    expect(panel).toHaveAttribute('data-provider', 'glm')
    expect(screen.getByText(/当前: zhipuai\//)).toBeInTheDocument()
  })

  it('renders configured model options and marks missing key options as disabled', async () => {
    const user = userEvent.setup()
    renderChatPage()

    const modelSelect = screen.getByRole('combobox')
    await user.click(modelSelect)
    const listbox = await screen.findByRole('listbox')
    const options = within(listbox).getAllByRole('option')

    expect(options.length).toBeGreaterThan(3)
    expect(
      options.some(
        (option) =>
          option.getAttribute('aria-disabled') === 'true' || option.hasAttribute('data-disabled')
      )
    ).toBe(true)
    expect(screen.getByText(/当前: openai\//)).toBeInTheDocument()
  })

  it('updates model target after selecting another provider model option', async () => {
    const user = userEvent.setup()
    const settings = createDefaultAppSettings('/tmp/notes')
    settings.models.activeProvider = 'openai'
    settings.models.providers.openai.apiKey = 'openai-token'
    settings.models.providers.anthropic.apiKey = 'anthropic-token'

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <ChatPage settings={settings} />
      </MemoryRouter>
    )

    const panel = screen.getByTestId('pi-web-chat-panel')
    expect(panel).toHaveAttribute('data-provider', 'openai')

    const modelSelect = screen.getByRole('combobox')
    await user.click(modelSelect)
    const listbox = await screen.findByRole('listbox')
    const options = within(listbox).getAllByRole('option')
    const anthropicPrimaryOption = options.find((option) =>
      option.textContent?.toLowerCase().includes('anthropic')
    )
    expect(anthropicPrimaryOption).toBeDefined()
    await user.click(anthropicPrimaryOption!)

    expect(panel).toHaveAttribute('data-provider', 'anthropic')
    expect(screen.getByText(/当前: anthropic\//)).toBeInTheDocument()
  })
})
