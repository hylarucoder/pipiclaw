import { html, render } from "lit-html";
import { repeat } from "lit-html/directives/repeat.js";
import { ChevronDown, ChevronRight, ChevronsDown, Copy, Lock } from "lucide";
import { renderIcon } from "../../utils/icon.js";
import { i18n } from "../../utils/i18n.js";

interface LogEntry {
	type: "log" | "error";
	text: string;
}

export class Console extends HTMLElement {
	private _logs: LogEntry[] = [];
	private expanded = false;
	private autoscroll = true;
	private logsContainer: HTMLDivElement | null = null;

	set logs(value: LogEntry[]) {
		this._logs = Array.isArray(value) ? value : [];
		this.render();
	}

	get logs(): LogEntry[] {
		return this._logs;
	}

	connectedCallback(): void {
		this.style.display = "block";
		this.render();
	}

	disconnectedCallback(): void {
		render(html``, this);
		this.logsContainer = null;
	}

	private getLogsText(): string {
		return this._logs.map((l) => `[${l.type}] ${l.text}`).join("\n");
	}

	private async copyLogs() {
		try {
			await navigator.clipboard.writeText(this.getLogsText());
		} catch (error) {
			console.error("Failed to copy artifact logs:", error);
		}
	}

	private render() {
		if (!this.isConnected) return;

		const errorCount = this._logs.filter((l) => l.type === "error").length;
		const summary =
			errorCount > 0
				? `${i18n("console")} (${errorCount} ${errorCount === 1 ? "error" : "errors"})`
				: `${i18n("console")} (${this._logs.length})`;

		render(
			html`
			<div class="border-t border-border p-2">
				<div class="flex items-center gap-2 w-full">
					<button
						type="button"
						@click=${() => {
							this.expanded = !this.expanded;
							this.render();
						}}
						class="inline-flex flex-1 items-center justify-start gap-2 rounded-md px-0 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
					>
						${renderIcon(this.expanded ? ChevronDown : ChevronRight, "sm")}
						<span>${summary}</span>
					</button>
					${
						this.expanded
							? html`
								<button
									type="button"
									@click=${() => {
										this.autoscroll = !this.autoscroll;
										this.render();
									}}
									class="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
										this.autoscroll
											? "bg-muted text-foreground"
											: "text-muted-foreground hover:bg-muted hover:text-foreground"
									}"
									title=${this.autoscroll ? i18n("Autoscroll enabled") : i18n("Autoscroll disabled")}
								>
									${renderIcon(this.autoscroll ? ChevronsDown : Lock, "sm")}
								</button>
								<button
									type="button"
									@click=${() => this.copyLogs()}
									class="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
									title=${i18n("Copy logs")}
								>
									${renderIcon(Copy, "sm")}
								</button>
						`
							: ""
					}
				</div>
				${
					this.expanded
						? html`
						<div class="max-h-48 overflow-y-auto space-y-1 mt-2" data-logs-container>
							${repeat(
								this._logs,
								(_log, index) => index,
								(log) => html`
									<div class="text-xs font-mono ${log.type === "error" ? "text-destructive" : "text-muted-foreground"}">
										[${log.type}] ${log.text}
									</div>
								`,
							)}
						</div>
					`
						: ""
				}
			</div>
		`,
			this,
		);

		this.logsContainer = this.querySelector("[data-logs-container]") as HTMLDivElement | null;
		if (this.autoscroll && this.expanded && this.logsContainer) {
			this.logsContainer.scrollTop = this.logsContainer.scrollHeight;
		}
	}
}

if (!customElements.get("artifact-console")) {
	customElements.define("artifact-console", Console);
}
