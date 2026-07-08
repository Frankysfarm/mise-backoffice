/**
 * GET /api/delivery/admin/liefergebiet-auslastung?location_id=<uuid>
 *
 * Phase 809 — Liefergebiet-Auslastungs-API
 * Bestelldichte je Zone (A/B/C/D) in Echtzeit + Überlastungs-Alarm (>120% Kapazität)
 *
 * Response: { ok, zonen: ZoneAuslastung[], alarm: boolean, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ZONE_KAPAZITAET: Record<string, number> = { A: 5, B: 8, C: 6, D: 4 };
const ZONE_NAMEN: Record<string, string> = { A: 'Express', B: 'Standard', C: 'Weit', D: 'Außerhalb' };

interface ZoneAuslastung {
  zone: string;
  name: string;
  aktiveBestellungen: number;
  kapazitaet: number;
  auslastungPct: number;
  status: 'ok' | 'hoch' | 'kritisch';
  aktiveFahrer: number;
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();
    const since2h = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // Aktive Bestellungen je Zone
    const { data: orders, error: oErr } = await sb
      .from('orders')
      .select('id, delivery_zone, status')
      .eq('location_id', locationId)
      .in('status', ['bestätigt', 'in_zubereitung', 'fertig', 'in_lieferung'])
      .gte('created_at', since2h);

    if (oErr) throw oErr;

    // Aktive Fahrer je Zone
    const { data: batches } = await sb
      .from('mise_delivery_batches')
      .select('id, driver_id, zone, status')
      .eq('location_id', locationId)
      .in('status', ['in_progress', 'active', 'unterwegs']);

    const fahrerByZone = new Map<string, Set<string>>();
    for (const b of batches ?? []) {
      const z = ((b as Record<string, unknown>).zone as string | null) ?? 'B';
      const dId = (b as Record<string, unknown>).driver_id as string | null;
      if (dId) {
        const set = fahrerByZone.get(z) ?? new Set();
        set.add(dId);
        fahrerByZone.set(z, set);
      }
    }

    const zonen: ZoneAuslastung[] = ['A', 'B', 'C', 'D'].map((zone) => {
      const aktive = (orders ?? []).filter((o) => {
        const z = ((o as Record<string, unknown>).delivery_zone as string | null) ?? 'B';
        return z === zone;
      }).length;
      const kap = ZONE_KAPAZITAET[zone] ?? 5;
      const pct = Math.round((aktive / kap) * 100);
      const status: ZoneAuslastung['status'] =
        pct >= 120 ? 'kritisch' : pct >= 80 ? 'hoch' : 'ok';
      return {
        zone,
        name: ZONE_NAMEN[zone] ?? zone,
        aktiveBestellungen: aktive,
        kapazitaet: kap,
        auslastungPct: pct,
        status,
        aktiveFahrer: fahrerByZone.get(zone)?.size ?? 0,
      };
    });

    const alarm = zonen.some((z) => z.status === 'kritisch');

    return NextResponse.json({ ok: true, zonen, alarm, generatedAt: new Date().toISOString() });
  } catch (err: unknown) {
    console.error('[liefergebiet-auslastung]', err);
    return NextResponse.json({ ok: false, error: 'Serverfehler' }, { status: 500 });
  }
}
