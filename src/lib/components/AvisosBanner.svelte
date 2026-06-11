<script lang="ts">
	import type { Aviso } from '$lib/weather/avisos';

	let { avisos }: { avisos: Aviso[] } = $props();

	function hourOf(iso: string): string {
		return iso.slice(11, 16) || '00:00';
	}
</script>

{#if avisos.length > 0}
	<div class="avisos" role="alert">
		<strong>Avisos meteorológicos oficiales (AEMET)</strong>
		<ul>
			{#each avisos as aviso (aviso.event + aviso.areaDesc + aviso.onset)}
				<li class={aviso.level}>
					<span class="level">{aviso.level}</span>
					<strong>{aviso.event}</strong> — {aviso.areaDesc} · de {hourOf(aviso.onset)} a
					{hourOf(aviso.expires)}
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.avisos {
		border: 1px solid #b3261e;
		background: #fdecea;
		border-radius: 6px;
		padding: 0.6rem 0.9rem;
		margin-bottom: 0.75rem;
		font-size: 0.9rem;
	}
	ul {
		margin: 0.4rem 0 0;
		padding-left: 1.2rem;
	}
	.level {
		display: inline-block;
		text-transform: uppercase;
		font-weight: 700;
		font-size: 0.7rem;
		padding: 0.05rem 0.4rem;
		border-radius: 999px;
		margin-right: 0.3rem;
		color: #fff;
	}
	.amarillo .level {
		background: #b8860b;
	}
	.naranja .level {
		background: #d2691e;
	}
	.rojo .level {
		background: #b3261e;
	}
</style>
