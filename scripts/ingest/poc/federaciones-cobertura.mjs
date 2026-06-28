/**
 * Sondeo nacional de la CAPA FEDERACIÓN (SPECS_V5_FEDERACIONES.md, Fase A).
 *
 * MiSendaFEDME es el buscador NACIONAL de la FEDME: el mismo endpoint JSON
 * (`inc/buscar_etapas_mapa.php`) acepta el parámetro `ccaa`, así que con una
 * petición por comunidad obtenemos la cobertura de TODAS de una vez: nº de
 * etapas, por tipo (GR/PR/SL), senderos distintos y prefijos de matrícula.
 *
 * Es la "capa de existencia/estado/geometría" del modelo acordado. NO sustituye
 * el enriquecimiento (estado detallado, MIDE, agua, municipio…), que se investiga
 * por CCAA en la Fase B.
 *
 * Salida: scripts/ingest/poc/federaciones-cobertura.json
 * Uso:    node scripts/ingest/poc/federaciones-cobertura.mjs
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const UA = 'senda-poc-federaciones/0.1 (proyecto personal; contacto: fodaveg@fodaveg.net)';
const BASE = 'https://misendafedme.es/buscador-de-senderos';
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'federaciones-cobertura.json');

// Códigos del selector cmbCCAA de MiSendaFEDME.
const CCAA = {
	an: 'Andalucía',
	ar: 'Aragón',
	as: 'Asturias',
	ib: 'Illes Balears',
	cn: 'Canarias',
	cb: 'Cantabria',
	cm: 'Castilla-La Mancha',
	cl: 'Castilla y León',
	ct: 'Cataluña',
	ex: 'Extremadura',
	ga: 'Galicia',
	ri: 'La Rioja',
	md: 'Madrid',
	mc: 'Murcia',
	nc: 'Navarra',
	pv: 'País Vasco',
	vc: 'Comunitat Valenciana',
	ce: 'Ceuta',
	ml: 'Melilla'
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchCcaa(code) {
	const res = await fetch(`${BASE}/inc/buscar_etapas_mapa.php`, {
		method: 'POST',
		headers: {
			'User-Agent': UA,
			'X-Requested-With': 'XMLHttpRequest',
			Referer: `${BASE}/`,
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			ccaa: code,
			select_tipo_sendero: '',
			select_gr: '',
			select_etapa: '',
			tipo: '',
			toponimo: '',
			texto: '',
			pagedArg: ''
		}).toString()
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.json();
}

/** Prefijo de matrícula sin nº de etapa: "PR-NA 121" -> "PR-NA"; "GR 11" -> "GR". */
function prefijo(matricula) {
	const base = (matricula || '').split('.')[0].trim();
	const m = base.match(/^([A-Z]+(?:-[A-Z]+)?)/);
	return m ? m[1] : base;
}

async function main() {
	const report = {
		generado: new Date().toISOString(),
		fuente: `${BASE}/inc/buscar_etapas_mapa.php`,
		ccaa: {}
	};
	let total = 0;
	for (const [code, nombre] of Object.entries(CCAA)) {
		await sleep(500);
		let etapas;
		try {
			etapas = await fetchCcaa(code);
		} catch (err) {
			report.ccaa[code] = { nombre, error: String(err) };
			console.log(`${code} ${nombre}: ERROR ${err}`);
			continue;
		}
		const porTipo = {};
		const senderos = new Set();
		const prefijos = {};
		for (const e of etapas) {
			porTipo[e.codi_matricula] = (porTipo[e.codi_matricula] ?? 0) + 1;
			senderos.add(e.gr_parent_titulo);
			const p = prefijo(e.matricula);
			prefijos[p] = (prefijos[p] ?? 0) + 1;
		}
		report.ccaa[code] = {
			nombre,
			etapas: etapas.length,
			por_tipo: porTipo,
			senderos: senderos.size,
			prefijos_matricula: Object.keys(prefijos).sort()
		};
		total += etapas.length;
		console.log(
			`${code} ${nombre.padEnd(22)} etapas:${String(etapas.length).padStart(4)}  senderos:${String(senderos.size).padStart(3)}  ${Object.keys(prefijos).sort().join(',')}`
		);
	}
	report.total_etapas = total;
	writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
	console.log(`\nTotal etapas (nacional, MiSendaFEDME): ${total}`);
	console.log(`Informe → ${OUT}`);
}

main().catch((err) => {
	console.error('Sondeo fallido:', err);
	process.exit(1);
});
