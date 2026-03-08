import hljs from "highlight.js";
import { html, render, type TemplateResult } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { Copy, Download } from "lucide";
import { renderIcon } from "../../utils/icon.js";
import { i18n } from "../../utils/i18n.js";
import { ArtifactElement } from "./ArtifactElement.js";

export class SvgArtifact extends ArtifactElement {
	private _content = "";
	override get content(): string {
		return this._content;
	}
	override set content(value: string) {
		this._content = value;
		this.renderView();
	}

	private viewMode: "preview" | "code" = "preview";

	private setViewMode(mode: "preview" | "code") {
		this.viewMode = mode;
		this.renderView();
	}

	private async copyToClipboard(content: string) {
		try {
			await navigator.clipboard.writeText(content);
		} catch (error) {
			console.error("Failed to copy svg artifact content:", error);
		}
	}

	private download(content: string, filename: string, mimeType: string) {
		const blob = new Blob([content], { type: mimeType });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = filename;
		document.body.appendChild(anchor);
		anchor.click();
		document.body.removeChild(anchor);
		URL.revokeObjectURL(url);
	}

	private renderViewModeToggle() {
		const baseClass =
			"inline-flex h-8 items-center justify-center rounded-md px-2 text-xs font-medium transition-colors";
		const activeClass = "bg-muted text-foreground";
		const inactiveClass = "text-muted-foreground hover:bg-muted hover:text-foreground";

		return html`
			<div class="inline-flex items-center gap-1 rounded-md border border-border p-1">
				<button
					type="button"
					@click=${() => {
						this.setViewMode("preview");
					}}
					class="${baseClass} ${this.viewMode === "preview" ? activeClass : inactiveClass}"
				>
					Preview
				</button>
				<button
					type="button"
					@click=${() => {
						this.setViewMode("code");
					}}
					class="${baseClass} ${this.viewMode === "code" ? activeClass : inactiveClass}"
				>
					Code
				</button>
			</div>
		`;
	}

	public getHeaderButtons() {
		return html`
			<div class="flex items-center gap-2">
				${this.renderViewModeToggle()}
				<button
					type="button"
					@click=${() => {
						void this.copyToClipboard(this._content);
					}}
					class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					title=${i18n("Copy SVG")}
				>
					${renderIcon(Copy, "sm")}
				</button>
				<button
					type="button"
					@click=${() => {
						this.download(this._content, this.filename, "image/svg+xml");
					}}
					class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					title=${i18n("Download SVG")}
				>
					${renderIcon(Download, "sm")}
				</button>
			</div>
		`;
	}

	override connectedCallback(): void {
		super.connectedCallback();
		this.style.display = "block";
		this.style.height = "100%";
		this.renderView();
	}

	private renderTemplate(): TemplateResult {
		return html`
			<div class="h-full flex flex-col">
				<div class="flex-1 overflow-auto">
					${
						this.viewMode === "preview"
							? html`<div class="h-full flex items-center justify-center">
								${unsafeHTML(this.content.replace(/<svg(\s|>)/i, (_m, p1) => `<svg class="w-full h-full"${p1}`))}
							</div>`
							: html`<pre class="m-0 p-4 text-xs"><code class="hljs language-xml">${unsafeHTML(
									hljs.highlight(this.content, { language: "xml", ignoreIllegals: true }).value,
								)}</code></pre>`
					}
				</div>
			</div>
		`;
	}

	private renderView(): void {
		render(this.renderTemplate(), this);
	}
}

if (!customElements.get("svg-artifact")) {
	customElements.define("svg-artifact", SvgArtifact);
}

declare global {
	interface HTMLElementTagNameMap {
		"svg-artifact": SvgArtifact;
	}
}
