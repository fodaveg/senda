<!--
  Galería del sistema de diseño v6 (entregable A del handoff). Página interna de
  referencia: muestra los componentes base con sus estados, para validar el
  aspecto en los 9 esquemas y la escala de texto. No enlazada desde la cabecera.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		Badge,
		Banner,
		Button,
		Card,
		Checkbox,
		Chip,
		EmptyState,
		Field,
		Section,
		Select,
		Skeleton,
		Tabs,
		TextInput,
		Toggle,
		TypeBadge
	} from '$lib/components/ui';

	let text = $state('');
	let num = $state(2);
	let sel = $state('cercania');
	let toggleOn = $state(true);
	let checkOn = $state(false);
	let tab = $state('resumen');
	let withError = $state(false);

	const tabs = [
		{ id: 'resumen', label: 'Resumen', icon: '📋' },
		{ id: 'mapa', label: 'Mapa y perfil', icon: '🗺️' },
		{ id: 'prep', label: 'Preparación', icon: '🎒' },
		{ id: 'seg', label: 'Condiciones y seguridad', icon: '⚠️' }
	];
</script>

<svelte:head><title>Sistema de diseño · Senda</title></svelte:head>

<div class="gallery">
	<h1>Sistema de diseño</h1>
	<p class="lead">
		Referencia interna de los componentes base de la v6. Cambia tema, esquema y escala de texto en
		<a href={resolve('/ajustes')}>Ajustes</a> para verlos en cualquier combinación.
	</p>

	<Section title="Botones" subtitle="Primario · secundario · fantasma · peligro">
		<div class="row">
			<Button>Primario</Button>
			<Button variant="secondary">Secundario</Button>
			<Button variant="ghost">Fantasma</Button>
			<Button variant="danger">Peligro</Button>
		</div>
		<div class="row">
			<Button loading>Cargando</Button>
			<Button disabled>Deshabilitado</Button>
			<Button size="sm">Pequeño</Button>
			<Button href="/">Enlace</Button>
		</div>
	</Section>

	<Section title="Badges">
		<div class="row">
			<TypeBadge type="GR" />
			<TypeBadge type="PR" />
			<TypeBadge type="SL" />
			<Badge tone="ok">Homologada</Badge>
			<Badge tone="warn">Con reservas</Badge>
			<Badge tone="danger">Deshabilitada</Badge>
			<Badge tone="neutral">Sin verificar</Badge>
			<Badge tone="brand">FEMECV oficial</Badge>
		</div>
	</Section>

	<Section title="Chips de filtro">
		<div class="row">
			<Chip label="Provincia: Valencia" onRemove={() => {}}>Valencia</Chip>
			<Chip label="Circular" onRemove={() => {}}>Circular</Chip>
			<Chip>Estático</Chip>
		</div>
	</Section>

	<Section title="Campos de formulario">
		<div class="form-grid">
			<Field label="Buscar ruta" hint="Por nombre o municipio">
				{#snippet control({ id, describedBy })}
					<TextInput bind:value={text} {id} {describedBy} type="search" placeholder="Montgó…" />
				{/snippet}
			</Field>
			<Field label="Peso de la mochila (kg)">
				{#snippet control({ id, describedBy })}
					<TextInput bind:value={num} {id} {describedBy} type="number" min={0} max={30} />
				{/snippet}
			</Field>
			<Field label="Ordenar por">
				{#snippet control({ id, describedBy })}
					<Select bind:value={sel} {id} {describedBy}>
						<option value="cercania">Cercanía</option>
						<option value="nombre">Nombre</option>
						<option value="desnivel">Desnivel</option>
					</Select>
				{/snippet}
			</Field>
			<Field label="Campo con error" error={withError ? 'Este campo es obligatorio' : undefined}>
				{#snippet control({ id, describedBy, invalid })}
					<TextInput bind:value={text} {id} {describedBy} {invalid} />
				{/snippet}
			</Field>
		</div>
		<div class="row">
			<Toggle bind:checked={toggleOn}>Solo con agua</Toggle>
			<Checkbox bind:checked={checkOn}>Acepto</Checkbox>
			<Checkbox bind:checked={withError}>Mostrar error</Checkbox>
		</div>
	</Section>

	<Section title="Navegación por secciones">
		<Tabs {tabs} active={tab} onChange={(id) => (tab = id)} aria-label="Demo de pestañas" />
		<p class="muted">Activa: {tabs.find((t) => t.id === tab)?.label}</p>
		<Tabs {tabs} active={tab} variant="underline" onChange={(id) => (tab = id)} idBase="demo2" />
	</Section>

	<Section title="Avisos / banners">
		<div class="stack">
			<Banner tone="info" icon="ℹ️" title="Información"
				>Predicción descargada para uso offline.</Banner
			>
			<Banner tone="ok" icon="✅" title="Adelante">Buenas condiciones para hoy.</Banner>
			<Banner tone="warn" icon="⚠️" title="Precaución">Viento fuerte por la tarde.</Banner>
			<Banner tone="alert" icon="🔴" role="alert" title="Aviso AEMET">
				Aviso naranja por tormentas (vigente hasta las 20:00).
			</Banner>
		</div>
	</Section>

	<Section title="Estado vacío y carga">
		<div class="two">
			<Card>
				<EmptyState
					icon="🔍"
					title="Sin resultados"
					description="No hay rutas con esos filtros. Prueba a quitar alguno."
				>
					{#snippet action()}
						<Button variant="secondary" size="sm">Quitar filtros</Button>
					{/snippet}
				</EmptyState>
			</Card>
			<Card>
				<div class="stack">
					<Skeleton shape="block" height="80px" />
					<Skeleton width="70%" />
					<Skeleton width="50%" />
				</div>
			</Card>
		</div>
	</Section>
</div>

<style>
	.gallery {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		max-width: var(--container-wide);
		margin: 0 auto;
	}
	h1 {
		font-size: var(--text-2xl);
		margin: 0;
	}
	.lead {
		margin: 0;
		color: var(--muted);
		max-width: var(--container-read);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: center;
		margin-bottom: var(--space-3);
	}
	.row:last-child {
		margin-bottom: 0;
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.form-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: var(--space-4);
		margin-bottom: var(--space-4);
	}
	.two {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: var(--space-4);
	}
	.muted {
		color: var(--muted);
		font-size: var(--text-sm);
	}
</style>
