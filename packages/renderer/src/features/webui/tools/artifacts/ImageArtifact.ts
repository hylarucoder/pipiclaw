import { html, render, type TemplateResult } from "lit-html";
import { Download } from "lucide";
import { renderIcon } from "../../utils/icon.js";
import { i18n } from "../../utils/i18n.js";
import { ArtifactElement } from "./ArtifactElement.js";

export class ImageArtifact extends ArtifactElement {
	private _content = "";

	get content(): string {
		return this._content;
	}

	set content(value: string) {
		this._content = value;
		this.renderView();
	}

	override connectedCallback(): void {
		super.connectedCallback();
		this.style.display = "block";
		this.style.height = "100%";
		this.renderView();
	}

	private getMimeType(): string {
		const ext = this.filename.split(".").pop()?.toLowerCase();
		if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
		if (ext === "gif") return "image/gif";
		if (ext === "webp") return "image/webp";
		if (ext === "svg") return "image/svg+xml";
		if (ext === "bmp") return "image/bmp";
		if (ext === "ico") return "image/x-icon";
		return "image/png";
	}

	private getImageUrl(): string {
		// If content is already a data URL, use it directly
		if (this._content.startsWith("data:")) {
			return this._content;
		}
		// Otherwise assume it's base64 and construct data URL
		return `data:${this.getMimeType()};base64,${this._content}`;
	}

	private decodeBase64(): Uint8Array {
		let base64Data: string;

		// If content is a data URL, extract the base64 part
		if (this._content.startsWith("data:")) {
			const base64Match = this._content.match(/base64,(.+)/);
			if (base64Match) {
				base64Data = base64Match[1];
			} else {
				// Not a base64 data URL, return empty
				return new Uint8Array(0);
			}
		} else {
			// Otherwise use content as-is
			base64Data = this._content;
		}

		// Decode base64 to binary string
		const binaryString = atob(base64Data);

		// Convert binary string to Uint8Array
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}

		return bytes;
	}

	private download(content: Uint8Array, filename: string, mimeType: string) {
		const bytes = new Uint8Array(content);
		const blob = new Blob([bytes.buffer], { type: mimeType });
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
						this.download(this.decodeBase64(), this.filename, this.getMimeType());
					}}
					class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					title=${i18n("Download")}
				>
					${renderIcon(Download, "sm")}
				</button>
			</div>
		`;
	}

	private renderTemplate(): TemplateResult {
		return html`
			<div class="h-full flex flex-col bg-background overflow-auto">
				<div class="flex-1 flex items-center justify-center p-4">
					<img
						src="${this.getImageUrl()}"
						alt="${this.filename}"
						class="max-w-full max-h-full object-contain"
						@error=${(e: Event) => {
							const target = e.target as HTMLImageElement;
							target.src =
								"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext x='50' y='50' text-anchor='middle' dominant-baseline='middle' fill='%23999'%3EImage Error%3C/text%3E%3C/svg%3E";
						}}
					/>
				</div>
			</div>
		`;
	}

	private renderView(): void {
		render(this.renderTemplate(), this);
	}
}

if (!customElements.get("image-artifact")) {
	customElements.define("image-artifact", ImageArtifact);
}

declare global {
	interface HTMLElementTagNameMap {
		"image-artifact": ImageArtifact;
	}
}
