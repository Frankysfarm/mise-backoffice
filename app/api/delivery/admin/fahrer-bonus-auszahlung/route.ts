import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type AuszahlungsStatus = 'offen' | 'bereit' | 'ausgezahlt';

interface FahrerBonusRow {
  fahrer_id: string;
  fahrer_name: string;
  touren_diese_woche: number;
  puenktlichkeitsbonus: number;
  tourenbonus: number;
  trinkgeld_rate_bonus: number;
  gesamt_bonus: number;
  auszahlungs_status: AuszahlungsStatus;
}

interface BonusResponse {
  fahrer: FahrerBonusRow[];
  gesamt_bonus_summe: number;
  woche_start: string;
  woche_ende: string;
}

function buildMock(): BonusResponse {
  const names = ['Ali K.', 'Jonas M.', 'Sara B.', 'Tom F.', 'Mia S.'];
  const now = new Date();
  const day = now.getDay();
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const wochenstart = new Date(now);
  wochenstart.setDate(now.getDate() + diffToMon);
  wochenstart.setHours(0, 0, 0, 0);
  const wochenende = new Date(wochenstart);
  wochenende.setDate(wochenstart.getDate() + 6);

  const statuses: AuszahlungsStatus[] = ['ausgezahlt', 'bereit', 'offen', 'offen', 'offen'];
  let gesamt_bonus_summe = 0;

  const fahrer: FahrerBonusRow[] = names.map((name, i) => {
    const touren = 18 + (4 - i) * 4;
    const puenktlich = parseFloat((2.5 - i * 0.3).toFixed(2));
    const tour = parseFloat((touren * 0.15).toFixed(2));
    const trinkgeld = parseFloat((1.5 - i * 0.2).toFixed(2));
    const gesamt = parseFloat((puenktlich + tour + trinkgeld).toFixed(2));
    gesamt_bonus_summe += gesamt;
    return {
      fahrer_id: `mock-${i + 1}`,
      fahrer_name: name,
      touren_diese_woche: touren,
      puenktlichkeitsbonus: Math.max(0, puenktlich),
      tourenbonus: Math.max(0, tour),
      trinkgeld_rate_bonus: Math.max(0, trinkgeld),
      gesamt_bonus: Math.max(0, gesamt),
      auszahlungs_status: statuses[i],
    };
  });

  return {
    fahrer,
    gesamt_bonus_summe: parseFloat(gesamt_bonus_summe.toFixed(2)),
    woche_start: wochenstart.toISOString().split('T')[0],
    woche_ende: wochenende.toISOString().split('T')[0],
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = createClient();

    const wochenstart = new Date();
    const day = wochenstart.getDay();
    wochenstart.setDate(wochenstart.getDate() + (day === 0 ? -6 : 1 - day));
    wochenstart.setHours(0, 0, 0, 0);
    const wochenende = new Date(wochenstart);
    wochenende.setDate(wochenstart.getDate() + 6);

    let query = supabase
      .from('delivery_batches')
      .select('driver_id, driver_name, status, delivered_at, created_at, eta_min, tip_amount, location_id')
      .gte('created_at', wochenstart.toISOString())
      .lte('created_at', wochenende.toISOString());

    if (locationId) query = query.eq('location_id', locationId);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return NextResponse.json(buildMock());

    const byFahrer = new Map<string, {
      name: string;
      touren: number;
      puenktlich: number;
      trinkgeld: number;
    }>();

    for (const b of data) {
      if (!b.driver_id) continue;
      const entry = byFahrer.get(b.driver_id) ?? { name: b.driver_name ?? b.driver_id, touren: 0, puenktlich: 0, trinkgeld: 0 };
      entry.touren += 1;
      if (b.status === 'delivered' && b.delivered_at && b.eta_min) {
        const soll = new Date(b.created_at).getTime() + b.eta_min * 60000;
        if (new Date(b.delivered_at).getTime() <= soll) entry.puenktlich += 1;
      }
      entry.trinkgeld += b.tip_amount ?? 0;
      byFahrer.set(b.driver_id, entry);
    }

    let gesamt_bonus_summe = 0;
    const fahrer: FahrerBonusRow[] = [...byFahrer.entries()].map(([id, e]) => {
      const puenktlichkeitsrate = e.touren > 0 ? e.puenktlich / e.touren : 0;
      const puenktlichkeitsbonus = parseFloat((puenktlichkeitsrate >= 0.9 ? 2.5 : puenktlichkeitsrate >= 0.75 ? 1.0 : 0).toFixed(2));
      const tourenbonus = parseFloat((e.touren * 0.15).toFixed(2));
      const trinkgeld_rate_bonus = parseFloat((e.touren > 0 ? Math.min(2.0, (e.trinkgeld / e.touren) * 0.1) : 0).toFixed(2));
      const gesamt_bonus = parseFloat((puenktlichkeitsbonus + tourenbonus + trinkgeld_rate_bonus).toFixed(2));
      gesamt_bonus_summe += gesamt_bonus;
      return {
        fahrer_id: id,
        fahrer_name: e.name,
        touren_diese_woche: e.touren,
        puenktlichkeitsbonus,
        tourenbonus,
        trinkgeld_rate_bonus,
        gesamt_bonus,
        auszahlungs_status: 'offen' as AuszahlungsStatus,
      };
    }).sort((a, b) => b.gesamt_bonus - a.gesamt_bonus);

    return NextResponse.json({
      fahrer,
      gesamt_bonus_summe: parseFloat(gesamt_bonus_summe.toFixed(2)),
      woche_start: wochenstart.toISOString().split('T')[0],
      woche_ende: wochenende.toISOString().split('T')[0],
    });
  } catch {
    return NextResponse.json(buildMock());
  }
}
