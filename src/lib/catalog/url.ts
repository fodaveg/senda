/**
 * URL del catálogo publicado (SPECS_V2 §4). Se sirve junto a la web, en
 * `<base>/catalog`, y se resuelve como ruta relativa al origen actual: así
 * funciona sea cual sea el dominio (GitLab Pages redirige a un dominio
 * único servido en la raíz) y sobrevive a que ese dominio cambie. Vive
 * aparte de update.ts para que ese módulo siga siendo puro y testeable.
 */

import { base } from '$app/paths';

export const CATALOG_URL = `${base}/catalog`;
