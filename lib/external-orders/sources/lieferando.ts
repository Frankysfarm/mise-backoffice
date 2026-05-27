import type { AdapterResult, SourceAdapter } from '../types';

/**
 * Lieferando (Just Eat Takeaway) — Partner-API "Orderdirect" Webhook.
 * Vertrag nötig, aber Format ist stabil.
 * Docs: https://developers.just-eat.com/docs/services/orders-webhook
 */
export const lieferandoAdapter: SourceAdapter = {
  source: 'lieferando',

  match(payload, headers) {
    return (
      headers['x-source'] === 'lieferando' ||
      typeof (payload as any)?.orderCode === 'string'
    );
  },

  parse(payload): AdapterResult {
    const p = payload as any;
    if (!p?.orderCode) return { ok: false, error: 'Lieferando payload fehlt orderCode' };

    const c = p.customer ?? {};
    const a = c.address ?? p.delivery?.address ?? {};
    const isDelivery = (p.orderType ?? '').toLowerCase() === 'delivery';

    return {
      ok: true,
      order: {
        external_id: String(p.orderCode),
        source: 'lieferando',
        location_hint: p.restaurant?.id ?? null,
        typ: isDelivery ? 'lieferung' : 'abholung',
        kunde_name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unbekannt',
        kunde_telefon: c.phoneNumber ?? null,
        kunde_email: c.email ?? null,
        kunde_adresse: [a.street, a.houseNumber].filter(Boolean).join(' ') || null,
        kunde_plz: a.postCode ?? null,
        kunde_stadt: a.city ?? null,
        kunde_lat: a.latitude ?? null,
        kunde_lng: a.longitude ?? null,
        kunde_etage: a.floor ?? null,
        kunde_tuer_code: null,
        kunde_lieferhinweis: a.note ?? p.customerNote ?? null,
        kunde_notiz: p.customerNote ?? null,
        zahlungsart: p.payment?.paidOnline ? 'online' : p.payment?.paymentType === 'cash' ? 'bar' : 'karte',
        bezahlt: !!p.payment?.paidOnline,
        liefergebuehr: Number(p.deliveryFee ?? 0),
        trinkgeld: Number(p.tip ?? 0),
        zwischensumme: Number(p.subtotal ?? 0),
        gesamtbetrag: Number(p.totalPrice ?? 0),
        geschaetzte_zubereitung_min: p.expectedPreparationTimeMinutes ?? null,
        geschaetzte_lieferung_min: p.expectedDeliveryTimeMinutes ?? null,
        items: (p.items ?? []).map((it: any) => ({
          name: String(it.name ?? 'Artikel'),
          menge: Number(it.quantity ?? 1),
          einzelpreis: Number(it.price ?? 0),
          extras: it.options ?? [],
          notiz: it.note ?? null,
        })),
      },
    };
  },
};
