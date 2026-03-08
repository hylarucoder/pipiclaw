import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ConsoleBlockView } from '@renderer/components/webui/ConsoleBlockView'

type ConsoleVariant = 'default' | 'error'

function normalizeVariant(value: string | null | undefined): ConsoleVariant {
  return value === 'error' ? 'error' : 'default'
}

export class ConsoleBlock extends HTMLElement {
  private root?: Root
  private _content = ''
  private _variant: ConsoleVariant = 'default'

  static get observedAttributes(): string[] {
    return ['content', 'variant']
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
    if (name === 'content') {
      this._content = newValue || ''
    }

    if (name === 'variant') {
      this._variant = normalizeVariant(newValue)
    }

    this.render()
  }

  set content(value: string) {
    this._content = value || ''
    this.render()
  }

  get content(): string {
    return this._content
  }

  set variant(value: ConsoleVariant) {
    this._variant = normalizeVariant(value)
    this.render()
  }

  get variant(): ConsoleVariant {
    return this._variant
  }

  connectedCallback(): void {
    this.style.display = 'block'
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

    this.root.render(
      createElement(ConsoleBlockView, {
        content: this._content,
        variant: this._variant
      })
    )
  }
}

if (!customElements.get('console-block')) {
  customElements.define('console-block', ConsoleBlock)
}
