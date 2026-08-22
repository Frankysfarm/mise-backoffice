import type { AdapterResult, SourceAdapter } from '../types';

/**
 * Uber Eats — Order Notification Webhook.
 * Docs: https://developer.uber.com/docs/eats/guides/webhooks
 *
 * Uber Eats sendet nur ein "order.notification" Event mit der Order-ID;
 * die Details müssen per GET /v1/eats/orders/{id} nachgeholt werden.
 * Hier: wir erwarten, dass die Middleware die Details schon auflöst und das
 * vollständige Order-Objekt weiterleitet (typischer Pattern bei Deliverect).
 */
export const uberEatsAdapter: SourceAdapter = {
  source: 'ubereats',

  match(payload, headers) {
    return (
      headers['x-source'] === 'ubereats' ||
      typeof (payload as any)?.event_type === 'string' && String((payload as any).event_type).startsWith('orders.')
    );
  },

  parse(payload): AdapterResult {
    const p = payload as any;
    const order = p.data ?? p;
    if (!order?.id) return { ok: false, error: 'Uber Eats payload fehlt order.id' };

    const eater = order.eater ?? {};
    const location = order.delivery?.location ?? {};
    const typ = order.type === 'PICK_UP' ? 'abholung' : 'lieferung';
    const cart = order.cart ?? {};

    return {
      ok: true,
      order: {
        external_id: String(order.id),
        source: 'ubereats',
        location_hint: order.store?.id ?? null,
        typ,
        kunde_name: [eater.first_name, eater.last_name].filter(Boolean).join(' ') || 'Uber Kunde',
        kunde_telefon: eater.phone ?? null,
        kunde_email: eater.email ?? null,
        kunde_adresse: [location.street_address_line_one, location.street_address_line_two].filter(Boolean).join(' ') || null,
        kunde_plz: location.postal_code ?? null,
        kunde_stadt: location.city ?? null,
        kunde_lat: location.latitude ?? null,
        kunde_lng: location.longitude ?? null,
        kunde_etage: null,
        kunde_tuer_code: null,
        kunde_lieferhinweis: location.unit_number ?? order.delivery?.interaction_type ?? null,
        kunde_notiz: order.eater_notes ?? null,
        zahlungsart: 'online', // Uber Eats ist immer prepaid
        bezahlt: true,
        liefergebuehr: Number(cart.delivery_fee?.amount_e5 ?? 0) / 1e5,
        trinkgeld: Number(cart.tip?.amount_e5 ?? 0) / 1e5,
        zwischensumme: Number(cart.subtotal?.amount_e5 ?? 0) / 1e5,
        gesamtbetrag: Number(order.payment?.charges?.total?.amount_e5 ?? 0) / 1e5,
        geschaetzte_zubereitung_min: null,
        geschaetzte_lieferung_min: null,
        items: (cart.items ?? []).map((it: any) => ({
          name: String(it.title ?? 'Artikel'),
          menge: Number(it.quantity?.amount ?? 1),
          einzelpreis: Number(it.price?.unit_price?.amount_e5 ?? 0) / 1e5,
          extras: it.customizations ?? [],
          notiz: it.special_instructions ?? null,
        })),
      },
    };
  },
};
