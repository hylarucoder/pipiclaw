import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ProviderKeyInputView } from '@renderer/components/webui/ProviderKeyInputView'

export class ProviderKeyInput extends HTMLElement {
  private root?: Root
  private _provider = ''

  set provider(value: string) {
    this._provider = value
    this.render()
  }

  get provider(): string {
    return this._provider
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
    if (!this.root || !this.isConnected) return
    this.root.render(createElement(ProviderKeyInputView, { provider: this._provider }))
  }
}

if (!customElements.get('provider-key-input')) {
  customElements.define('provider-key-input', ProviderKeyInput)
}
