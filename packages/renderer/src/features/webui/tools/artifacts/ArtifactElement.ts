import { ReactiveElement, type PropertyValues } from "@lit/reactive-element";
import { render as renderTemplate, type RenderOptions, type TemplateResult } from "lit-html";

type ConnectedPart = {
	setConnected: (isConnected: boolean) => void;
};

export abstract class ArtifactElement extends ReactiveElement {
	public filename = "";
	private readonly renderOptions: RenderOptions = { host: this };
	private childPart?: ConnectedPart;

	protected override createRenderRoot(): HTMLElement | DocumentFragment {
		return this; // light DOM for shared styles
	}

	protected render(): unknown {
		return "";
	}

	protected override update(changedProperties: PropertyValues<this>): void {
		// Compute template before super.update() to preserve update ordering.
		const template = this.render();
		if (!this.hasUpdated) {
			this.renderOptions.isConnected = this.isConnected;
		}
		super.update(changedProperties);
		this.childPart = renderTemplate(template, this.renderRoot, this.renderOptions) as ConnectedPart;
	}

	override connectedCallback(): void {
		super.connectedCallback();
		this.childPart?.setConnected(true);
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.childPart?.setConnected(false);
	}

	public abstract get content(): string;
	public abstract set content(value: string);

	abstract getHeaderButtons(): TemplateResult | HTMLElement;
}
