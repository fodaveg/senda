<!--
  Campo de texto/número del sistema. Bindable `value`. Pensado para usarse dentro
  de Field (que le pasa id/describedBy/invalid), pero funciona suelto.
-->
<script lang="ts">
	interface Props {
		value: string | number;
		type?: 'text' | 'number' | 'email' | 'password' | 'search' | 'tel';
		id?: string;
		placeholder?: string;
		disabled?: boolean;
		invalid?: boolean;
		describedBy?: string;
		min?: number;
		max?: number;
		step?: number;
		'aria-label'?: string;
		oninput?: (e: Event) => void;
		onchange?: (e: Event) => void;
	}

	let {
		value = $bindable(),
		type = 'text',
		id,
		placeholder,
		disabled = false,
		invalid = false,
		describedBy,
		min,
		max,
		step,
		'aria-label': ariaLabel,
		oninput,
		onchange
	}: Props = $props();
</script>

<input
	class="input"
	{id}
	{type}
	{placeholder}
	{disabled}
	{min}
	{max}
	{step}
	aria-invalid={invalid || undefined}
	aria-describedby={describedBy}
	aria-label={ariaLabel}
	bind:value
	{oninput}
	{onchange}
/>

<style>
	.input {
		font-family: var(--font-body);
		font-size: var(--text-base);
		color: var(--ink);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: 0 var(--space-3);
		min-height: var(--touch-min);
		width: 100%;
	}
	.input::placeholder {
		color: var(--muted);
	}
	.input:hover:not(:disabled) {
		border-color: var(--brand-line);
	}
	.input[aria-invalid='true'] {
		border-color: var(--danger);
	}
	.input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
