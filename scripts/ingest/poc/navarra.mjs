/**
 * PoC de ingesta multi-federación — NAVARRA (SPECS_V5_FEDERACIONES.md).
 *
 * Valida el modelo acordado para las CCAA distintas de la Comunitat Valenciana:
 *   - **Capa federación (existencia + estado + metadatos)**: MiSendaFEDME, el
 *     buscador nacional de la FEDME al que **delega la federación navarra (FNDME,
 *     senderos.nafarmendi.org)**. Endpoint JSON real:
 *       POST /buscador-de-senderos/inc/buscar_etapas_mapa.php  (ccaa=nc)
 *     Devuelve las etapas EN VIGOR (homologadas) de Navarra con matrícula, tipo,
 *     permalink, id y fichero GPX (`arxiu`).
 *   - **Gate de existencia / estado**: solo se publican rutas presentes aquí; las
 *     deshabilitadas/de baja simplemente no aparecen (la federación es la
 *     autoridad). MiSendaFEDME no expone un campo "estado" explícito ⇒ presencia
 *     ≈ "homologado / en vigor".
 *   - **Geometría**: en producción debe venir del **CNIG (CC-BY)** unida por
 *     matrícula+nombre; en esta PoC se usa el GPX de MiSendaFEDME para demostrar
 *     que la geometría se parsea (longitud/bbox). [licencia a confirmar].
 *   - **Matriz de capacidades**: qué metadatos expone la ficha de la federación,
 *     para decidir por bloque de la v6 entre mostrar / overlay
 *     "(FNDME) no expone públicamente datos para esta funcionalidad" / sin dato.
 *
 * No toca el runtime ni el catálogo. Salida: scripts/ingest/poc/navarra-report.json
 * Uso:  node scripts/ingest/poc/navarra.mjs
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const UA = 'senda-poc-navarra/0.1 (proyecto personal; contacto: fodaveg@fodaveg.net)';
const BASE = 'https://misendafedme.es/buscador-de-senderos';
const FILES = 'https://misendafedme.es';
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'navarra-report.json');

/** Espera ms (cortesía entre peticiones). */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET con User-Agent identificado. */
async function get(url, asText = true) {
	const res = await fetch(url, { headers: { 'User-Agent': UA } });
	if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
	return asText ? res.text() : res.arrayBuffer();
}

/** Catálogo de etapas EN VIGOR de Navarra (capa federación). */
async function fetchNavarraCatalog() {
	const res = await fetch(`${BASE}/inc/buscar_etapas_mapa.php`, {
		method: 'POST',
		headers: {
			'User-Agent': UA,
			'X-Requested-With': 'XMLHttpRequest',
			Referer: `${BASE}/`,
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			ccaa: 'nc', // Comunidad Foral de Navarra
			select_tipo_sendero: '',
			select_gr: '',
			select_etapa: '',
			tipo: '',
			toponimo: '',
			texto: '',
			pagedArg: ''
		}).toString()
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} en buscar_etapas_mapa.php`);
	return res.json();
}

/** Matrícula base sin nº de etapa: "GR 11. Etapa 1" -> "GR 11"; "PR-NA 121". */
function baseMatricula(matricula) {
	return (matricula || '').split('.')[0].trim();
}

/** Federación a la que pertenece la matrícula (sufijo de provincia/CCAA). */
function federacionDeMatricula(base) {
	if (/-NA\b/.test(base)) return 'FNDME (Navarra)';
	if (/^GR\b/.test(base)) return 'FEDME (GR nacional/transfronterizo)';
	return 'desconocida';
}

/** Extrae un valor numérico tras un picto de la ficha (p. ej. longitud.svg). */
function pictoValue(html, picto) {
	const m = html.match(new RegExp(`${picto}\\.svg"[^>]*>\\s*([\\d.,]+)`, 'i'));
	return m ? Number(m[1].replace(',', '.')) : null;
}

/** Recorrido lineal/circular según el picto presente. */
function recorrido(html) {
	if (/recorridocircular\.svg/i.test(html)) return 'circular';
	if (/recorridolineal\.svg/i.test(html)) return 'lineal';
	return null;
}

/** Metadatos que la ficha de la federación expone para una etapa. */
async function fetchEtapaMeta(permalink) {
	const html = await get(permalink);
	return {
		longitud_km: pictoValue(html, 'longitud'),
		desnivel_pos_m: pictoValue(html, 'desnivelpositivo'),
		desnivel_neg_m: pictoValue(html, 'desnivelnegativo'),
		// El tiempo viene como "02 h 30" → se captura crudo para la PoC.
		tiempo_ida: (html.match(/tiempoida\.svg"[^>]*>\s*([^<]{1,12})/i)?.[1] ?? '').trim() || null,
		recorrido: recorrido(html)
	};
}

/** Distancia haversine (m) entre dos [lat,lon]. */
function haversine(a, b) {
	const R = 6371000;
	const toRad = (d) => (d * Math.PI) / 180;
	const dLat = toRad(b[0] - a[0]);
	const dLon = toRad(b[1] - a[1]);
	const lat1 = toRad(a[0]);
	const lat2 = toRad(b[0]);
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(h));
}

/** Parsea un GPX y deriva nº de puntos, bbox y longitud (km). */
function parseGpx(xml) {
	const pts = [];
	const re = /<trkpt[^>]*lat="([-\d.]+)"[^>]*lon="([-\d.]+)"/g;
	let m;
	while ((m = re.exec(xml))) pts.push([Number(m[1]), Number(m[2])]);
	if (pts.length === 0) return { points: 0, bbox: null, length_km: 0 };
	let length = 0;
	for (let i = 1; i < pts.length; i++) length += haversine(pts[i - 1], pts[i]);
	const lats = pts.map((p) => p[0]);
	const lons = pts.map((p) => p[1]);
	return {
		points: pts.length,
		bbox: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
		length_km: Math.round((length / 1000) * 10) / 10
	};
}

async function main() {
	console.log('PoC Navarra — capa federación (MiSendaFEDME, ccaa=nc)…');
	const etapas = await fetchNavarraCatalog();

	// Inventario por tipo y por sendero (parent).
	const porTipo = {};
	const senderos = new Map();
	for (const e of etapas) {
		porTipo[e.codi_matricula] = (porTipo[e.codi_matricula] ?? 0) + 1;
		const key = e.gr_parent_titulo;
		if (!senderos.has(key))
			senderos.set(key, {
				sendero: key,
				permalink: e.gr_parent_permalink,
				matricula_base: baseMatricula(e.matricula),
				federacion: federacionDeMatricula(baseMatricula(e.matricula)),
				etapas: 0
			});
		senderos.get(key).etapas++;
	}

	// Muestra: hasta 2 etapas por tipo → enriquecer (ficha) + geometría (GPX).
	const muestra = [];
	for (const tipo of ['GR', 'PR', 'SL']) {
		muestra.push(...etapas.filter((e) => e.codi_matricula === tipo).slice(0, 2));
	}
	const enriquecidas = [];
	for (const e of muestra) {
		await sleep(400);
		const meta = await fetchEtapaMeta(e.permalink).catch((err) => ({ error: String(err) }));
		await sleep(400);
		let geom;
		try {
			const xml = await get(`${FILES}${e.arxiu}`);
			geom = parseGpx(typeof xml === 'string' ? xml : Buffer.from(xml).toString('utf8'));
		} catch (err) {
			geom = { error: String(err) };
		}
		enriquecidas.push({
			matricula: e.matricula,
			tipo: e.codi_matricula,
			titulo: e.titulo,
			permalink: e.permalink,
			gpx: `${FILES}${e.arxiu}`,
			meta_federacion: meta,
			geometria_gpx: geom
		});
		console.log(`  · ${e.matricula}: meta+gpx ok`);
	}

	// Matriz de capacidades de la federación (qué expone la ficha pública).
	// Comparada con lo que la app YA tiene para CV (FEMECV).
	const capacidades = {
		fuente: 'MiSendaFEDME (FNDME / senderos.nafarmendi.org delega aquí)',
		expone: {
			existencia: true,
			matricula: true,
			tipo_gr_pr_sl: true,
			sendero_padre_y_etapas: true,
			geometria_gpx: true,
			longitud: true,
			desnivel: true,
			tiempo: true,
			recorrido_lineal_circular: true,
			comunidad_autonoma: true
		},
		no_expone_publicamente: {
			estado_homologacion_explicito: true, // presencia ≈ en vigor; no hay campo de estado
			dificultad_mide: true,
			agua_fuentes: true,
			pois: true,
			descripcion_estructurada: true,
			fauna_riesgos: true
		},
		nota:
			'Los bloques de "no_expone_publicamente" deben ocultarse o mostrar la capa ' +
			'"(FNDME) no expone públicamente datos para esta funcionalidad" en la ficha v6. ' +
			'Estado: la presencia en MiSendaFEDME implica "en vigor"; las rutas dadas de ' +
			'baja no aparecen (gate de existencia satisfecho automáticamente).'
	};

	const report = {
		generado: new Date().toISOString(),
		ccaa: 'Comunidad Foral de Navarra (nc)',
		fuente_federacion: {
			delegacion: 'senderos.nafarmendi.org → misendafedme.es',
			endpoint: `${BASE}/inc/buscar_etapas_mapa.php (POST ccaa=nc)`,
			ficha_detalle: 'permalink por etapa (HTML)',
			gpx: `${FILES}/adminsenderos/uploads/etapas/<id>/<archivo>.gpx`
		},
		geometria_produccion: 'CNIG serie FEDME (CC-BY), unida por matrícula+nombre [licencia]',
		totales: {
			etapas: etapas.length,
			por_tipo: porTipo,
			senderos: senderos.size
		},
		senderos: [...senderos.values()].sort((a, b) =>
			a.matricula_base.localeCompare(b.matricula_base)
		),
		muestra_enriquecida: enriquecidas,
		matriz_capacidades: capacidades
	};

	writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
	console.log(`\nResumen Navarra:`);
	console.log(`  etapas: ${etapas.length} | por tipo: ${JSON.stringify(porTipo)}`);
	console.log(`  senderos (parents): ${senderos.size}`);
	console.log(`  muestra enriquecida: ${enriquecidas.length}`);
	console.log(`  informe → ${OUT}`);
}

main().catch((err) => {
	console.error('PoC fallida:', err);
	process.exit(1);
});
