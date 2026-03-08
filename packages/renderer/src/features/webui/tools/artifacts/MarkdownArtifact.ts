import hljs from "highlight.js";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { html, render, type TemplateResult } from "lit-html";
import { createRef, ref, type Ref } from "lit-html/directives/ref.js";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { Copy, Download } from "lucide";
import { MarkdownReactContent } from "@renderer/components/MarkdownReactContent.js";
import { renderIcon } from "../../utils/icon.js";
import { i18n } from "../../utils/i18n.js";
import { ArtifactElement } from "./ArtifactElement.js";

export class MarkdownArtifact extends ArtifactElement {
	private _content = "";
	override get content(): string {
		return this._content;
	}
	override set content(value: string) {
		this._content = value;
		this.renderView();
		this.syncPreview();
	}

	private viewMode: "preview" | "code" = "preview";
	private previewRef: Ref<HTMLDivElement> = createRef();
	private previewRoot: Root | null = null;

	private setViewMode(mode: "preview" | "code"): void {
		this.viewMode = mode;
		this.renderView();
		this.syncPreview();
	}

	private syncPreview(): void {
		const container = this.previewRef.value;
		if (!container || this.viewMode !== "preview") {
			if (this.previewRoot) {
				this.previewRoot.unmount();
				this.previewRoot = null;
			}
			return;
		}

		if (!this.previewRoot) {
			this.previewRoot = createRoot(container);
		}
		this.previewRoot.render(
			createElement(MarkdownReactContent, {
				markdown: this.content,
				stripFrontmatter: false,
				className: "text-sm leading-relaxed",
			}),
		);
	}

	private async copyToClipboard(content: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(content);
		} catch (error) {
			console.error("Failed to copy markdown artifact content:", error);
		}
	}

	private download(content: string, filename: string, mimeType: string): void {
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

	private renderViewModeToggle(): TemplateResult {
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
					${i18n("Preview")}
				</button>
				<button
					type="button"
					@click=${() => {
						this.setViewMode("code");
					}}
					class="${baseClass} ${this.viewMode === "code" ? activeClass : inactiveClass}"
				>
					${i18n("Code")}
				</button>
			</div>
		`;
	}

	public getHeaderButtons(): TemplateResult {
		return html`
			<div class="flex items-center gap-2">
				${this.renderViewModeToggle()}
				<button
					type="button"
					@click=${() => {
						void this.copyToClipboard(this._content);
					}}
					class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					title=${i18n("Copy Markdown")}
				>
					${renderIcon(Copy, "sm")}
				</button>
				<button
					type="button"
					@click=${() => {
						this.download(this._content, this.filename, "text/markdown");
					}}
					class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					title=${i18n("Download Markdown")}
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
		this.syncPreview();
	}

	private renderTemplate(): TemplateResult {
		return html`
			<div class="h-full flex flex-col">
				<div class="flex-1 overflow-auto">
					${
						this.viewMode === "preview"
							? html`<div class="p-4"><div ${ref(this.previewRef)}></div></div>`
							: html`<pre class="m-0 p-4 text-xs whitespace-pre-wrap break-words"><code class="hljs language-markdown">${unsafeHTML(
									hljs.highlight(this.content, { language: "markdown", ignoreIllegals: true }).value,
								)}</code></pre>`
					}
				</div>
			</div>
		`;
	}

	private renderView(): void {
		render(this.renderTemplate(), this);
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		if (this.previewRoot) {
			this.previewRoot.unmount();
			this.previewRoot = null;
		}
	}
}

if (!customElements.get("markdown-artifact")) {
	customElements.define("markdown-artifact", MarkdownArtifact);
}

declare global {
	interface HTMLElementTagNameMap {
		"markdown-artifact": MarkdownArtifact;
	}
}
