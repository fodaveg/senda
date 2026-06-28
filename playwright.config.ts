import { defineConfig } from '@playwright/test';

// El puerto del servidor de preview para los e2e es configurable por entorno
// (`PLAYWRIGHT_PORT`); por defecto 4173. Útil para no chocar con otros proyectos
// que ya usen 4173 en local; en CI se queda en el valor por defecto.
const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);

export default defineConfig({
	webServer: {
		command: `npm run build && npm run preview -- --port ${port} --strictPort`,
		port,
		// Los e2e de cuenta (account.e2e) necesitan el backend HABILITADO para que
		// la ficha de cuenta renderice el formulario de login. La red de Supabase la
		// interceptan los tests con `page.route`, así que estos valores son ficticios
		// y nunca se contactan. Fijarlos aquí (y no en `.env` ni en variables de CI)
		// deja el build de producción/Pages como local-only por defecto: el sitio
		// desplegado no ofrece cuentas hasta que se configuren las claves reales.
		env: {
			PUBLIC_SUPABASE_URL: 'http://localhost:54321',
			PUBLIC_SUPABASE_ANON_KEY: 'e2e-anon-key'
		}
	},
	testMatch: '**/*.e2e.{ts,js}'
});
