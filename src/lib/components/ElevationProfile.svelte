<script lang="ts">
	import { axisTicks, type ProfilePoint } from '$lib/geo/profile';
	import { formatKm, formatMeters } from '$lib/format';

	let {
		points,
		onHover = null
	}: {
		points: ProfilePoint[];
		/** Índice del punto bajo el cursor, o null al salir (SPECS_V2 §13). */
		onHover?: ((index: number | null) => void) | null;
	} = $props();

	let hoverIndex = $state<number | null>(null);

	function indexAtClientX(svg: SVGSVGElement, clientX: number): number | null {
		if (!stats || points.length === 0) return null;
		const rect = svg.getBoundingClientRect();
		const km = (((clientX - rect.left) / rect.width) * W - PAD_LEFT) / (W - PAD_LEFT - PAD_RIGHT);
		const targetKm = km * (stats.maxKm || 1);
		let best = 0;
		let bestDelta = Infinity;
		for (let i = 0; i < points.length; i++) {
			const delta = Math.abs(points[i].km - targetKm);
			if (delta < bestDelta) {
				bestDelta = delta;
				best = i;
			}
		}
		return best;
	}

	function handleMove(event: MouseEvent) {
		const index = indexAtClientX(event.currentTarget as SVGSVGElement, event.clientX);
		hoverIndex = index;
		onHover?.(index);
	}

	function handleLeave() {
		hoverIndex = null;
		onHover?.(null);
	}

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
		// Relleno bicolor (SPECS_V3 §8): terreno bajo la curva, cielo por encima.
		// Se cierra el polígono de la curva contra la base y contra el techo del
		// área de dibujo respectivamente.
		const topY = PAD_TOP;
		const bottomY = H - PAD_BOTTOM;
		const firstX = x(0);
		const lastX = x(maxKm);
		const areaBelow = `${polyline} ${lastX.toFixed(1)},${bottomY} ${firstX.toFixed(1)},${bottomY}`;
		const areaAbove = `${firstX.toFixed(1)},${topY} ${polyline} ${lastX.toFixed(1)},${topY}`;
		const eleTicks = axisTicks(minEle, maxEle, 4).map((ele) => ({ ele, y: y(ele) }));
		const kmTicks = axisTicks(0, maxKm, 5).map((km) => ({ km, x: x(km) }));
		return { minEle, maxEle, maxKm, polyline, areaBelow, areaAbove, eleTicks, kmTicks };
	});
</script>

{#if stats}
	<figure class="profile">
		<svg
			viewBox="0 0 {W} {H}"
			role="img"
			aria-label="Perfil de elevación"
			onmousemove={handleMove}
			onmouseleave={handleLeave}
		>
			<polygon points={stats.areaAbove} class="area-above" />
			<polygon points={stats.areaBelow} class="area-below" />
			{#each stats.eleTicks as tick (tick.ele)}
				<line
					x1={PAD_LEFT}
					y1={tick.y}
					x2={W - PAD_RIGHT}
					y2={tick.y}
					stroke="var(--border)"
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
					stroke="var(--border)"
					stroke-dasharray="3 4"
				/>
				<text x={tick.x} y={H - PAD_BOTTOM + 14} text-anchor="middle" class="tick">
					{tick.km} km
				</text>
			{/each}
			<polyline points={stats.polyline} fill="none" stroke="#2a6f4e" stroke-width="2.5" />
			{#if hoverIndex !== null && points[hoverIndex]}
				{@const hp = points[hoverIndex]}
				{@const hx = PAD_LEFT + (hp.km / (stats.maxKm || 1)) * (W - PAD_LEFT - PAD_RIGHT)}
				{@const hy =
					H -
					PAD_BOTTOM -
					((hp.ele - stats.minEle) / (stats.maxEle - stats.minEle || 1)) *
						(H - PAD_TOP - PAD_BOTTOM)}
				<line x1={hx} y1={PAD_TOP} x2={hx} y2={H - PAD_BOTTOM} stroke="#1d3a2a" stroke-width="1" />
				<circle cx={hx} cy={hy} r="4" fill="#1d3a2a" stroke="#fff" stroke-width="1.5" />
				{@const label = `km ${hp.km.toFixed(1)} · ${Math.round(hp.ele)} m`}
				{@const boxW = label.length * 6.4 + 14}
				{@const boxX = Math.min(Math.max(hx - boxW / 2, PAD_LEFT), W - PAD_RIGHT - boxW)}
				<!-- Tooltip con contraste fijo (caja oscura + texto claro): legible
				     sobre cualquier capa/tema, no depende del fondo (SPECS_V3 §8). -->
				<rect x={boxX} y={PAD_TOP} width={boxW} height="18" rx="4" class="tooltip-box" />
				<text
					x={boxX + boxW / 2}
					y={PAD_TOP + 13}
					text-anchor="middle"
					class="tooltip-text"
					data-testid="profile-tooltip"
				>
					{label}
				</text>
			{/if}
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
		background: var(--surface-alt);
		border: 1px solid var(--border);
		border-radius: 4px;
	}
	.area-below {
		/* terreno bajo la curva */
		fill: rgba(42, 111, 78, 0.22);
	}
	.area-above {
		/* cielo por encima de la curva */
		fill: rgba(120, 160, 205, 0.16);
	}
	.tooltip-box {
		fill: #1d3a2a;
		opacity: 0.95;
	}
	.tooltip-text {
		font-size: 11px;
		fill: #ffffff;
		font-weight: 600;
	}
	.tick {
		font-size: 10px;
		fill: var(--muted);
	}
	figcaption {
		font-size: 0.85rem;
		color: var(--muted-strong);
		margin-top: 0.25rem;
	}
	.no-data {
		color: var(--muted);
	}
</style>
