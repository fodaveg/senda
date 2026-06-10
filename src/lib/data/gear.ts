/** Catálogo y reglas de mochila cargados estáticamente en build. */

import type { GearItem, GearRule } from '$lib/types';
import itemsJson from '../../../data/gear/items.json';
import rulesJson from '../../../data/gear/rules.json';

export const gearItems = itemsJson as GearItem[];
export const gearRules = rulesJson as unknown as GearRule[];
