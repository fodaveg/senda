<!--
  Guarda de funcionalidad (multi-federación V5-1). Se muestra en un bloque de la
  ficha cuando la fuente oficial de la ruta NO publica ese dato (capability en
  `false`), en vez de ocultarlo en silencio o inventarlo. Deja claro que es una
  limitación de la fuente, no un fallo de la app.
-->
<script lang="ts">
	interface Props {
		/** Nombre de la federación/fuente (p. ej. "FNDME"). */
		federacion: string;
		/** Qué no se puede mostrar/calcular (p. ej. "la valoración MIDE"). */
		feature: string;
	}

	let { federacion, feature }: Props = $props();
</script>

<p class="guard" role="note">
	<span class="ic" aria-hidden="true">🔒</span>
	<span
		><strong>{federacion}</strong> no publica {feature} para esta ruta, así que no se puede mostrar.</span
	>
</p>

<style>
	.guard {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		margin: var(--space-2) 0 0;
		padding: var(--space-3);
		border: 1px dashed var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-alt);
		color: var(--muted);
		font-size: var(--text-sm);
	}
	.ic {
		flex-shrink: 0;
	}
</style>
