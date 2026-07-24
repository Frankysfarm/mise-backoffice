/**
 * GET /api/delivery/admin/fahrer-kosten-pro-km?location_id=<uuid>
 *
 * Phase 3618 — Fahrer-Kosten-pro-km-API
 * Kosten pro km (€/km) je Fahrer letzte 30 Tage; Rang 1=niedrigste Kosten=bester;
 * Ampel grün(Top-25%)/gelb(Mitte-50%)/rot(Bottom-25%); Alert Bottom-25%; Mock-Fallback.
 *
 * Response: { location_id, fahrer: FahrerKostenRow[], team_avg_kosten, alert_count, generiert_am }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Ampel = 'gruen' | 'gelb' | 'rot';

export interface FahrerKostenRow {
  fahrer_id: string;
  fahrer_name: string;
  kosten_pro_km: number;
  gesamt_km: number;
  gesamt_kosten: number;
  rank_delta: number;
  ampel: Ampel;
  rang: number;
}

export interface FahrerKostenAntwort {
  location_id: string;
  fahrer: FahrerKostenRow[];
  team_avg_kosten: number;
  alert_count: number;
  generiert_am: string;
}

const MOCK_FAHRER: Omit<FahrerKostenRow, 'rang' | 'ampel'>[] = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Julia Fischer', kosten_pro_km: 0.28, gesamt_km: 412, gesamt_kosten: 115.36, rank_delta: -1 },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sara Koch', kosten_pro_km: 0.31, gesamt_km: 388, gesamt_kosten: 120.28, rank_delta: 0 },
  { fahrer_id: 'mock-f3', fahrer_name: 'Max Müller', kosten_pro_km: 0.35, gesamt_km: 520, gesamt_kosten: 182.00, rank_delta: 1 },
  { fahrer_id: 'mock-f4', fahrer_name: 'Tim Becker', kosten_pro_km: 0.42, gesamt_km: 601, gesamt_kosten: 252.42, rank_delta: 2 },
];

function computeAmpel(rang: number, total: number): Ampel {
  const pct = rang / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

function mockResponse(locationId: string): FahrerKostenAntwort {
  const sorted = [...MOCK_FAHRER].sort((a, b) => a.kosten_pro_km - b.kosten_pro_km);
  const total = sorted.length;
  const fahrer: FahrerKostenRow[] = sorted.map((f, i) => ({
    ...f,
    rang: i + 1,
    ampel: computeAmpel(i + 1, total),
  }));
  const team_avg_kosten =
    total > 0
      ? Math.round((fahrer.reduce((s, f) => s + f.kosten_pro_km, 0) / total) * 1000) / 1000
      : 0;
  const alert_count = fahrer.filter(f => f.ampel === 'rot').length;
  return { location_id: locationId, fahrer, team_avg_kosten, alert_count, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? '';

  try {
    const supabase = await createClient();
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceIso = since.toISOString();

    const { data: drivers } = await supabase
      .from('employees')
      .select('id, vorname, nachname')
      .eq('location_id', locationId)
      .eq('kann_ausliefern', true)
      .eq('aktiv', true);

    if (!drivers || drivers.length === 0) {
      return NextResponse.json(mockResponse(locationId));
    }

    const { data: batches } = await supabase
      .from('delivery_batches')
      .select('fahrer_id, distanz_km, fahrer_kosten')
      .eq('location_id', locationId)
      .gte('created_at', sinceIso)
      .not('fahrer_id', 'is', null);

    if (!batches || batches.length === 0) {
      return NextResponse.json(mockResponse(locationId));
    }

    const driverMap = new Map<string, { km: number; kosten: number; name: string }>();
    for (const d of drivers) {
      driverMap.set(d.id, { km: 0, kosten: 0, name: `${d.vorname} ${d.nachname[0]}.` });
    }
    for (const b of batches) {
      if (!b.fahrer_id || !driverMap.has(b.fahrer_id)) continue;
      const entry = driverMap.get(b.fahrer_id)!;
      entry.km += b.distanz_km ?? 0;
      entry.kosten += b.fahrer_kosten ?? 0;
    }

    const rows: Omit<FahrerKostenRow, 'rang' | 'ampel'>[] = [];
    for (const [id, { km, kosten, name }] of driverMap.entries()) {
      if (km <= 0) continue;
      rows.push({
        fahrer_id: id,
        fahrer_name: name,
        kosten_pro_km: Math.round((kosten / km) * 1000) / 1000,
        gesamt_km: Math.round(km * 10) / 10,
        gesamt_kosten: Math.round(kosten * 100) / 100,
        rank_delta: 0,
      });
    }

    if (rows.length === 0) {
      return NextResponse.json(mockResponse(locationId));
    }

    const sorted = rows.sort((a, b) => a.kosten_pro_km - b.kosten_pro_km);
    const total = sorted.length;
    const fahrer: FahrerKostenRow[] = sorted.map((f, i) => ({
      ...f,
      rang: i + 1,
      ampel: computeAmpel(i + 1, total),
    }));
    const team_avg_kosten =
      Math.round((fahrer.reduce((s, f) => s + f.kosten_pro_km, 0) / total) * 1000) / 1000;
    const alert_count = fahrer.filter(f => f.ampel === 'rot').length;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_avg_kosten,
      alert_count,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerKostenAntwort);
  } catch {
    return NextResponse.json(mockResponse(locationId));
  }
}
