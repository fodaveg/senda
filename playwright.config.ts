import { defineConfig } from '@playwright/test';

// El puerto del servidor de preview para los e2e es configurable por entorno
// (`PLAYWRIGHT_PORT`); por defecto 4173. Útil para no chocar con otros proyectos
// que ya usen 4173 en local; en CI se queda en el valor por defecto.
const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);

export default defineConfig({
	webServer: {
		command: `npm run build && npm run preview -- --port ${port} --strictPort`,
		port
	},
	testMatch: '**/*.e2e.{ts,js}'
});
