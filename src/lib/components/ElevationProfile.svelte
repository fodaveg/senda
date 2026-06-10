<script lang="ts">
	import type { ProfilePoint } from '$lib/geo/profile';
	import { formatKm, formatMeters } from '$lib/format';

	let { points }: { points: ProfilePoint[] } = $props();

	const W = 600;
	const H = 180;
	const PAD = 10;

	let stats = $derived.by(() => {
		if (points.length < 2) return null;
		const eles = points.map((p) => p.ele);
		const minEle = Math.min(...eles);
		const maxEle = Math.max(...eles);
		const maxKm = points[points.length - 1].km;
		const eleSpan = maxEle - minEle || 1;
		const kmSpan = maxKm || 1;
		const polyline = points
			.map((p) => {
				const x = PAD + (p.km / kmSpan) * (W - 2 * PAD);
				const y = H - PAD - ((p.ele - minEle) / eleSpan) * (H - 2 * PAD);
				return `${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
		return { minEle, maxEle, maxKm, polyline };
	});
</script>

{#if stats}
	<figure class="profile">
		<svg viewBox="0 0 {W} {H}" role="img" aria-label="Perfil de elevación">
			<polyline points={stats.polyline} fill="none" stroke="#2a6f4e" stroke-width="2.5" />
		</svg>
		<figcaption>
			{formatKm(stats.maxKm)} · elevación {formatMeters(stats.minEle)} – {formatMeters(
				stats.maxEle
			)}
		</figcaption>
	</figure>
{:else}
	<p class="no-data">El track no incluye datos de elevación.</p>
{/if}

<style>
	.profile {
		margin: 0;
	}
	svg {
		width: 100%;
		height: auto;
		background: #f4f2ec;
		border: 1px solid #d8d4c8;
		border-radius: 4px;
	}
	figcaption {
		font-size: 0.85rem;
		color: #444;
		margin-top: 0.25rem;
	}
	.no-data {
		color: #555;
	}
</style>
