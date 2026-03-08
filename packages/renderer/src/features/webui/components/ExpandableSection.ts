import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ExpandableSectionView } from '@renderer/components/webui/ExpandableSectionView'

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    return value !== 'false' && value !== '0' && value !== ''
  }
  return Boolean(value)
}

function HtmlContent({ html }: { html: string }) {
  return createElement('div', { dangerouslySetInnerHTML: { __html: html } })
}

export class ExpandableSection extends HTMLElement {
  private root?: Root
  private _summary = ''
  private _defaultExpanded = false
  private capturedHtml = ''

  static get observedAttributes(): string[] {
    return ['summary', 'default-expanded']
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
    if (name === 'summary') {
      this._summary = newValue || ''
    }

    if (name === 'default-expanded') {
      this._defaultExpanded = newValue !== null
    }

    this.render()
  }

  set summary(value: string) {
    this._summary = value || ''
    this.render()
  }

  get summary(): string {
    return this._summary
  }

  set defaultExpanded(value: boolean) {
    this._defaultExpanded = toBoolean(value)
    this.render()
  }

  get defaultExpanded(): boolean {
    return this._defaultExpanded
  }

  connectedCallback(): void {
    if (!this.root) {
      this.root = createRoot(this)
    }

    if (!this.capturedHtml) {
      this.capturedHtml = this.innerHTML
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
      createElement(
        ExpandableSectionView,
        {
          summary: this._summary,
          defaultExpanded: this._defaultExpanded
        },
        createElement(HtmlContent, { html: this.capturedHtml })
      )
    )
  }
}

if (!customElements.get('expandable-section')) {
  customElements.define('expandable-section', ExpandableSection)
}
