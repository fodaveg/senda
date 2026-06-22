<script lang="ts">
	/**
	 * Indicador del estado de sincronización con la cuenta (SPECS_V4 §B2):
	 * sincronizado / sincronizando / pendiente / sin conexión. Solo tiene sentido
	 * con sesión iniciada; en modo local no se muestra.
	 */
	import type { Readable } from 'svelte/store';
	import type { RepoSyncStatus } from '$lib/user/sessionRepository';

	let { status }: { status: Readable<RepoSyncStatus> } = $props();

	const LABELS: Record<RepoSyncStatus, { icon: string; text: string }> = {
		local: { icon: '', text: '' },
		synced: { icon: '✓', text: 'Sincronizado' },
		syncing: { icon: '⟳', text: 'Sincronizando…' },
		pending: { icon: '•', text: 'Cambios sin subir' },
		offline: { icon: '⚠', text: 'Sin conexión' }
	};

	let info = $derived(LABELS[$status]);
</script>

{#if $status !== 'local'}
	<span class="sync" class:syncing={$status === 'syncing'} title={info.text} aria-live="polite">
		<span class="icon" aria-hidden="true">{info.icon}</span>
		<span class="text">{info.text}</span>
	</span>
{/if}

<style>
	.sync {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.8rem;
		color: #cfe3d6;
	}
	.icon {
		font-size: 0.9rem;
	}
	.syncing .icon {
		display: inline-block;
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (max-width: 30rem) {
		.text {
			display: none;
		}
	}
</style>
