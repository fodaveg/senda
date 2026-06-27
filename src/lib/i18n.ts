/**
 * Textos de UI centralizados (preparación para i18n; SPECS_V6 / V5-7).
 *
 * De momento **solo español, sin traducir**: un único objeto `ui` con las
 * cadenas de interfaz agrupadas por área. Centralizarlas aquí permite, más
 * adelante, añadir idiomas sin tocar cada componente. No es lógica de negocio:
 * son datos de presentación, sin imports de Svelte.
 *
 * La migración del resto de pantallas a este módulo es incremental; se empieza
 * por el armazón (cabecera, navegación, pie) en la v6.
 */
export const ui = {
	nav: {
		brand: 'Senda',
		tagline: 'Senderos homologados FEMECV de la Comunitat Valenciana',
		discover: 'Descubrir',
		journal: 'Diario',
		trends: 'Tendencias',
		settings: 'Ajustes',
		account: 'Cuenta',
		credits: 'Créditos y licencias',
		more: 'Más',
		skipToContent: 'Saltar al contenido'
	},
	footer: {
		data: 'Datos: FEMECV · IGN (CC BY 4.0) · © OpenStreetMap (ODbL) · Open-Meteo/AEMET.'
	}
} as const;

export type UiStrings = typeof ui;
