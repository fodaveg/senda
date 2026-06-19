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
