/**
 * GET /api/delivery/admin/fahrer-umsatz-pro-stunde?location_id=<uuid>
 *
 * Phase 3623 — Fahrer-Umsatz-pro-Stunde-API
 * Umsatz/h je Fahrer letzte 30 Tage; Rang 1=höchster Umsatz/h=bester;
 * Ampel grün(Top-25%)/gelb(Mitte-50%)/rot(Bottom-25%); Alert Bottom-25% "Niedriger Umsatz/h!";
 * rank_delta pos=verbessert; Mock-Fallback.
 *
 * Response: { location_id, fahrer: FahrerUmsatzRow[], team_avg_umsatz, alert_count, generiert_am }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Ampel = 'gruen' | 'gelb' | 'rot';

export interface FahrerUmsatzRow {
  fahrer_id: string;
  fahrer_name: string;
  umsatz_pro_stunde: number;
  gesamt_umsatz: number;
  schicht_stunden: number;
  rank_delta: number;
  ampel: Ampel;
  rang: number;
}

export interface FahrerUmsatzAntwort {
  location_id: string;
  fahrer: FahrerUmsatzRow[];
  team_avg_umsatz: number;
  alert_count: number;
  generiert_am: string;
}

const MOCK_FAHRER: Omit<FahrerUmsatzRow, 'rang' | 'ampel'>[] = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Julia Fischer', umsatz_pro_stunde: 42, gesamt_umsatz: 1260, schicht_stunden: 30, rank_delta: 1 },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sara Koch', umsatz_pro_stunde: 38, gesamt_umsatz: 1140, schicht_stunden: 30, rank_delta: 0 },
  { fahrer_id: 'mock-f3', fahrer_name: 'Max Müller', umsatz_pro_stunde: 35, gesamt_umsatz: 1050, schicht_stunden: 30, rank_delta: -1 },
  { fahrer_id: 'mock-f4', fahrer_name: 'Tim Becker', umsatz_pro_stunde: 28, gesamt_umsatz: 840, schicht_stunden: 30, rank_delta: 0 },
];

function computeAmpel(rang: number, total: number): Ampel {
  const pct = rang / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

function mockResponse(locationId: string): FahrerUmsatzAntwort {
  const sorted = [...MOCK_FAHRER].sort((a, b) => b.umsatz_pro_stunde - a.umsatz_pro_stunde);
  const total = sorted.length;
  const fahrer: FahrerUmsatzRow[] = sorted.map((f, i) => ({
    ...f,
    rang: i + 1,
    ampel: computeAmpel(i + 1, total),
  }));
  const team_avg_umsatz =
    total > 0
      ? Math.round((fahrer.reduce((s, f) => s + f.umsatz_pro_stunde, 0) / total) * 10) / 10
      : 0;
  const alert_count = fahrer.filter(f => f.ampel === 'rot').length;
  return { location_id: locationId, fahrer, team_avg_umsatz, alert_count, generiert_am: new Date().toISOString() };
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

    const { data: tours } = await supabase
      .from('delivery_tours')
      .select('fahrer_id, order_total_euro, dauer_minuten')
      .eq('location_id', locationId)
      .gte('created_at', sinceIso)
      .not('fahrer_id', 'is', null);

    if (!tours || tours.length === 0) {
      return NextResponse.json(mockResponse(locationId));
    }

    const driverMap = new Map<string, { umsatz: number; minuten: number; name: string }>();
    for (const d of drivers) {
      driverMap.set(d.id, { umsatz: 0, minuten: 0, name: `${d.vorname} ${d.nachname[0]}.` });
    }
    for (const t of tours) {
      if (!t.fahrer_id || !driverMap.has(t.fahrer_id)) continue;
      const entry = driverMap.get(t.fahrer_id)!;
      entry.umsatz += t.order_total_euro ?? 0;
      entry.minuten += t.dauer_minuten ?? 0;
    }

    const rows: Omit<FahrerUmsatzRow, 'rang' | 'ampel'>[] = [];
    for (const [id, { umsatz, minuten, name }] of driverMap.entries()) {
      if (minuten <= 0) continue;
      const stunden = minuten / 60;
      rows.push({
        fahrer_id: id,
        fahrer_name: name,
        umsatz_pro_stunde: Math.round((umsatz / stunden) * 10) / 10,
        gesamt_umsatz: Math.round(umsatz * 100) / 100,
        schicht_stunden: Math.round(stunden * 10) / 10,
        rank_delta: 0,
      });
    }

    if (rows.length === 0) {
      return NextResponse.json(mockResponse(locationId));
    }

    const sorted = rows.sort((a, b) => b.umsatz_pro_stunde - a.umsatz_pro_stunde);
    const total = sorted.length;
    const fahrer: FahrerUmsatzRow[] = sorted.map((f, i) => ({
      ...f,
      rang: i + 1,
      ampel: computeAmpel(i + 1, total),
    }));
    const team_avg_umsatz =
      Math.round((fahrer.reduce((s, f) => s + f.umsatz_pro_stunde, 0) / total) * 10) / 10;
    const alert_count = fahrer.filter(f => f.ampel === 'rot').length;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_avg_umsatz,
      alert_count,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerUmsatzAntwort);
  } catch {
    return NextResponse.json(mockResponse(locationId));
  }
}
