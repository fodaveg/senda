import { describe, expect, it } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { haversineMeters } from './distance';
import { gpxToGeoJSON, trackPositions } from './gpx';
import { axisTicks, elevationProfile } from './profile';
import { fetchDrivingEstimate, fetchDrivingEstimateCached, RoutingError } from './routing';

const GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
	<trk><name>Demo</name><trkseg>
		<trkpt lat="39.0" lon="-0.5"><ele>100</ele></trkpt>
		<trkpt lat="39.01" lon="-0.5"><ele>150</ele></trkpt>
		<trkpt lat="39.02" lon="-0.5"><ele>120</ele></trkpt>
	</trkseg></trk>
</gpx>`;

const xmlParser = new DOMParser();

describe('haversineMeters', () => {
	it('0,01° de latitud ≈ 1112 m', () => {
		expect(haversineMeters([-0.5, 39.0], [-0.5, 39.01])).toBeCloseTo(1112, -1);
	});

	it('distancia cero entre puntos idénticos', () => {
		expect(haversineMeters([-0.5, 39.0], [-0.5, 39.0])).toBe(0);
	});
});

describe('gpxToGeoJSON + trackPositions', () => {
	it('convierte el track a posiciones [lon, lat, ele]', () => {
		const positions = trackPositions(gpxToGeoJSON(GPX, xmlParser));
		expect(positions).toHaveLength(3);
		expect(positions[0]).toEqual([-0.5, 39.0, 100]);
	});

	it('tolera el BOM inicial de CompeGPS', () => {
		const positions = trackPositions(gpxToGeoJSON('﻿' + GPX, xmlParser));
		expect(positions).toHaveLength(3);
	});
});

describe('elevationProfile', () => {
	it('acumula distancia y conserva elevaciones', () => {
		const profile = elevationProfile(trackPositions(gpxToGeoJSON(GPX, xmlParser)));
		expect(profile).toHaveLength(3);
		expect(profile[0]).toEqual({ km: 0, ele: 100 });
		expect(profile[2].km).toBeCloseTo(2.22, 1);
		expect(profile[2].ele).toBe(120);
	});

	it('omite puntos sin elevación sin perder la distancia acumulada', () => {
		const profile = elevationProfile([
			[-0.5, 39.0, 100],
			[-0.5, 39.01],
			[-0.5, 39.02, 120]
		]);
		expect(profile).toHaveLength(2);
		expect(profile[1].km).toBeCloseTo(2.22, 1);
	});

	it('track sin elevaciones → perfil vacío', () => {
		expect(
			elevationProfile([
				[-0.5, 39.0],
				[-0.5, 39.01]
			])
		).toEqual([]);
	});
});

describe('axisTicks', () => {
	it('genera pasos redondos (1/2/5×10ⁿ) que cubren el rango', () => {
		expect(axisTicks(0, 11.2, 5)).toEqual([0, 2, 4, 6, 8, 10]);
		expect(axisTicks(240, 595, 4)).toEqual([300, 400, 500]);
	});

	it('incluye el extremo superior cuando cae en un paso exacto', () => {
		expect(axisTicks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
	});

	it('rango nulo o degenerado → una sola marca', () => {
		expect(axisTicks(5, 5)).toEqual([5]);
	});
});

describe('fetchDrivingEstimate (OSRM)', () => {
	it('convierte segundos/metros a minutos/km y exige code Ok', async () => {
		const fakeFetch = (async () =>
			new Response(
				JSON.stringify({ code: 'Ok', routes: [{ duration: 3912, distance: 78250 }] })
			)) as unknown as typeof fetch;
		const estimate = await fetchDrivingEstimate(
			{ lat: 39.5, lon: -0.4 },
			{ lat: 39.7, lon: -0.9 },
			fakeFetch
		);
		expect(estimate).toEqual({ durationMin: 65, distanceKm: 78.3 });
	});

	it('code != Ok o sin rutas → RoutingError', async () => {
		const noRoute = (async () =>
			new Response(JSON.stringify({ code: 'NoRoute', routes: [] }))) as unknown as typeof fetch;
		await expect(
			fetchDrivingEstimate({ lat: 0, lon: 0 }, { lat: 1, lon: 1 }, noRoute)
		).rejects.toBeInstanceOf(RoutingError);
	});

	it('la caché evita la segunda petición dentro del TTL', async () => {
		let calls = 0;
		const fakeFetch = (async () => {
			calls++;
			return new Response(
				JSON.stringify({ code: 'Ok', routes: [{ duration: 600, distance: 10000 }] })
			);
		}) as unknown as typeof fetch;
		const store = new Map<string, string>();
		const storage = {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => void store.set(k, v)
		};
		const from = { lat: 39.5, lon: -0.4 };
		const to = { lat: 39.7, lon: -0.9 };
		await fetchDrivingEstimateCached(from, to, { fetchFn: fakeFetch, storage, now: () => 0 });
		const second = await fetchDrivingEstimateCached(from, to, {
			fetchFn: fakeFetch,
			storage,
			now: () => 1000
		});
		expect(calls).toBe(1);
		expect(second.durationMin).toBe(10);
	});
});
