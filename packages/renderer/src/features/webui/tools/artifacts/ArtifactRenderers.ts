import hljs from "highlight.js";
import { html, type TemplateResult } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";

interface DiffRow {
	type: "context" | "added" | "removed";
	oldLineNumber: number | null;
	newLineNumber: number | null;
	text: string;
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function renderHighlightedCode(code: string, language: string): string {
	const normalizedLanguage = language.toLowerCase();
	if (!hljs.getLanguage(normalizedLanguage)) {
		return escapeHtml(code);
	}

	try {
		return hljs.highlight(code, { language: normalizedLanguage, ignoreIllegals: true }).value;
	} catch {
		return escapeHtml(code);
	}
}

function buildDiffRows(oldText: string, newText: string): DiffRow[] {
	const oldLines = oldText.split("\n");
	const newLines = newText.split("\n");
	const rows: DiffRow[] = [];
	let oldIndex = 0;
	let newIndex = 0;

	while (oldIndex < oldLines.length || newIndex < newLines.length) {
		const oldLine = oldLines[oldIndex];
		const newLine = newLines[newIndex];

		// Same line in both versions.
		if (oldLine !== undefined && newLine !== undefined && oldLine === newLine) {
			rows.push({
				type: "context",
				oldLineNumber: oldIndex + 1,
				newLineNumber: newIndex + 1,
				text: oldLine,
			});
			oldIndex += 1;
			newIndex += 1;
			continue;
		}

		// Insertion in new text.
		if (
			newLine !== undefined &&
			oldLine !== undefined &&
			oldLines[oldIndex] === newLines[newIndex + 1]
		) {
			rows.push({
				type: "added",
				oldLineNumber: null,
				newLineNumber: newIndex + 1,
				text: newLine,
			});
			newIndex += 1;
			continue;
		}

		// Deletion from old text.
		if (
			oldLine !== undefined &&
			newLine !== undefined &&
			oldLines[oldIndex + 1] === newLines[newIndex]
		) {
			rows.push({
				type: "removed",
				oldLineNumber: oldIndex + 1,
				newLineNumber: null,
				text: oldLine,
			});
			oldIndex += 1;
			continue;
		}

		// Replacement: show removed and added line.
		if (oldLine !== undefined) {
			rows.push({
				type: "removed",
				oldLineNumber: oldIndex + 1,
				newLineNumber: null,
				text: oldLine,
			});
			oldIndex += 1;
		}
		if (newLine !== undefined) {
			rows.push({
				type: "added",
				oldLineNumber: null,
				newLineNumber: newIndex + 1,
				text: newLine,
			});
			newIndex += 1;
		}
	}

	return rows;
}

function getDiffRowClass(type: DiffRow["type"]): string {
	if (type === "added") {
		return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
	}
	if (type === "removed") {
		return "bg-destructive/10 text-destructive";
	}
	return "text-foreground/90";
}

function getDiffPrefix(type: DiffRow["type"]): string {
	if (type === "added") return "+";
	if (type === "removed") return "-";
	return " ";
}

export function renderCodeBlock(code: string, language = "text"): TemplateResult {
	const normalizedLanguage = language.toLowerCase();
	const highlighted = renderHighlightedCode(code, normalizedLanguage);

	return html`
		<pre class="m-0 overflow-auto rounded-md border border-border bg-muted/25 p-3 text-xs leading-relaxed">
			<code class="hljs language-${normalizedLanguage}">${unsafeHTML(highlighted)}</code>
		</pre>
	`;
}

export function renderTextDiff(oldText: string, newText: string): TemplateResult {
	const rows = buildDiffRows(oldText, newText);

	return html`
		<div class="overflow-auto rounded-md border border-border bg-background">
			<table class="w-full border-collapse text-xs font-mono leading-relaxed">
				<tbody>
					${rows.map((row) => {
						return html`
							<tr class="${getDiffRowClass(row.type)}">
								<td class="w-11 border-r border-border/70 px-2 py-0.5 text-right text-muted-foreground">
									${row.oldLineNumber ?? ""}
								</td>
								<td class="w-11 border-r border-border/70 px-2 py-0.5 text-right text-muted-foreground">
									${row.newLineNumber ?? ""}
								</td>
								<td class="px-2 py-0.5 whitespace-pre">
									<span class="inline-block w-4 text-muted-foreground">${getDiffPrefix(row.type)}</span>${row.text}
								</td>
							</tr>
						`;
					})}
				</tbody>
			</table>
		</div>
	`;
}
