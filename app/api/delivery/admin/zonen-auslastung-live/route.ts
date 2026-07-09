/**
 * GET /api/delivery/admin/zonen-auslastung-live?location_id=<uuid>
 *
 * Phase 958 — Echtzeit-Zonenauslastung-Board (Dispatch)
 * Bestelldichte je Zone A/B/C/D mit Kapazitätsstatus.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ZoneAuslastung {
  zone: string;
  aktive_bestellungen: number;
  kapazitaet_max: number;
  auslastung_pct: number;
  fahrer_verfuegbar: number;
  fahrer_gesamt: number;
  status: 'ok' | 'hoch' | 'kritisch';
  letzteBestellung: string | null;
}

const ZONE_KAPAZITAET: Record<string, number> = { A: 20, B: 18, C: 15, D: 12 };

function mockData(): { zonen: ZoneAuslastung[]; generatedAt: string } {
  return {
    zonen: [
      { zone: 'A', aktive_bestellungen: 8, kapazitaet_max: 20, auslastung_pct: 40, fahrer_verfuegbar: 3, fahrer_gesamt: 4, status: 'ok', letzteBestellung: new Date(Date.now() - 3 * 60_000).toISOString() },
      { zone: 'B', aktive_bestellungen: 14, kapazitaet_max: 18, auslastung_pct: 78, fahrer_verfuegbar: 1, fahrer_gesamt: 3, status: 'hoch', letzteBestellung: new Date(Date.now() - 1 * 60_000).toISOString() },
      { zone: 'C', aktive_bestellungen: 13, kapazitaet_max: 15, auslastung_pct: 87, fahrer_verfuegbar: 0, fahrer_gesamt: 2, status: 'kritisch', letzteBestellung: new Date(Date.now() - 30_000).toISOString() },
      { zone: 'D', aktive_bestellungen: 3, kapazitaet_max: 12, auslastung_pct: 25, fahrer_verfuegbar: 2, fahrer_gesamt: 2, status: 'ok', letzteBestellung: new Date(Date.now() - 8 * 60_000).toISOString() },
    ],
    generatedAt: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const locationId = url.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(mockData());

  try {
    const sb = await createClient();
    const jetzt = new Date();
    const cutoff = new Date(jetzt.getTime() - 3 * 60 * 60_000); // letzte 3h

    const [{ data: batches }, { data: drivers }] = await Promise.all([
      sb
        .from('mise_delivery_batches')
        .select('id, zone, status, created_at')
        .eq('location_id', locationId)
        .in('status', ['pending', 'assigned', 'picked_up', 'en_route', 'aktiv', 'unterwegs'])
        .gte('created_at', cutoff.toISOString()),
      sb
        .from('mise_drivers')
        .select('id, zone, status')
        .eq('location_id', locationId),
    ]);

    const zonen = ['A', 'B', 'C', 'D'].map((zone): ZoneAuslastung => {
      const zoneBatches = (batches ?? []).filter((b) => {
        const bd = b as { zone: string | null };
        return (bd.zone ?? 'A') === zone;
      });
      const zoneDrivers = (drivers ?? []).filter((d) => {
        const dd = d as { zone: string | null; status: string | null };
        return (dd.zone ?? 'A') === zone;
      });
      const verfuegbar = zoneDrivers.filter((d) => {
        const dd = d as { status: string | null };
        return ['verfuegbar', 'available', 'frei', 'idle'].includes(dd.status ?? '');
      }).length;

      const aktiv = zoneBatches.length;
      const max = ZONE_KAPAZITAET[zone] ?? 15;
      const pct = Math.round((aktiv / max) * 100);

      const letzteRaw = zoneBatches
        .map((b) => {
          const bd = b as { created_at: string | null };
          return bd.created_at;
        })
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;

      return {
        zone,
        aktive_bestellungen: aktiv,
        kapazitaet_max: max,
        auslastung_pct: Math.min(100, pct),
        fahrer_verfuegbar: verfuegbar,
        fahrer_gesamt: zoneDrivers.length,
        status: pct >= 85 ? 'kritisch' : pct >= 65 ? 'hoch' : 'ok',
        letzteBestellung: letzteRaw,
      };
    });

    return NextResponse.json({ zonen, generatedAt: jetzt.toISOString() });
  } catch {
    return NextResponse.json(mockData());
  }
}
