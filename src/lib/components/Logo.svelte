<script lang="ts">
	/**
	 * Lockup de marca de Senda (handoff v6): el isotipo es una **senda en zigzag**
	 * que asciende a un punto de cumbre, centrada y llenando un badge redondeado,
	 * junto al **wordmark «Senda» en Spectral 700** (serif, interletraje −2%).
	 *
	 * Dos variantes de color:
	 * - `brand` (defecto): para superficies neutras. Badge `--brand`, isotipo
	 *   `--on-brand`, wordmark `--brand` → el contraste se resuelve solo en claro
	 *   y oscuro.
	 * - `on-brand`: para superficies de marca/oscuras (p. ej. la barra superior,
	 *   que es verde oscuro con texto blanco en ambos temas). Badge translúcido,
	 *   isotipo y wordmark blancos.
	 *
	 * `size` es el lado del badge en px; el trazo llena el badge (≈0.83×) como en
	 * la hoja de marca. A tamaño pequeño el punto de cumbre toma el color del
	 * trazo (no el acento), por legibilidad.
	 */
	let {
		size = 30,
		variant = 'brand',
		wordmark = true,
		label = 'Senda'
	}: {
		size?: number;
		variant?: 'brand' | 'on-brand';
		wordmark?: boolean;
		label?: string;
	} = $props();

	const trail = $derived(Math.round(size * 0.83));
	const radius = $derived(Math.max(6, Math.round(size * 0.26)));
</script>

<span
	class="logo"
	class:on-brand={variant === 'on-brand'}
	style="--logo-badge:{size}px; --logo-radius:{radius}px"
>
	<span class="badge">
		<svg
			width={trail}
			height={trail}
			viewBox="0 0 92 92"
			fill="none"
			role={wordmark ? 'presentation' : 'img'}
			aria-label={wordmark ? undefined : label}
		>
			<polyline
				points="20 78 70 68 24 57 68 46 26 35 64 25 46 13"
				fill="none"
				stroke="var(--logo-ink)"
				stroke-width="9"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<circle cx="46" cy="13" r="8.5" fill="var(--logo-ink)" />
		</svg>
	</span>
	{#if wordmark}<span class="wordmark">{label}</span>{/if}
</span>

<style>
	.logo {
		display: inline-flex;
		align-items: center;
		gap: 0.42em;
		line-height: 1;
		/* Variante por defecto: superficie neutra. */
		--logo-bg: var(--brand);
		--logo-ink: var(--on-brand);
		--logo-word: var(--brand);
	}
	.logo.on-brand {
		--logo-bg: rgba(255, 255, 255, 0.14);
		--logo-ink: #fff;
		--logo-word: #fff;
	}
	.badge {
		width: var(--logo-badge);
		height: var(--logo-badge);
		border-radius: var(--logo-radius);
		background: var(--logo-bg);
		display: flex;
		align-items: center;
		justify-content: center;
		flex: none;
		box-shadow: var(--shadow-sm, 0 1px 2px rgba(40, 38, 30, 0.1));
	}
	.wordmark {
		font-family: var(--font-brand);
		font-weight: 700;
		font-size: calc(var(--logo-badge) * 0.72);
		letter-spacing: -0.02em;
		color: var(--logo-word);
	}
</style>
