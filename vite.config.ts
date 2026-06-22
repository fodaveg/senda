import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			// GitLab Pages redirige a un dominio único servido en la raíz, así que
			// se compila con base vacío. `relative: false` fuerza rutas absolutas
			// desde la raíz para todos los assets (JS, CSS, manifest, iconos): así
			// no dependen de la página en que estés —el manifest dejaba de cargar en
			// /ruta/* con rutas relativas—. BASE_PATH permite recolocar el sitio bajo
			// un subdirectorio si algún día se sirve sin dominio único.
			paths: {
				base: (process.env.BASE_PATH ?? '') as '' | `/${string}`,
				relative: false
			}
		})
	],
	build: {
		// Dos chunks grandes son inherentes y NO son código de app que se sirva en
		// el arranque: (1) `maplibre-gl` (~1 MB), una librería que no se puede
		// trocear más y que desde V4-M6 se carga por import dinámico (LazyMap.svelte)
		// en su propio chunk **asíncrono**, fuera del bundle inicial; (2) el bundle
		// del servidor de prerender, que empaqueta el catálogo para generar el HTML
		// en build y no se envía al usuario. Subimos el umbral del aviso para no
		// marcarlos, sin ocultar chunks de app reales (que rondan los ~50 kB).
		chunkSizeWarningLimit: 1500
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}', 'scripts/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
