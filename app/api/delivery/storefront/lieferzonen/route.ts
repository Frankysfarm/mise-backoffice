/**
 * GET /api/delivery/storefront/lieferzonen?location_id=<uuid>
 *
 * Phase 970 — Lieferzonen-API (Storefront)
 * Gibt Zonen A/B/C/D mit ETA-Bereich, Liefergebühr und aktueller Auslastung zurück.
 * Multi-Tenant via location_id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ZoneInfo {
  zone: 'A' | 'B' | 'C' | 'D';
  label: string;
  beschreibung: string;
  eta_min_min: number;
  eta_min_max: number;
  liefergebuehr_eur: number;
  auslastung: 'niedrig' | 'normal' | 'hoch' | 'voll';
  aktive_bestellungen: number;
  verfuegbar: boolean;
}

const ZONE_DEFAULTS: ZoneInfo[] = [
  {
    zone: 'A',
    label: 'Zone A — Stadtmitte',
    beschreibung: 'Innerhalb 1 km',
    eta_min_min: 15,
    eta_min_max: 25,
    liefergebuehr_eur: 0,
    auslastung: 'normal',
    aktive_bestellungen: 0,
    verfuegbar: true,
  },
  {
    zone: 'B',
    label: 'Zone B — Nahbereich',
    beschreibung: '1–3 km',
    eta_min_min: 25,
    eta_min_max: 40,
    liefergebuehr_eur: 1.5,
    auslastung: 'normal',
    aktive_bestellungen: 0,
    verfuegbar: true,
  },
  {
    zone: 'C',
    label: 'Zone C — Erweitert',
    beschreibung: '3–6 km',
    eta_min_min: 40,
    eta_min_max: 60,
    liefergebuehr_eur: 2.99,
    auslastung: 'normal',
    aktive_bestellungen: 0,
    verfuegbar: true,
  },
  {
    zone: 'D',
    label: 'Zone D — Außenbereich',
    beschreibung: '6–10 km',
    eta_min_min: 55,
    eta_min_max: 80,
    liefergebuehr_eur: 4.99,
    auslastung: 'normal',
    aktive_bestellungen: 0,
    verfuegbar: true,
  },
];

function auslastungFromCount(aktiv: number): ZoneInfo['auslastung'] {
  if (aktiv >= 20) return 'voll';
  if (aktiv >= 12) return 'hoch';
  if (aktiv >= 6) return 'normal';
  return 'niedrig';
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const locationId = url.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Count active orders per zone
    const { data: stops } = await sb
      .from('mise_delivery_stops')
      .select('zone')
      .eq('location_id', locationId)
      .not('status', 'in', '("delivered","cancelled","failed")')
      .gte('created_at', todayStart.toISOString());

    const zoneCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const s of stops ?? []) {
      const z = (s as { zone?: string | null }).zone?.toUpperCase();
      if (z && z in zoneCounts) zoneCounts[z]++;
    }

    // Try to get zone fee config from location settings
    const { data: settings } = await sb
      .from('mise_location_settings')
      .select('delivery_zone_fees, delivery_zone_eta')
      .eq('location_id', locationId)
      .maybeSingle();

    const zoneFees = (settings as { delivery_zone_fees?: Record<string, number> } | null)
      ?.delivery_zone_fees ?? {};
    const zoneEta = (settings as { delivery_zone_eta?: Record<string, { min: number; max: number }> } | null)
      ?.delivery_zone_eta ?? {};

    const zonen: ZoneInfo[] = ZONE_DEFAULTS.map((z) => {
      const aktiv = zoneCounts[z.zone] ?? 0;
      const feeOverride = zoneFees[z.zone];
      const etaOverride = zoneEta[z.zone];
      return {
        ...z,
        aktive_bestellungen: aktiv,
        auslastung: auslastungFromCount(aktiv),
        verfuegbar: auslastungFromCount(aktiv) !== 'voll',
        liefergebuehr_eur: feeOverride !== undefined ? feeOverride : z.liefergebuehr_eur,
        eta_min_min: etaOverride?.min ?? z.eta_min_min,
        eta_min_max: etaOverride?.max ?? z.eta_min_max,
      };
    });

    return NextResponse.json({ zonen, generatedAt: now.toISOString() });
  } catch {
    // Return defaults on error
    return NextResponse.json({
      zonen: ZONE_DEFAULTS,
      generatedAt: new Date().toISOString(),
      mock: true,
    });
  }
}
