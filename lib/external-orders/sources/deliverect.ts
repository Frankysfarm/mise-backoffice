import type { AdapterResult, SourceAdapter } from '../types';

/**
 * Deliverect Middleware Webhook — einheitliches Format für Lieferando/Uber/Wolt/Doordash.
 * Docs: https://developers.deliverect.com/reference/webhook-send-order
 *
 * Deliverect sendet beim Eingehen einer Order einen POST mit JSON Body.
 * Die eigentliche Plattform (channel) steckt in `channelLink` oder `channelOrderId`.
 */
export const deliverectAdapter: SourceAdapter = {
  source: 'deliverect',

  match(_payload, headers) {
    return (
      headers['x-source'] === 'deliverect' ||
      typeof (_payload as any)?.channelOrderId === 'string' ||
      typeof (_payload as any)?.channelLink === 'string'
    );
  },

  parse(payload): AdapterResult {
    const p = payload as any;
    if (!p?.channelOrderId && !p?._id) {
      return { ok: false, error: 'Deliverect payload fehlt channelOrderId/_id' };
    }

    const channel: string = (p.channelLink ?? p.channel ?? 'unknown').toLowerCase();
    // Sub-Source-Erkennung (nur fürs Labelling, nicht als separate `source`)
    const _subsource = inferSubsource(channel);

    const orderType = String(p.orderType ?? '').toLowerCase();
    const typ = orderType === 'pickup' ? 'abholung' : orderType === 'eat-in' ? 'vor_ort' : 'lieferung';

    const addr = p.customer?.address ?? p.deliveryAddress ?? {};
    const payment = p.payment ?? {};
    const isPaid = payment.type === 'ONLINE' || payment.isPaid === true;

    const items = (p.items ?? []).map((it: any) => ({
      name: String(it.name ?? it.productName ?? 'Artikel'),
      menge: Number(it.quantity ?? 1),
      einzelpreis: cents(it.price ?? it.unitPrice ?? 0),
      extras: it.subItems ?? it.modifiers ?? [],
      notiz: it.remark ?? null,
    }));

    const payMethod = mapPayment(payment.type ?? '');

    return {
      ok: true,
      order: {
        external_id: String(p.channelOrderId ?? p._id),
        source: 'deliverect',
        location_hint: p.locationId ?? p.storeId ?? null,
        typ,
        kunde_name: String(p.customer?.name ?? 'Unbekannt'),
        kunde_telefon: p.customer?.phoneNumber ?? null,
        kunde_email: p.customer?.email ?? null,
        kunde_adresse: [addr.street, addr.streetNumber].filter(Boolean).join(' ') || null,
        kunde_plz: addr.postalCode ?? null,
        kunde_stadt: addr.city ?? null,
        kunde_lat: addr.latitude != null ? Number(addr.latitude) : null,
        kunde_lng: addr.longitude != null ? Number(addr.longitude) : null,
        kunde_etage: addr.floor ?? null,
        kunde_tuer_code: addr.intercom ?? null,
        kunde_lieferhinweis: addr.extraAddressInfo ?? p.note ?? null,
        kunde_notiz: p.note ?? null,
        zahlungsart: payMethod,
        bezahlt: isPaid,
        liefergebuehr: cents(p.deliveryCost ?? 0),
        trinkgeld: cents(p.tip ?? 0),
        zwischensumme: cents(p.subTotal ?? 0),
        gesamtbetrag: cents(p.payment?.amount ?? p.total ?? 0),
        geschaetzte_zubereitung_min: p.preparationTime ?? null,
        geschaetzte_lieferung_min: p.deliveryTime ?? null,
        items,
      },
    };
  },
};

function inferSubsource(channel: string): string {
  if (channel.includes('lieferando') || channel.includes('just eat') || channel.includes('takeaway')) return 'lieferando';
  if (channel.includes('uber')) return 'ubereats';
  if (channel.includes('wolt')) return 'wolt';
  return channel;
}

function cents(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  // Deliverect sendet Beträge in Cents
  return Math.round(n) / 100;
}

function mapPayment(t: string): string {
  switch (t) {
    case 'ONLINE':
    case 'PREPAID':
      return 'online';
    case 'CASH':
      return 'bar';
    case 'CARD':
      return 'karte';
    default:
      return 'online';
  }
}
