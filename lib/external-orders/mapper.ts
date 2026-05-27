import type { AdapterResult, SourceAdapter } from './types';
import { deliverectAdapter } from './sources/deliverect';
import { lieferandoAdapter } from './sources/lieferando';
import { uberEatsAdapter } from './sources/ubereats';
import { woltAdapter } from './sources/wolt';

const ADAPTERS: SourceAdapter[] = [
  deliverectAdapter, // Deliverect zuerst (weil es viele Plattformen abdeckt)
  lieferandoAdapter,
  uberEatsAdapter,
  woltAdapter,
];

export function parseExternalOrder(
  payload: unknown,
  headers: Record<string, string>,
): AdapterResult {
  const forced = headers['x-source'];
  if (forced) {
    const adapter = ADAPTERS.find((a) => a.source === forced);
    if (adapter) return adapter.parse(payload, headers);
    return { ok: false, error: `Unbekannte source: ${forced}` };
  }

  for (const adapter of ADAPTERS) {
    if (adapter.match(payload, headers)) {
      return adapter.parse(payload, headers);
    }
  }
  return { ok: false, error: 'Kein passender Adapter für Payload gefunden' };
}

export { ADAPTERS };
