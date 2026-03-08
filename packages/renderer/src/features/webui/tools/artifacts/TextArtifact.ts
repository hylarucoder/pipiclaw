import hljs from "highlight.js";
import { html, render, type TemplateResult } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { Copy, Download } from "lucide";
import { renderIcon } from "../../utils/icon.js";
import { i18n } from "../../utils/i18n.js";
import { ArtifactElement } from "./ArtifactElement.js";

// Known code file extensions for highlighting
const CODE_EXTENSIONS = [
	"js",
	"javascript",
	"ts",
	"typescript",
	"jsx",
	"tsx",
	"py",
	"python",
	"java",
	"c",
	"cpp",
	"cs",
	"php",
	"rb",
	"ruby",
	"go",
	"rust",
	"swift",
	"kotlin",
	"scala",
	"dart",
	"html",
	"css",
	"scss",
	"sass",
	"less",
	"json",
	"xml",
	"yaml",
	"yml",
	"toml",
	"sql",
	"sh",
	"bash",
	"ps1",
	"bat",
	"r",
	"matlab",
	"julia",
	"lua",
	"perl",
	"vue",
	"svelte",
];

export class TextArtifact extends ArtifactElement {
	private _content = "";
	override get content(): string {
		return this._content;
	}
	override set content(value: string) {
		this._content = value;
		this.renderView();
	}

	private isCode(): boolean {
		const ext = this.filename.split(".").pop()?.toLowerCase() || "";
		return CODE_EXTENSIONS.includes(ext);
	}

	private getLanguageFromExtension(ext: string): string {
		const languageMap: Record<string, string> = {
			js: "javascript",
			ts: "typescript",
			py: "python",
			rb: "ruby",
			yml: "yaml",
			ps1: "powershell",
			bat: "batch",
		};
		return languageMap[ext] || ext;
	}

	private getMimeType(): string {
		const ext = this.filename.split(".").pop()?.toLowerCase() || "";
		if (ext === "svg") return "image/svg+xml";
		if (ext === "md" || ext === "markdown") return "text/markdown";
		return "text/plain";
	}

	private async copyToClipboard(content: string) {
		try {
			await navigator.clipboard.writeText(content);
		} catch (error) {
			console.error("Failed to copy text artifact content:", error);
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

	public getHeaderButtons() {
		return html`
			<div class="flex items-center gap-1">
				<button
					type="button"
					@click=${() => {
						void this.copyToClipboard(this.content);
					}}
					class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					title=${i18n("Copy")}
				>
					${renderIcon(Copy, "sm")}
				</button>
				<button
					type="button"
					@click=${() => {
						this.download(this.content, this.filename, this.getMimeType());
					}}
					class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					title=${i18n("Download")}
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
		const isCode = this.isCode();
		const ext = this.filename.split(".").pop() || "";
		return html`
			<div class="h-full flex flex-col">
				<div class="flex-1 overflow-auto">
					${
						isCode
							? html`
								<pre class="m-0 p-4 text-xs"><code class="hljs language-${this.getLanguageFromExtension(
									ext.toLowerCase(),
								)}">${unsafeHTML(
									hljs.highlight(this.content, {
										language: this.getLanguageFromExtension(ext.toLowerCase()),
										ignoreIllegals: true,
									}).value,
								)}</code></pre>
							`
							: html` <pre class="m-0 p-4 text-xs font-mono">${this.content}</pre> `
					}
				</div>
			</div>
		`;
	}

	private renderView(): void {
		render(this.renderTemplate(), this);
	}
}

if (!customElements.get("text-artifact")) {
	customElements.define("text-artifact", TextArtifact);
}

declare global {
	interface HTMLElementTagNameMap {
		"text-artifact": TextArtifact;
	}
}
