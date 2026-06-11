<script lang="ts">
	import { axisTicks, type ProfilePoint } from '$lib/geo/profile';
	import { formatKm, formatMeters } from '$lib/format';

	let { points }: { points: ProfilePoint[] } = $props();

	const W = 600;
	const H = 200;
	const PAD_LEFT = 48;
	const PAD_RIGHT = 12;
	const PAD_TOP = 10;
	const PAD_BOTTOM = 26;

	let stats = $derived.by(() => {
		if (points.length < 2) return null;
		const eles = points.map((p) => p.ele);
		const minEle = Math.min(...eles);
		const maxEle = Math.max(...eles);
		const maxKm = points[points.length - 1].km;
		const eleSpan = maxEle - minEle || 1;
		const kmSpan = maxKm || 1;
		const x = (km: number) => PAD_LEFT + (km / kmSpan) * (W - PAD_LEFT - PAD_RIGHT);
		const y = (ele: number) =>
			H - PAD_BOTTOM - ((ele - minEle) / eleSpan) * (H - PAD_TOP - PAD_BOTTOM);
		const polyline = points.map((p) => `${x(p.km).toFixed(1)},${y(p.ele).toFixed(1)}`).join(' ');
		const eleTicks = axisTicks(minEle, maxEle, 4).map((ele) => ({ ele, y: y(ele) }));
		const kmTicks = axisTicks(0, maxKm, 5).map((km) => ({ km, x: x(km) }));
		return { minEle, maxEle, maxKm, polyline, eleTicks, kmTicks };
	});
</script>

{#if stats}
	<figure class="profile">
		<svg viewBox="0 0 {W} {H}" role="img" aria-label="Perfil de elevación">
			{#each stats.eleTicks as tick (tick.ele)}
				<line
					x1={PAD_LEFT}
					y1={tick.y}
					x2={W - PAD_RIGHT}
					y2={tick.y}
					stroke="#ddd9cd"
					stroke-dasharray="3 4"
				/>
				<text x={PAD_LEFT - 6} y={tick.y + 3} text-anchor="end" class="tick">
					{Math.round(tick.ele)} m
				</text>
			{/each}
			{#each stats.kmTicks as tick (tick.km)}
				<line
					x1={tick.x}
					y1={PAD_TOP}
					x2={tick.x}
					y2={H - PAD_BOTTOM}
					stroke="#ddd9cd"
					stroke-dasharray="3 4"
				/>
				<text x={tick.x} y={H - PAD_BOTTOM + 14} text-anchor="middle" class="tick">
					{tick.km} km
				</text>
			{/each}
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
	.tick {
		font-size: 10px;
		fill: #666;
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
