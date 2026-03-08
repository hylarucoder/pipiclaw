import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { CustomProviderCardView } from '@renderer/components/webui/CustomProviderCardView'
import type { CustomProvider } from '../storage/stores/custom-providers-store.js'

type ProviderStatus = {
  modelCount: number
  status: 'connected' | 'disconnected' | 'checking'
}

export class CustomProviderCard extends HTMLElement {
  private root?: Root
  private _provider?: CustomProvider
  private _isAutoDiscovery = false
  private _status?: ProviderStatus
  private _onRefresh?: (provider: CustomProvider) => void
  private _onEdit?: (provider: CustomProvider) => void
  private _onDelete?: (provider: CustomProvider) => void

  set provider(value: CustomProvider | undefined) {
    this._provider = value
    this.render()
  }

  get provider(): CustomProvider | undefined {
    return this._provider
  }

  set isAutoDiscovery(value: boolean) {
    this._isAutoDiscovery = Boolean(value)
    this.render()
  }

  get isAutoDiscovery(): boolean {
    return this._isAutoDiscovery
  }

  set status(value: ProviderStatus | undefined) {
    this._status = value
    this.render()
  }

  get status(): ProviderStatus | undefined {
    return this._status
  }

  set onRefresh(value: ((provider: CustomProvider) => void) | undefined) {
    this._onRefresh = value
    this.render()
  }

  set onEdit(value: ((provider: CustomProvider) => void) | undefined) {
    this._onEdit = value
    this.render()
  }

  set onDelete(value: ((provider: CustomProvider) => void) | undefined) {
    this._onDelete = value
    this.render()
  }

  connectedCallback(): void {
    if (!this.root) {
      this.root = createRoot(this)
    }
    this.render()
  }

  disconnectedCallback(): void {
    this.root?.unmount()
    this.root = undefined
  }

  private render(): void {
    if (!this.root || !this.isConnected || !this._provider) return

    this.root.render(
      createElement(CustomProviderCardView, {
        provider: this._provider,
        isAutoDiscovery: this._isAutoDiscovery,
        status: this._status,
        onRefresh: this._onRefresh,
        onEdit: this._onEdit,
        onDelete: this._onDelete
      })
    )
  }
}

if (!customElements.get('custom-provider-card')) {
  customElements.define('custom-provider-card', CustomProviderCard)
}
