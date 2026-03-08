import hljs from "highlight.js";
import { html } from "lit-html";
import { createRef, type Ref, ref } from "lit-html/directives/ref.js";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { Copy, Download, RefreshCw } from "lucide";
import type { SandboxIframe } from "../../components/SandboxedIframe.js";
import { type MessageConsumer, RUNTIME_MESSAGE_ROUTER } from "../../components/sandbox/RuntimeMessageRouter.js";
import type { SandboxRuntimeProvider } from "../../components/sandbox/SandboxRuntimeProvider.js";
import { renderIcon } from "../../utils/icon.js";
import { i18n } from "../../utils/i18n.js";
import "../../components/SandboxedIframe.js";
import { ArtifactElement } from "./ArtifactElement.js";
import type { Console } from "./Console.js";
import "./Console.js";

export class HtmlArtifact extends ArtifactElement {
	override filename = "";
	runtimeProviders: SandboxRuntimeProvider[] = [];
	sandboxUrlProvider?: () => string;

	private _content = "";
	private logs: Array<{ type: "log" | "error"; text: string }> = [];

	// Refs for DOM elements
	public sandboxIframeRef: Ref<SandboxIframe> = createRef();
	private consoleRef: Ref<Console> = createRef();

	private viewMode: "preview" | "code" = "preview";

	private setViewMode(mode: "preview" | "code") {
		this.viewMode = mode;
		this.requestUpdate();
	}

	private async copyToClipboard(content: string) {
		try {
			await navigator.clipboard.writeText(content);
		} catch (error) {
			console.error("Failed to copy html artifact content:", error);
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
					@click=${() => this.setViewMode("preview")}
					class="${baseClass} ${this.viewMode === "preview" ? activeClass : inactiveClass}"
				>
					Preview
				</button>
				<button
					type="button"
					@click=${() => this.setViewMode("code")}
					class="${baseClass} ${this.viewMode === "code" ? activeClass : inactiveClass}"
				>
					Code
				</button>
			</div>
		`;
	}

	public getHeaderButtons() {
		// Generate standalone HTML with all runtime code injected for download
		const sandbox = this.sandboxIframeRef.value;
		const sandboxId = `artifact-${this.filename}`;
		const downloadContent =
			sandbox?.prepareHtmlDocument(sandboxId, this._content, this.runtimeProviders || [], {
				isHtmlArtifact: true,
				isStandalone: true, // Skip runtime bridge and navigation interceptor for standalone downloads
			}) || this._content;

		return html`
			<div class="flex items-center gap-2">
				${this.renderViewModeToggle()}
				<button
					type="button"
					@click=${() => {
						this.logs = [];
						this.executeContent(this._content);
					}}
					class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					title=${i18n("Reload HTML")}
				>
					${renderIcon(RefreshCw, "sm")}
				</button>
				<button
					type="button"
					@click=${() => this.copyToClipboard(this._content)}
					class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					title=${i18n("Copy HTML")}
				>
					${renderIcon(Copy, "sm")}
				</button>
				<button
					type="button"
					@click=${() => this.download(downloadContent, this.filename, "text/html")}
					class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					title=${i18n("Download HTML")}
				>
					${renderIcon(Download, "sm")}
				</button>
			</div>
		`;
	}

	override set content(value: string) {
		const oldValue = this._content;
		this._content = value;
		if (oldValue !== value) {
			// Reset logs when content changes
			this.logs = [];
			this.requestUpdate();
			// Execute content in sandbox if it exists
			if (this.sandboxIframeRef.value && value) {
				this.executeContent(value);
			}
		}
	}

	public executeContent(html: string) {
		const sandbox = this.sandboxIframeRef.value;
		if (!sandbox) return;

		// Configure sandbox URL provider if provided (for browser extensions)
		if (this.sandboxUrlProvider) {
			sandbox.sandboxUrlProvider = this.sandboxUrlProvider;
		}

		const sandboxId = `artifact-${this.filename}`;

		// Create consumer for console messages
		const consumer: MessageConsumer = {
			handleMessage: async (message: any): Promise<void> => {
				if (message.type === "console") {
					// Create new array reference for Lit reactivity
					this.logs = [
						...this.logs,
						{
							type: message.method === "error" ? "error" : "log",
							text: message.text,
						},
					];
					this.requestUpdate(); // Re-render to show console
				}
			},
		};

		// Inject window.complete() call at the end of the HTML to signal when page is loaded
		// HTML artifacts don't time out - they call complete() when ready
		let modifiedHtml = html;
		if (modifiedHtml.includes("</html>")) {
			modifiedHtml = modifiedHtml.replace(
				"</html>",
				"<script>if (window.complete) window.complete();</script></html>",
			);
		} else {
			// If no closing </html> tag, append the script
			modifiedHtml += "<script>if (window.complete) window.complete();</script>";
		}

		// Load content - this handles sandbox registration, consumer registration, and iframe creation
		sandbox.loadContent(sandboxId, modifiedHtml, this.runtimeProviders, [consumer]);
	}

	override get content(): string {
		return this._content;
	}

	override disconnectedCallback() {
		super.disconnectedCallback();
		// Unregister sandbox when element is removed from DOM
		const sandboxId = `artifact-${this.filename}`;
		RUNTIME_MESSAGE_ROUTER.unregisterSandbox(sandboxId);
	}

	override firstUpdated() {
		// Execute initial content
		if (this._content && this.sandboxIframeRef.value) {
			this.executeContent(this._content);
		}
	}

	override updated(changedProperties: Map<string | number | symbol, unknown>) {
		super.updated(changedProperties);
		// If we have content but haven't executed yet (e.g., during reconstruction),
		// execute when the iframe ref becomes available
		if (this._content && this.sandboxIframeRef.value && this.logs.length === 0) {
			this.executeContent(this._content);
		}
	}

	public getLogs(): string {
		if (this.logs.length === 0) return i18n("No logs for {filename}").replace("{filename}", this.filename);
		return this.logs.map((l) => `[${l.type}] ${l.text}`).join("\n");
	}

	override render() {
		return html`
			<div class="h-full flex flex-col">
				<div class="flex-1 overflow-hidden relative">
					<!-- Preview container - always in DOM, just hidden when not active -->
					<div class="absolute inset-0 flex flex-col" style="display: ${this.viewMode === "preview" ? "flex" : "none"}">
						<sandbox-iframe class="flex-1" ${ref(this.sandboxIframeRef)}></sandbox-iframe>
						${
							this.logs.length > 0
								? html`<artifact-console .logs=${this.logs} ${ref(this.consoleRef)}></artifact-console>`
								: ""
						}
					</div>

					<!-- Code view - always in DOM, just hidden when not active -->
					<div class="absolute inset-0 overflow-auto bg-background" style="display: ${this.viewMode === "code" ? "block" : "none"}">
						<pre class="m-0 p-4 text-xs"><code class="hljs language-html">${unsafeHTML(
							hljs.highlight(this._content, { language: "html" }).value,
						)}</code></pre>
					</div>
				</div>
			</div>
		`;
	}
}

if (!customElements.get("html-artifact")) {
	customElements.define("html-artifact", HtmlArtifact);
}
