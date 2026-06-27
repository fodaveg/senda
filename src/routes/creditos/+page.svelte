<script lang="ts">
	/**
	 * Créditos y licencias de las fuentes de datos (PRE-B legal). Atribución
	 * consolidada de los proveedores cuyos datos usa o muestra la app: senderos
	 * (FEMECV), cartografía (IGN), datos colaborativos (OpenStreetMap), meteo
	 * (Open-Meteo/AEMET) y rutas por carretera (OSRM). El mapa ya muestra además la
	 * atribución del IGN/PNOA en su propio control. No sustituye a una política de
	 * privacidad ni a las condiciones de uso (pendientes antes de publicar).
	 */
</script>

<svelte:head><title>Créditos y licencias · Senda</title></svelte:head>

<h1>Créditos y licencias</h1>
<p class="lead">
	Senda combina datos de varias fuentes públicas. Aquí se reconoce a cada proveedor y la licencia
	bajo la que se usan sus datos. Los datos no verificados se marcan como tales y nunca sustituyen al
	dato oficial.
</p>

<section class="credits">
	<article>
		<h2>Senderos homologados</h2>
		<p>
			Recorridos, homologación y datos técnicos: <strong
				>Federació d'Esports de Muntanya i Escalada de la Comunitat Valenciana (FEMECV)</strong
			>. Cada ficha enlaza a su fuente oficial.
		</p>
		<p class="src">
			<a href="https://femecv.com" target="_blank" rel="noopener noreferrer">femecv.com</a>
		</p>
	</article>

	<article>
		<h2>Cartografía base</h2>
		<p>
			Mapas topográfico, callejero y relieve: <strong
				>© Instituto Geográfico Nacional de España (IGN)</strong
			>, bajo licencia <strong>CC BY 4.0</strong>. La capa de satélite usa las ortofotos del
			<strong>Plan Nacional de Ortofotografía Aérea (PNOA)</strong> © IGN. El mapa muestra esta atribución
			en su propio control.
		</p>
		<p class="src">
			<a href="https://www.ign.es" target="_blank" rel="noopener noreferrer">ign.es</a>
		</p>
	</article>

	<article>
		<h2>Puntos de interés, agua y rutas por carretera</h2>
		<p>
			Fuentes de agua, miradores, cumbres y demás puntos de interés, y el cálculo de "cómo llegar"
			en coche: datos de <strong>© colaboradores de OpenStreetMap</strong>, bajo licencia
			<strong>ODbL</strong>. Estos datos se muestran etiquetados como «OSM, sin verificar»: son
			orientativos y no sustituyen a la señalización oficial.
		</p>
		<p class="src">
			<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
				openstreetmap.org/copyright
			</a>
			· Rutas por carretera vía
			<a href="https://project-osrm.org" target="_blank" rel="noopener noreferrer">OSRM</a>
		</p>
	</article>

	<article>
		<h2>Meteorología</h2>
		<p>
			Predicción meteorológica: <strong>Open-Meteo</strong> (CC BY 4.0) por defecto. Si configuras
			tu clave de AEMET en Ajustes, se usan además los datos de la
			<strong>Agencia Estatal de Meteorología (© AEMET)</strong>, incluidos los avisos. La meteo es
			orientativa; ante discrepancias, prevalece el aviso oficial de AEMET.
		</p>
		<p class="src">
			<a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">open-meteo.com</a>
			·
			<a href="https://www.aemet.es" target="_blank" rel="noopener noreferrer">aemet.es</a>
		</p>
	</article>

	<article>
		<h2>Enlaces externos</h2>
		<p>
			Senda enlaza a <strong>Wikiloc</strong> para buscar cada ruta, pero
			<strong>no usa ni almacena datos de Wikiloc</strong>: son únicamente enlaces de búsqueda
			salientes.
		</p>
	</article>
</section>

<p class="note">
	¿Falta una atribución o hay un error en una licencia? Es importante: indícalo para corregirlo
	antes de publicar.
</p>

<style>
	.lead {
		color: var(--muted-strong);
		max-width: 42rem;
	}
	.credits {
		display: grid;
		gap: 1rem;
		max-width: 42rem;
	}
	article {
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 0.75rem 1rem;
		background: var(--surface);
	}
	h2 {
		font-size: 1.05rem;
		margin: 0 0 0.4rem;
	}
	article p {
		margin: 0 0 0.4rem;
	}
	.src {
		font-size: 0.85rem;
		color: var(--muted);
	}
	.note {
		max-width: 42rem;
		color: var(--muted);
		font-size: 0.9rem;
	}
</style>
