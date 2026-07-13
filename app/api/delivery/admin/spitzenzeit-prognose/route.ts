import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1371 — Spitzenzeit-Prognose-API (Admin)
// GET: Nächste 4 Stunden: Bestell-Volumen-Prognose + Fahrer-Bedarf
// Basis: letzter 14-Tage-Durchschnitt für denselben Wochentag und Stundenslot
// Supabase + Mock-Fallback

export interface SpitzenzeitSlot {
  stunde: number;       // 0–23
  stunden_label: string;
  prognose_bestellungen: number;
  fahrer_bedarf: number;
  auslastungs_level: 'gering' | 'normal' | 'hoch' | 'peak';
  kapazitaet_pct: number; // 0–100, aktuelle Kapazität vs. Bedarf
}

export interface SpitzenzeitPrognoseResponse {
  slots: SpitzenzeitSlot[];
  peak_stunde: number | null;
  gesamt_prognose_4h: number;
  empfehlung: string;
  location_id: string;
  generiert_am: string;
}

function auslastungsLevel(bestellungen: number): SpitzenzeitSlot['auslastungs_level'] {
  if (bestellungen >= 20) return 'peak';
  if (bestellungen >= 12) return 'hoch';
  if (bestellungen >= 5) return 'normal';
  return 'gering';
}

function fahrerBedarf(bestellungen: number): number {
  return Math.max(1, Math.ceil(bestellungen / 4));
}

function stundenLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

function mockData(locationId: string, currentHour: number): SpitzenzeitPrognoseResponse {
  // Realistische Verteilung mit Mittagspeak ~12 und Abendpeak ~19
  const STUNDEN_PROFIL: Record<number, number> = {
    0: 1, 1: 0, 2: 0, 3: 0, 4: 0, 5: 1, 6: 2, 7: 3,
    8: 4, 9: 6, 10: 8, 11: 14, 12: 18, 13: 15, 14: 10, 15: 7,
    16: 6, 17: 9, 18: 16, 19: 22, 20: 19, 21: 13, 22: 7, 23: 3,
  };

  const slots: SpitzenzeitSlot[] = [];
  for (let i = 0; i < 4; i++) {
    const h = (currentHour + i) % 24;
    const prog = STUNDEN_PROFIL[h] ?? 5;
    const bedarf = fahrerBedarf(prog);
    slots.push({
      stunde: h,
      stunden_label: stundenLabel(h),
      prognose_bestellungen: prog,
      fahrer_bedarf: bedarf,
      auslastungs_level: auslastungsLevel(prog),
      kapazitaet_pct: Math.min(100, Math.round((bedarf / Math.max(bedarf, 3)) * 100)),
    });
  }

  const peak = slots.reduce((a, b) => (b.prognose_bestellungen > a.prognose_bestellungen ? b : a));
  const gesamt = slots.reduce((s, sl) => s + sl.prognose_bestellungen, 0);

  return {
    slots,
    peak_stunde: peak.prognose_bestellungen > 0 ? peak.stunde : null,
    gesamt_prognose_4h: gesamt,
    empfehlung: peak.auslastungs_level === 'peak'
      ? `Peak um ${stundenLabel(peak.stunde)} erwartet — ${peak.fahrer_bedarf} Fahrer bereitstellen`
      : `Normaler Betrieb — ${peak.fahrer_bedarf} Fahrer ausreichend`,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id') ?? 'default';

  const now = new Date();
  const currentHour = now.getUTCHours();

  try {
    const supabase = await createClient();

    // Letzter 14-Tage-Durchschnitt je Wochentag + Stundenbucket
    // Wochentag des heutigen Tages
    const todayDow = now.getUTCDay(); // 0=So, 1=Mo, ...

    // 14 Tage zurück
    const since = new Date(now);
    since.setUTCDate(since.getUTCDate() - 14);
    since.setUTCHours(0, 0, 0, 0);

    let q = supabase
      .from('customer_orders')
      .select('created_at')
      .gte('created_at', since.toISOString())
      .not('status', 'eq', 'storniert');
    if (locationId !== 'default') q = q.eq('location_id', locationId);
    const { data: orders } = await q;

    if (!orders || orders.length === 0) throw new Error('no data');

    // Aggregiere: Wie viele Bestellungen je (Wochentag, Stunde)?
    const buckets: Record<string, number> = {};
    const dayCounts: Record<number, number> = {}; // Wie oft jeder Wochentag in den 14 Tagen vorkommt

    for (const o of orders) {
      const d = new Date(o.created_at);
      const dow = d.getUTCDay();
      const h = d.getUTCHours();
      const key = `${dow}_${h}`;
      buckets[key] = (buckets[key] ?? 0) + 1;
      // Zähle Tage
    }

    // Berechne wie oft jeder Wochentag vorkommt (≈2 pro 14 Tage)
    for (let i = 0; i < 14; i++) {
      const d = new Date(since);
      d.setUTCDate(d.getUTCDate() + i);
      const dow = d.getUTCDay();
      dayCounts[dow] = (dayCounts[dow] ?? 0) + 1;
    }

    const slots: SpitzenzeitSlot[] = [];
    for (let i = 0; i < 4; i++) {
      const h = (currentHour + i) % 24;
      const key = `${todayDow}_${h}`;
      const gesamtSlot = buckets[key] ?? 0;
      const tage = dayCounts[todayDow] ?? 2;
      const prognose = Math.round(gesamtSlot / Math.max(tage, 1));
      const bedarf = fahrerBedarf(prognose);
      slots.push({
        stunde: h,
        stunden_label: stundenLabel(h),
        prognose_bestellungen: prognose,
        fahrer_bedarf: bedarf,
        auslastungs_level: auslastungsLevel(prognose),
        kapazitaet_pct: Math.min(100, Math.round((bedarf / Math.max(bedarf, 3)) * 100)),
      });
    }

    const peak = slots.reduce((a, b) => (b.prognose_bestellungen > a.prognose_bestellungen ? b : a));
    const gesamt = slots.reduce((s, sl) => s + sl.prognose_bestellungen, 0);

    return NextResponse.json({
      slots,
      peak_stunde: peak.prognose_bestellungen > 0 ? peak.stunde : null,
      gesamt_prognose_4h: gesamt,
      empfehlung: peak.auslastungs_level === 'peak'
        ? `Peak um ${stundenLabel(peak.stunde)} erwartet — ${peak.fahrer_bedarf} Fahrer bereitstellen`
        : `Normaler Betrieb — ${peak.fahrer_bedarf} Fahrer ausreichend`,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies SpitzenzeitPrognoseResponse);
  } catch {
    return NextResponse.json(mockData(locationId, currentHour));
  }
}
