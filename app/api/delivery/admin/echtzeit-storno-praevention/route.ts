/**
 * GET /api/delivery/admin/echtzeit-storno-praevention
 *   ?location_id=<uuid>
 *
 * Phase 558 — Echtzeit-Storno-Präventions-Engine
 *
 * Scannt aktive Bestellungen die sich ihrer SLA-Grenze nähern und klassifiziert
 * das Storno-Risiko. Gibt priorisierte Handlungsempfehlungen zurück.
 *
 * Risiko-Kalkulation:
 *   - wartezeitMin: Minuten seit Bestelleingang
 *   - slaGrenzeMin: 30 Min (Standard-SLA)
 *   - verbleibendMin = slaGrenzeMin − wartezeitMin
 *   - risikoLevel:
 *       'kritisch'  wenn verbleibend ≤ 0
 *       'hoch'      wenn verbleibend ≤ 5
 *       'mittel'    wenn verbleibend ≤ 12
 *       'niedrig'   wenn verbleibend ≤ 20
 *   - aktionEmpfehlung je risikoLevel
 *
 * Response: { ok, bestellungen: StornoRisikoBestellung[], summary, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLA_GRENZE_MIN = 30;

export type RisikoLevel = 'kritisch' | 'hoch' | 'mittel' | 'niedrig';

export interface StornoRisikoBestellung {
  orderId: string;
  bestellnummer: string;
  kundeId: string | null;
  kundeName: string | null;
  status: string;
  zone: string | null;
  bestelltAm: string;
  wartezeitMin: number;
  slaGrenzeMin: number;
  verbleibendMin: number;
  risikoLevel: RisikoLevel;
  risikoScore: number;          // 0–100
  aktionEmpfehlung: string;
  hatAktivenFahrer: boolean;
}

export interface StornoRisikoSummary {
  gesamtAtRisk: number;
  kritischCount: number;
  hochCount: number;
  mittelCount: number;
  niedrigCount: number;
  avgWartezeitMin: number;
  sofortHandlungsbedarf: boolean;
}

export interface StornoProaektivResponse {
  ok: boolean;
  bestellungen: StornoRisikoBestellung[];
  summary: StornoRisikoSummary;
  generatedAt: string;
}

type OrderRow = {
  id: string;
  bestellnummer: string;
  customer_id: string | null;
  kunde_name: string | null;
  status: string;
  lieferzone: string | null;
  created_at: string;
};

type BatchRow = {
  id: string;
  driver_id: string | null;
  status: string;
};

type StopRow = {
  order_id: string;
  batch_id: string;
};

function computeRisikoScore(verbleibendMin: number): number {
  if (verbleibendMin <= 0)  return 100;
  if (verbleibendMin <= 5)  return 85 + Math.round((5 - verbleibendMin) * 3);
  if (verbleibendMin <= 12) return 55 + Math.round((12 - verbleibendMin) * 4.3);
  if (verbleibendMin <= 20) return 20 + Math.round((20 - verbleibendMin) * 4.4);
  return Math.max(0, 20 - Math.round(verbleibendMin - 20));
}

function computeRisikoLevel(verbleibendMin: number): RisikoLevel {
  if (verbleibendMin <= 0)  return 'kritisch';
  if (verbleibendMin <= 5)  return 'hoch';
  if (verbleibendMin <= 12) return 'mittel';
  return 'niedrig';
}

function aktionFuerRisiko(level: RisikoLevel, hatFahrer: boolean): string {
  switch (level) {
    case 'kritisch':
      return hatFahrer
        ? 'SLA überschritten — Kunden sofort benachrichtigen + Gutschein anbieten'
        : 'SLA überschritten — sofort Fahrer zuweisen + Kunden informieren';
    case 'hoch':
      return hatFahrer
        ? 'Fahrer kontaktieren — Beschleunigung anfordern'
        : 'Dringend Fahrer zuweisen — Zeitfenster schließt sich';
    case 'mittel':
      return hatFahrer
        ? 'Tour-Status prüfen — Puffer ist knapp'
        : 'Fahrer-Zuweisung priorisieren';
    case 'niedrig':
    default:
      return 'Im Blick behalten — rechtzeitig Fahrer sicherstellen';
  }
}

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const param = new URL(req.url).searchParams.get('location_id');
  if (param) return param;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return (emp as { location_id: string } | null)?.location_id ?? null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const locationId = await resolveLocationId(req);
    if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

    const svc = createServiceClient();
    const now = new Date();

    const AKTIV_STATUS = ['neu', 'bestätigt', 'in_zubereitung', 'fertig'];
    const cutoff = new Date(now.getTime() - SLA_GRENZE_MIN * 2 * 60_000).toISOString();

    const [ordersRes, stopsRes] = await Promise.all([
      svc
        .from('customer_orders')
        .select('id, bestellnummer, customer_id, kunde_name, status, lieferzone, created_at')
        .eq('location_id', locationId)
        .in('status', AKTIV_STATUS)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: true })
        .limit(100),
      svc
        .from('delivery_stops')
        .select('order_id, batch_id')
        .eq('location_id', locationId)
        .in('status', ['pending', 'in_progress']),
    ]);

    const orders = (ordersRes.data ?? []) as OrderRow[];
    const stops  = (stopsRes.data ?? []) as StopRow[];

    const orderToBatch = new Map<string, string>();
    for (const s of stops) {
      orderToBatch.set(s.order_id, s.batch_id);
    }

    const batchIds = [...new Set(stops.map(s => s.batch_id))];
    let activeBatches: BatchRow[] = [];
    if (batchIds.length > 0) {
      const batchRes = await svc
        .from('delivery_batches')
        .select('id, driver_id, status')
        .in('id', batchIds)
        .in('status', ['dispatched', 'in_progress', 'picking_up']);
      activeBatches = (batchRes.data ?? []) as BatchRow[];
    }
    const activeBatchMap = new Map<string, BatchRow>(activeBatches.map(b => [b.id, b]));

    const bestellungen: StornoRisikoBestellung[] = [];

    for (const o of orders) {
      const bestelltAm   = new Date(o.created_at);
      const wartezeitMs  = now.getTime() - bestelltAm.getTime();
      const wartezeitMin = wartezeitMs / 60_000;
      const verbleibendMin = SLA_GRENZE_MIN - wartezeitMin;

      if (verbleibendMin > 20) continue;

      const batchId    = orderToBatch.get(o.id);
      const batch      = batchId ? activeBatchMap.get(batchId) : undefined;
      const hatFahrer  = !!(batch?.driver_id);
      const level      = computeRisikoLevel(verbleibendMin);
      const score      = computeRisikoScore(verbleibendMin);

      bestellungen.push({
        orderId:           o.id,
        bestellnummer:     o.bestellnummer,
        kundeId:           o.customer_id,
        kundeName:         o.kunde_name,
        status:            o.status,
        zone:              o.lieferzone,
        bestelltAm:        o.created_at,
        wartezeitMin:      Math.round(wartezeitMin * 10) / 10,
        slaGrenzeMin:      SLA_GRENZE_MIN,
        verbleibendMin:    Math.round(verbleibendMin * 10) / 10,
        risikoLevel:       level,
        risikoScore:       score,
        aktionEmpfehlung:  aktionFuerRisiko(level, hatFahrer),
        hatAktivenFahrer:  hatFahrer,
      });
    }

    bestellungen.sort((a, b) => b.risikoScore - a.risikoScore);

    const kritischCount = bestellungen.filter(b => b.risikoLevel === 'kritisch').length;
    const hochCount     = bestellungen.filter(b => b.risikoLevel === 'hoch').length;
    const mittelCount   = bestellungen.filter(b => b.risikoLevel === 'mittel').length;
    const niedrigCount  = bestellungen.filter(b => b.risikoLevel === 'niedrig').length;
    const avgWartezeitMin = bestellungen.length > 0
      ? bestellungen.reduce((s, b) => s + b.wartezeitMin, 0) / bestellungen.length
      : 0;

    const summary: StornoRisikoSummary = {
      gesamtAtRisk:          bestellungen.length,
      kritischCount,
      hochCount,
      mittelCount,
      niedrigCount,
      avgWartezeitMin:       Math.round(avgWartezeitMin * 10) / 10,
      sofortHandlungsbedarf: kritischCount > 0 || hochCount > 0,
    };

    const response: StornoProaektivResponse = {
      ok: true,
      bestellungen,
      summary,
      generatedAt: now.toISOString(),
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[echtzeit-storno-praevention]', err);
    return NextResponse.json({ error: 'Interner Fehler', detail: String(err) }, { status: 500 });
  }
}
