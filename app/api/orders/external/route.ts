import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { parseExternalOrder } from '@/lib/external-orders/mapper';
import type { MappedOrder } from '@/lib/external-orders/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Webhook-Endpoint für externe Liefer-Plattformen.
 *
 * POST /api/orders/external
 * Header:
 *   X-Webhook-Secret: <WEBHOOK_SECRET> (pflicht)
 *   X-Source: deliverect|lieferando|ubereats|wolt (optional, sonst Auto-Detect)
 *   X-Location-Id: <uuid>                       (optional, sonst via location_hint Mapping)
 *
 * Body: Platform-spezifisches JSON (siehe lib/external-orders/sources/)
 *
 * Response 200: { order_id, bestellnummer, status }
 * Response 202: { staged: true, reason }  — gestaged, aber noch nicht in Haupt-Tabelle
 * Response 401: Secret falsch
 * Response 400: Payload ungültig
 */
export async function POST(req: NextRequest) {
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));

  const providedSecret = headers['x-webhook-secret'];
  if (!providedSecret) {
    return NextResponse.json({ error: 'X-Webhook-Secret Header fehlt' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // 1) Tenant-spezifisches Secret suchen (bevorzugt)
  const { data: platformCfg } = await supabase
    .from('tenant_platform_configs')
    .select('tenant_id, source, default_location_id, aktiv')
    .eq('webhook_secret', providedSecret)
    .eq('aktiv', true)
    .maybeSingle();

  // 2) Fallback: globales WEBHOOK_SECRET (für Dev / Legacy)
  const globalSecret = process.env.WEBHOOK_SECRET;
  const globalMatch = globalSecret && providedSecret === globalSecret;

  if (!platformCfg && !globalMatch) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantScope = platformCfg
    ? { tenantId: platformCfg.tenant_id, source: platformCfg.source, locationId: platformCfg.default_location_id }
    : null;

  const raw = await req.json().catch(() => null);
  if (!raw) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  // Ping-Request (vom Test-Button): nur Verbindung bestätigen
  if ((raw as any)?.ping === true) {
    if (tenantScope) {
      await supabase
        .from('tenant_platform_configs')
        .update({ zuletzt_empfangen: new Date().toISOString() })
        .eq('tenant_id', tenantScope.tenantId)
        .eq('source', tenantScope.source);
    }
    return NextResponse.json({ ok: true, ping: true, tenant: tenantScope?.tenantId ?? null });
  }

  // Wenn tenant-scope aktiv: X-Source-Header überschreiben wir mit der konfigurierten Source
  if (tenantScope) {
    headers['x-source'] = tenantScope.source;
  }

  const result = parseExternalOrder(raw, headers);

  if (!result.ok) {
    // Trotzdem staged loggen — Debug + spätere Wiederholung
    await supabase.from('external_orders_staging').insert({
      source: (headers['x-source'] as any) ?? 'custom',
      external_id: `unparsed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      raw_payload: raw,
      status: 'error',
      error_message: result.error,
    });
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const mapped = result.order;

  // Staging-Eintrag (idempotent via unique(source, external_id))
  const { data: staged, error: stageErr } = await supabase
    .from('external_orders_staging')
    .upsert(
      {
        source: mapped.source,
        external_id: mapped.external_id,
        raw_payload: raw,
        status: 'pending',
      },
      { onConflict: 'source,external_id' },
    )
    .select()
    .single();

  if (stageErr || !staged) {
    return NextResponse.json({ error: stageErr?.message ?? 'staging fehlgeschlagen' }, { status: 500 });
  }

  // Wenn schon verarbeitet: idempotent Rückgabe
  if ((staged as any).status === 'processed' && (staged as any).processed_order_id) {
    return NextResponse.json({
      order_id: (staged as any).processed_order_id,
      idempotent: true,
    });
  }

  // Location auflösen — Priorität:
  // 1) X-Location-Id Header
  // 2) default_location_id aus tenant_platform_configs
  // 3) location_hint-Mapping
  // 4) einzelne aktive Filiale (wenn nur eine)
  const locationId = (headers['x-location-id'] as string) ??
    tenantScope?.locationId ??
    (await resolveLocationId(supabase, null, mapped.location_hint ?? null));
  if (!locationId) {
    await supabase
      .from('external_orders_staging')
      .update({ status: 'error', error_message: 'Keine Filiale zuordenbar', processed_at: new Date().toISOString() })
      .eq('id', (staged as any).id);
    return NextResponse.json(
      { error: 'Keine Filiale zuordenbar. Sende X-Location-Id Header oder konfiguriere location_hint.' },
      { status: 400 },
    );
  }

  // customer_orders einfügen
  const { data: order, error: orderErr } = await supabase
    .from('customer_orders')
    .insert({
      location_id: locationId,
      typ: mapped.typ,
      status: 'bestätigt',
      kunde_name: mapped.kunde_name,
      kunde_telefon: mapped.kunde_telefon,
      kunde_email: mapped.kunde_email,
      kunde_adresse: mapped.kunde_adresse,
      kunde_plz: mapped.kunde_plz,
      kunde_stadt: mapped.kunde_stadt,
      kunde_lat: mapped.kunde_lat,
      kunde_lng: mapped.kunde_lng,
      kunde_etage: mapped.kunde_etage,
      kunde_tuer_code: mapped.kunde_tuer_code,
      kunde_lieferhinweis: mapped.kunde_lieferhinweis,
      kunde_notiz: mapped.kunde_notiz,
      zwischensumme: mapped.zwischensumme,
      liefergebuehr: mapped.liefergebuehr,
      trinkgeld: mapped.trinkgeld,
      gesamtbetrag: mapped.gesamtbetrag,
      zahlungsart: mapped.zahlungsart,
      bezahlt: mapped.bezahlt,
      geschaetzte_zubereitung_min: mapped.geschaetzte_zubereitung_min ?? 15,
      geschaetzte_lieferung_min: mapped.geschaetzte_lieferung_min,
      external_source: mapped.source,
      external_id: mapped.external_id,
    })
    .select()
    .single();

  if (orderErr || !order) {
    await supabase
      .from('external_orders_staging')
      .update({ status: 'error', error_message: orderErr?.message, processed_at: new Date().toISOString() })
      .eq('id', (staged as any).id);
    return NextResponse.json({ error: orderErr?.message ?? 'Order-Insert fehlgeschlagen' }, { status: 500 });
  }

  // Items
  if (mapped.items.length > 0) {
    const rows = mapped.items.map((it) => ({
      order_id: (order as any).id,
      name: it.name,
      menge: it.menge,
      einzelpreis: it.einzelpreis,
      extras: it.extras ?? [],
      notiz: it.notiz ?? null,
    }));
    await supabase.from('order_items').insert(rows);
  }

  // Staging abschließen
  await supabase
    .from('external_orders_staging')
    .update({
      status: 'processed',
      processed_order_id: (order as any).id,
      processed_at: new Date().toISOString(),
    })
    .eq('id', (staged as any).id);

  // Letzter-Eingang für Platform-Config updaten
  if (tenantScope) {
    await supabase
      .from('tenant_platform_configs')
      .update({ zuletzt_empfangen: new Date().toISOString() })
      .eq('tenant_id', tenantScope.tenantId)
      .eq('source', tenantScope.source);
  }

  // System-Message (für spätere Chat-History)
  await supabase.from('order_messages').insert({
    order_id: (order as any).id,
    sender: 'system',
    nachricht: `Bestellung eingegangen via ${mapped.source}`,
  });

  return NextResponse.json({
    order_id: (order as any).id,
    bestellnummer: (order as any).bestellnummer,
    status: (order as any).status,
  });
}

async function resolveLocationId(
  supabase: ReturnType<typeof createServiceClient>,
  explicitId: string | null,
  hint: string | null,
): Promise<string | null> {
  if (explicitId) return explicitId;

  // Fallback: falls nur eine Filiale existiert → die.
  const { data } = await supabase.from('locations').select('id').eq('aktiv', true);
  if (data && data.length === 1) return (data[0] as any).id;

  // TODO: external_location_mapping-Tabelle für hint → location_id.
  // Für jetzt: Hint ignorieren, null zurückgeben.
  return null;
}
