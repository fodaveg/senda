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
