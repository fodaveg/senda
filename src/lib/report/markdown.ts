/**
 * Salida Markdown del informe: frontmatter YAML compatible con Obsidian
 * + secciones (SPEC §6). Puro.
 */

import type { ReportBlock, ReportModel } from './model';

function blockToMarkdown(block: ReportBlock): string {
	switch (block.kind) {
		case 'paragraph':
			return block.text;
		case 'list':
			return block.items.map((item) => `- ${item}`).join('\n');
		case 'fields':
			return block.fields.map((f) => `- **${f.label}**: ${f.value}`).join('\n');
	}
}

export function renderMarkdown(model: ReportModel): string {
	const frontmatter = model.frontmatter
		.map(([key, value]) => `${key}: ${value === null ? 'null' : value}`)
		.join('\n');

	const body = model.sections
		.map((section) => `## ${section.title}\n\n${section.blocks.map(blockToMarkdown).join('\n\n')}`)
		.join('\n\n');

	return `---\n${frontmatter}\n---\n\n# ${model.title}\n\n${body}\n`;
}

/** Nombre de fichero sugerido: informe-<id>-<fecha>.md */
export function reportFilename(routeId: string, date: string): string {
	return `informe-${routeId}-${date}.md`;
}

/** Texto plano legible en voz alta (SPECS_V3.5 §7): sin marcas ni casillas. */
export function reportSpeechText(model: ReportModel): string {
	const parts: string[] = [model.title];
	for (const section of model.sections) {
		parts.push(`${section.title}.`);
		for (const block of section.blocks) {
			if (block.kind === 'paragraph') parts.push(block.text);
			else if (block.kind === 'list') parts.push(block.items.join('. '));
			else if (block.kind === 'fields')
				parts.push(block.fields.map((f) => `${f.label}: ${f.value}`).join('. '));
		}
	}
	// Quita casillas/emojis que se leerían mal (sin clase de caracteres para no
	// mezclar emojis compuestos).
	let text = parts.join('. ');
	for (const ch of ['☐', '☑', '⚠️', '🔥', '💧', '📍', '🏅', '🔒', '🆘', '▶', '⏹', '☀', '🌙']) {
		text = text.split(ch).join('');
	}
	return text.replace(/\s{2,}/g, ' ').trim();
}
