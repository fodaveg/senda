<!--
  Envoltorio de campo de formulario: etiqueta, control (slot), pista opcional y
  mensaje de error. Genera ids para enlazar label↔control y el error vía
  aria-describedby. El control hijo recibe `id` y `aria-invalid` por el snippet.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		/** Pista bajo el control (ayuda contextual). */
		hint?: string;
		/** Mensaje de error; si está presente, marca el campo como inválido. */
		error?: string;
		/** id del control; si se omite se genera uno. */
		id?: string;
		/** El control, que recibe { id, describedBy, invalid }. */
		control: Snippet<[{ id: string; describedBy: string | undefined; invalid: boolean }]>;
	}

	let { label, hint, error, id, control }: Props = $props();

	const fieldId = $derived(id ?? `field-${Math.random().toString(36).slice(2, 9)}`);
	const hintId = $derived(hint ? `${fieldId}-hint` : undefined);
	const errorId = $derived(error ? `${fieldId}-error` : undefined);
	const describedBy = $derived([hintId, errorId].filter(Boolean).join(' ') || undefined);
</script>

<div class="field" class:invalid={!!error}>
	<label for={fieldId}>{label}</label>
	{@render control({ id: fieldId, describedBy, invalid: !!error })}
	{#if hint && !error}<p class="hint" id={hintId}>{hint}</p>{/if}
	{#if error}<p class="error" id={errorId} role="alert">{error}</p>{/if}
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	label {
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--ink);
	}
	.hint {
		margin: 0;
		font-size: var(--text-xs);
		color: var(--muted);
	}
	.error {
		margin: 0;
		font-size: var(--text-xs);
		color: var(--danger);
		font-weight: 600;
	}
</style>
