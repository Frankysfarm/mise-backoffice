/**
 * GET /api/delivery/admin/fahrer-einkommens-transparenz?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2821 — Fahrer-Einkommens-Transparenz-API
 * Heutiges Einkommen je Fahrer (Basis + Touren-Bonus + Trinkgeld); Ampel grün/gelb/rot; Alert <50% Tagesziel;
 * Trend vs. gestern; driver_id-Modus; Multi-Tenant; Supabase+Mock.
 *
 * Response: { location_id, fahrer: FahrerEinkommen[], team_durchschnitt, alert_count, generiert_am }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Ampel = 'gruen' | 'gelb' | 'rot';
export type Trend = 'steigend' | 'fallend' | 'stabil';

const TAGESZIEL = 80; // €

export interface FahrerEinkommen {
  fahrer_id: string;
  fahrer_name: string;
  einkommen_heute: number;
  basis: number;
  bonus: number;
  trinkgeld: number;
  touren_heute: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  rang: number;
}

export interface FahrerEinkommensAntwort {
  location_id: string;
  fahrer: FahrerEinkommen[];
  team_durchschnitt: number;
  tagesziel: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(einkommen: number): Ampel {
  const pct = einkommen / TAGESZIEL;
  if (pct >= 1.0) return 'gruen';
  if (pct >= 0.5) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, gestern: number): { trend: Trend; delta: number } {
  const delta = Math.round((heute - gestern) * 100) / 100;
  if (delta > 2) return { trend: 'steigend', delta };
  if (delta < -2) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: Omit<FahrerEinkommen, 'rang'>[] = [
  {
    fahrer_id: 'mock-f1',
    fahrer_name: 'Max Müller',
    einkommen_heute: 95.40,
    basis: 60.00,
    bonus: 25.00,
    trinkgeld: 10.40,
    touren_heute: 8,
    trend: 'steigend',
    trend_delta: 12.50,
    ampel: 'gruen',
  },
  {
    fahrer_id: 'mock-f2',
    fahrer_name: 'Sara Koch',
    einkommen_heute: 72.80,
    basis: 52.00,
    bonus: 15.00,
    trinkgeld: 5.80,
    touren_heute: 6,
    trend: 'stabil',
    trend_delta: 0.00,
    ampel: 'gelb',
  },
  {
    fahrer_id: 'mock-f3',
    fahrer_name: 'Tim Becker',
    einkommen_heute: 38.20,
    basis: 30.00,
    bonus: 5.00,
    trinkgeld: 3.20,
    touren_heute: 3,
    trend: 'fallend',
    trend_delta: -15.60,
    ampel: 'rot',
  },
  {
    fahrer_id: 'mock-f4',
    fahrer_name: 'Lisa Fuchs',
    einkommen_heute: 110.00,
    basis: 70.00,
    bonus: 30.00,
    trinkgeld: 10.00,
    touren_heute: 10,
    trend: 'steigend',
    trend_delta: 22.00,
    ampel: 'gruen',
  },
];

function buildMock(locationId: string, driverId?: string | null): FahrerEinkommensAntwort {
  const base = driverId
    ? MOCK_FAHRER.filter(f => f.fahrer_id === driverId)
    : MOCK_FAHRER;
  const sorted = [...base].sort((a, b) => b.einkommen_heute - a.einkommen_heute);
  const fahrerListe: FahrerEinkommen[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
  const team_durchschnitt =
    fahrerListe.length > 0
      ? Math.round((fahrerListe.reduce((s, f) => s + f.einkommen_heute, 0) / fahrerListe.length) * 100) / 100
      : 0;
  return {
    location_id: locationId,
    fahrer: fahrerListe,
    team_durchschnitt,
    tagesziel: TAGESZIEL,
    alert_count: fahrerListe.filter(f => f.ampel === 'rot').length,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }
  const driverId = req.nextUrl.searchParams.get('driver_id');

  try {
    const sb = await createClient();

    const driversQuery = sb
      .from('profiles')
      .select('id, full_name')
      .eq('location_id', locationId)
      .eq('role', 'driver');
    if (driverId) driversQuery.eq('id', driverId);

    const { data: drivers, error: driversErr } = await driversQuery;
    if (driversErr || !drivers || drivers.length === 0) throw new Error('no_drivers');

    const jetzt = new Date();
    const heuteStart = new Date(jetzt);
    heuteStart.setHours(0, 0, 0, 0);
    const gesternStart = new Date(heuteStart.getTime() - 24 * 60 * 60 * 1000);
    const gesternEnd = new Date(heuteStart.getTime());

    type BatchRow = {
      driver_id: string;
      base_pay: number | null;
      bonus_pay: number | null;
      tip_amount: number | null;
      status: string;
    };

    const unsorted: Omit<FahrerEinkommen, 'rang'>[] = await Promise.all(
      (drivers as { id: string; full_name: string | null }[]).map(async (d) => {
        const { data: batchesHeute } = await sb
          .from('mise_delivery_batches')
          .select('driver_id, base_pay, bonus_pay, tip_amount, status')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .gte('created_at', heuteStart.toISOString())
          .lt('created_at', jetzt.toISOString())
          .eq('status', 'completed');

        const { data: batchesGestern } = await sb
          .from('mise_delivery_batches')
          .select('driver_id, base_pay, bonus_pay, tip_amount, status')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .gte('created_at', gesternStart.toISOString())
          .lt('created_at', gesternEnd.toISOString())
          .eq('status', 'completed');

        const calcEinkommen = (rows: BatchRow[] | null) => {
          if (!rows || rows.length === 0) return { total: 0, basis: 0, bonus: 0, trinkgeld: 0 };
          const basis = rows.reduce((s, r) => s + (r.base_pay ?? 0), 0);
          const bonus = rows.reduce((s, r) => s + (r.bonus_pay ?? 0), 0);
          const trinkgeld = rows.reduce((s, r) => s + (r.tip_amount ?? 0), 0);
          return {
            total: Math.round((basis + bonus + trinkgeld) * 100) / 100,
            basis: Math.round(basis * 100) / 100,
            bonus: Math.round(bonus * 100) / 100,
            trinkgeld: Math.round(trinkgeld * 100) / 100,
          };
        };

        const heute = calcEinkommen(batchesHeute as BatchRow[] | null);
        const gestern = calcEinkommen(batchesGestern as BatchRow[] | null);
        const { trend, delta } = trendVon(heute.total, gestern.total);

        return {
          fahrer_id: d.id,
          fahrer_name: d.full_name ?? 'Fahrer',
          einkommen_heute: heute.total,
          basis: heute.basis,
          bonus: heute.bonus,
          trinkgeld: heute.trinkgeld,
          touren_heute: batchesHeute?.length ?? 0,
          trend,
          trend_delta: delta,
          ampel: ampelVon(heute.total),
        };
      })
    );

    const sorted = [...unsorted].sort((a, b) => b.einkommen_heute - a.einkommen_heute);
    const fahrerListe: FahrerEinkommen[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));

    const team_durchschnitt =
      fahrerListe.length > 0
        ? Math.round(
            (fahrerListe.reduce((s, f) => s + f.einkommen_heute, 0) / fahrerListe.length) * 100
          ) / 100
        : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer: fahrerListe,
      team_durchschnitt,
      tagesziel: TAGESZIEL,
      alert_count: fahrerListe.filter(f => f.ampel === 'rot').length,
      generiert_am: jetzt.toISOString(),
    } satisfies FahrerEinkommensAntwort);
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
