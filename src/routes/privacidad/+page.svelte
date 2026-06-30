<script lang="ts">
	/**
	 * Política de privacidad y almacenamiento (PRE-B legal). Describe en lenguaje
	 * claro qué datos maneja la app, dónde viven y qué se envía a terceros. La app
	 * es local-first: por defecto todo vive en el dispositivo (localStorage); la
	 * cuenta, la sincronización y la analítica son OPCIONALES y opt-in.
	 *
	 * Refleja el comportamiento real del código (marcas/diario/material/ajustes en
	 * localStorage; Supabase solo con cuenta; analítica anónima opt-in; meteo/router
	 * reciben coordenadas; cartografía IGN sirve teselas). No es asesoramiento legal:
	 * revisar y adaptar (responsable, base jurídica) antes de publicar.
	 */
	import { resolve } from '$app/paths';
	const updated = '2026-06-30';
</script>

<svelte:head><title>Privacidad · Senda</title></svelte:head>

<h1>Privacidad y almacenamiento</h1>
<p class="lead">
	Senda funciona <strong>en tu dispositivo</strong>. Por defecto, tus datos no salen del navegador:
	se guardan en el almacenamiento local y solo tú los ves. La cuenta, la sincronización y la
	analítica son <strong>opcionales</strong> y solo se activan si tú lo decides.
</p>
<p class="note">Última actualización: {updated}.</p>

<section class="blocks">
	<article>
		<h2>Qué se guarda en tu dispositivo</h2>
		<p>
			Tus marcas (favoritas, «quiero hacerla»), el <strong>diario de salidas</strong>, la lista de
			la mochila, tu <strong>material propio</strong> y tus ajustes (tema, origen habitual, clave de
			AEMET si la introduces) se guardan en el <strong>almacenamiento local</strong> del navegador (<span
				class="mono">localStorage</span
			>). No se envían a ningún servidor salvo que actives la cuenta.
		</p>
		<p class="src">Puedes exportarlos e importarlos como copia de seguridad desde el Diario.</p>
	</article>

	<article>
		<h2>Cookies y rastreo</h2>
		<p>
			Senda <strong>no usa cookies de publicidad ni de seguimiento</strong>, ni perfila tu
			navegación. Solo emplea almacenamiento local técnico (preferencias y tus datos) necesario para
			que la app funcione sin conexión.
		</p>
	</article>

	<article>
		<h2>Cuenta (opcional)</h2>
		<p>
			Si creas una cuenta para sincronizar tus datos entre dispositivos, se procesan tu
			<strong>correo electrónico</strong> y una contraseña (gestionados por nuestro proveedor de
			backend, <strong>Supabase</strong>, en servidores de la <strong>Unión Europea</strong>), y se
			sincronizan los datos de usuario anteriores cifrados en tránsito. Puedes
			<strong>exportar</strong> tus datos y <strong>borrar tu cuenta</strong> (y los datos asociados)
			en cualquier momento desde Ajustes.
		</p>
	</article>

	<article>
		<h2>Datos de emergencia (opcional)</h2>
		<p>
			Si rellenas la ficha de emergencia (contactos, datos médicos), se guarda en tu dispositivo —y
			en tu cuenta si la usas— y <strong>no se comparte con nadie</strong>. Su único fin es estar
			disponible para ti.
		</p>
	</article>

	<article>
		<h2>Analítica anónima (opt-in)</h2>
		<p>
			La analítica está <strong>desactivada por defecto</strong>. Si la activas en Ajustes, se
			envían eventos <strong>anónimos y agregados</strong> (con k-anonimato) sobre rutas y material populares,
			sin información que te identifique. Sirven para las vistas de Tendencias. Puedes desactivarla cuando
			quieras.
		</p>
	</article>

	<article>
		<h2>Servicios externos que se contactan</h2>
		<p>
			Cuando usas funciones online, la app contacta con estos servicios (degrada con elegancia si
			fallan):
		</p>
		<ul>
			<li>
				<strong>IGN</strong> (cartografía): peticiones de teselas del mapa según la zona que ves.
			</li>
			<li>
				<strong>Open-Meteo</strong> y, si introduces tu clave, <strong>AEMET</strong> (meteo):
				reciben las <strong>coordenadas de la ruta</strong> para el pronóstico.
			</li>
			<li>
				<strong>OSRM</strong> (rutas por carretera): al estimar el viaje en coche recibe el
				<strong>origen que configuras</strong> y el destino. Tu ubicación no se guarda ni se envía salvo
				para ese cálculo.
			</li>
			<li><strong>Supabase</strong>: solo si usas cuenta (ver arriba).</li>
		</ul>
		<p class="src">
			La procedencia de los datos que se muestran está detallada en <a href={resolve('/creditos')}
				>Créditos y licencias</a
			>.
		</p>
	</article>

	<article>
		<h2>Tus derechos</h2>
		<p>
			Puedes <strong>acceder</strong> y <strong>portar</strong> tus datos (exportación),
			<strong>rectificarlos</strong> (editándolos en la app) y <strong>suprimirlos</strong>
			(borrando los datos locales o tu cuenta). Para cualquier consulta sobre privacidad, escribe a
			<a href="mailto:fodaveg@fodaveg.net">fodaveg@fodaveg.net</a>.
		</p>
	</article>
</section>

<p class="note">
	Este texto describe el funcionamiento real de la app en lenguaje claro y no constituye
	asesoramiento legal. Responsable del tratamiento: <strong>fodaveg</strong>
	(<a href="https://fodaveg.net" target="_blank" rel="noopener noreferrer">fodaveg.net</a>).
</p>

<style>
	.lead {
		color: var(--muted-strong);
		max-width: 42rem;
	}
	.blocks {
		display: grid;
		gap: 1rem;
		max-width: 42rem;
	}
	article {
		border: 1px solid var(--border);
		border-radius: var(--radius-lg, 8px);
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
	article ul {
		margin: 0.2rem 0 0.4rem;
		padding-left: 1.2rem;
		display: grid;
		gap: 0.3rem;
	}
	.mono {
		font-family: ui-monospace, monospace;
		font-size: 0.9em;
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
