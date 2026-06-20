<script lang="ts">
	/**
	 * Riesgo de incendio forestal (AEMET) en la ficha. Muestra el mapa oficial
	 * del día y explica los niveles + precauciones/limitaciones, para que el
	 * usuario localice su zona y juzgue. AEMET solo da el mapa regional, no un
	 * nivel por ruta (ver weather/fireRisk.ts): no se afirma un nivel concreto.
	 */
	let {
		imageUrl = null,
		loading = false,
		dayLabel = null
	}: {
		imageUrl?: string | null;
		loading?: boolean;
		dayLabel?: string | null;
	} = $props();
</script>

{#if loading || imageUrl}
	<section class="fire-risk">
		<h3>
			🔥 Riesgo de incendio forestal {#if dayLabel}<span class="day">· {dayLabel}</span>{/if}
		</h3>
		{#if loading}
			<p class="muted">Consultando el mapa de riesgo de AEMET…</p>
		{:else if imageUrl}
			<img src={imageUrl} alt="Mapa de niveles de riesgo de incendio forestal de AEMET" />
			<p class="caption">
				Localiza la <strong>Comunitat Valenciana</strong> en el mapa. AEMET publica el riesgo por zona
				peninsular, no por ruta.
			</p>
			<ul class="levels">
				<li><span class="lv lv-bajo"></span> Bajo / moderado: precaución normal.</li>
				<li><span class="lv lv-alto"></span> Alto: extrema la prudencia; nada de fuego.</li>
				<li>
					<span class="lv lv-muyalto"></span> Muy alto / extremo:
					<strong>se recomienda encarecidamente no hacer la ruta ese día.</strong>
				</li>
			</ul>
			<p class="note">
				En días de riesgo muy alto/extremo suele activarse el <strong
					>nivel 3 de preemergencia</strong
				>
				en la Comunitat Valenciana: <strong>acceso restringido a zonas forestales</strong> y
				<strong>prohibido hacer fuego</strong>. Combínalo con el aviso de calor de AEMET (si lo hay,
				arriba): calor + riesgo extremo = mejor posponer.
			</p>
			<p class="source">Fuente: AEMET (mapa de riesgo meteorológico de incendios).</p>
		{/if}
	</section>
{/if}

<style>
	.fire-risk {
		border: 1px solid var(--alert-border);
		border-radius: 6px;
		padding: 0.6rem 0.9rem;
		margin: 0.5rem 0 1rem;
		background: var(--surface);
	}
	h3 {
		margin: 0 0 0.5rem;
	}
	.day {
		font-weight: 400;
		color: var(--muted);
		font-size: 0.85rem;
	}
	img {
		display: block;
		max-width: 100%;
		height: auto;
		border-radius: 4px;
		border: 1px solid var(--border);
	}
	.caption,
	.note,
	.source {
		font-size: 0.85rem;
		margin: 0.4rem 0 0;
	}
	.caption {
		color: var(--muted-strong);
	}
	.note {
		color: var(--alert-ink);
	}
	.source {
		color: var(--muted);
		font-size: 0.78rem;
	}
	.levels {
		list-style: none;
		padding: 0;
		margin: 0.5rem 0 0;
		display: grid;
		gap: 0.25rem;
		font-size: 0.85rem;
	}
	.lv {
		display: inline-block;
		width: 0.8rem;
		height: 0.8rem;
		border-radius: 2px;
		margin-right: 0.35rem;
		vertical-align: middle;
	}
	.lv-bajo {
		background: #2e9e4f;
	}
	.lv-alto {
		background: #e8a33d;
	}
	.lv-muyalto {
		background: #c1121f;
	}
</style>
