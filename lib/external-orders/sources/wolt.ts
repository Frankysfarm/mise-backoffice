import type { AdapterResult, SourceAdapter } from '../types';

/**
 * Wolt — Merchant API "Order Notification" Webhook.
 * Docs: https://developer.wolt.com/docs/api/order-api
 */
export const woltAdapter: SourceAdapter = {
  source: 'wolt',

  match(payload, headers) {
    return (
      headers['x-source'] === 'wolt' ||
      typeof (payload as any)?.order?.id === 'string' &&
        typeof (payload as any)?.order?.venue_id === 'string'
    );
  },

  parse(payload): AdapterResult {
    const p = payload as any;
    const order = p.order ?? p;
    if (!order?.id) return { ok: false, error: 'Wolt payload fehlt order.id' };

    const cust = order.consumer ?? {};
    const addr = order.delivery?.location ?? order.delivery?.address ?? {};
    const typ = order.type === 'takeaway' ? 'abholung' : order.type === 'eatin' ? 'vor_ort' : 'lieferung';

    return {
      ok: true,
      order: {
        external_id: String(order.id),
        source: 'wolt',
        location_hint: order.venue_id ?? null,
        typ,
        kunde_name: cust.name?.first_name
          ? [cust.name.first_name, cust.name.last_name].filter(Boolean).join(' ')
          : String(cust.name ?? 'Wolt Kunde'),
        kunde_telefon: cust.phone_number ?? null,
        kunde_email: cust.email ?? null,
        kunde_adresse: [addr.street?.name, addr.street?.number].filter(Boolean).join(' ') || null,
        kunde_plz: addr.post_code ?? null,
        kunde_stadt: addr.city ?? null,
        kunde_lat: addr.coordinates?.lat ?? null,
        kunde_lng: addr.coordinates?.lon ?? null,
        kunde_etage: addr.apartment ?? null,
        kunde_tuer_code: addr.door_code ?? null,
        kunde_lieferhinweis: addr.additional_info ?? order.comments ?? null,
        kunde_notiz: order.comments ?? null,
        zahlungsart: 'online', // Wolt prepaid
        bezahlt: true,
        liefergebuehr: Number(order.fees?.delivery_fee?.amount ?? 0) / 100,
        trinkgeld: Number(order.tip?.amount ?? 0) / 100,
        zwischensumme: Number(order.subtotal?.amount ?? 0) / 100,
        gesamtbetrag: Number(order.total_price?.amount ?? 0) / 100,
        geschaetzte_zubereitung_min: order.preorder ? null : order.preparation_time_minutes ?? null,
        geschaetzte_lieferung_min: null,
        items: (order.items ?? []).map((it: any) => ({
          name: String(it.name ?? 'Artikel'),
          menge: Number(it.count ?? 1),
          einzelpreis: Number(it.unit_price?.amount ?? 0) / 100,
          extras: it.options ?? [],
          notiz: it.customer_comments ?? null,
        })),
      },
    };
  },
};
