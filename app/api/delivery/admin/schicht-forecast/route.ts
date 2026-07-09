/**
 * GET /api/delivery/admin/schicht-forecast
 *
 * Phase 976 — Schicht-Forecast-API
 * Prognose Bestellvolumen + benötigte Fahrer für nächste Schicht
 * basierend auf historischen Daten + Wochentag-Muster.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SchichtSlot {
  stunde: number;        // 0-23
  label: string;         // "10:00–11:00"
  bestellungen_prognose: number;
  fahrer_benoetigt: number;
  auslastung: 'niedrig' | 'mittel' | 'hoch' | 'peak';
}

interface SchichtForecast {
  naechste_schicht_start: string;   // ISO
  naechste_schicht_ende: string;    // ISO
  wochentag: string;
  bestellungen_gesamt_prognose: number;
  fahrer_benoetigt_max: number;
  fahrer_aktuell_geplant: number;
  fahrer_luecke: number;
  slots: SchichtSlot[];
  empfehlung: string;
  generiert_am: string;
}

function wochentagName(d: Date): string {
  return ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'][d.getDay()];
}

function auslastungLevel(bestellungen: number): SchichtSlot['auslastung'] {
  if (bestellungen >= 20) return 'peak';
  if (bestellungen >= 12) return 'hoch';
  if (bestellungen >= 6)  return 'mittel';
  return 'niedrig';
}

// Typischer Wochentag-Multiplikator relativ zu Di (Basis=1.0)
const WEEKDAY_FACTOR: Record<number, number> = {
  0: 1.25, // So
  1: 0.85, // Mo
  2: 1.00, // Di
  3: 1.05, // Mi
  4: 1.10, // Do
  5: 1.30, // Fr
  6: 1.40, // Sa
};

// Stunden-Profil-Basis (Bestellungen je Stunde für normale Last)
const HOUR_PROFILE: Record<number, number> = {
  10: 4,  11: 7,  12: 14, 13: 16,
  14: 10, 15: 6,  16: 5,  17: 8,
  18: 15, 19: 20, 20: 18, 21: 12,
  22: 6,  23: 3,
};

function buildMockForecast(locationId: string): SchichtForecast {
  const now = new Date();
  // Nächste Schicht = ab 17:00 heute, oder morgen 10:00 wenn nach 22:00
  const hour = now.getHours();
  const base = new Date(now);
  if (hour >= 22 || hour < 10) {
    base.setDate(base.getDate() + (hour >= 22 ? 1 : 0));
    base.setHours(10, 0, 0, 0);
  } else if (hour < 17) {
    base.setHours(17, 0, 0, 0);
  } else {
    base.setHours(hour + 1, 0, 0, 0);
  }

  const faktor = WEEKDAY_FACTOR[base.getDay()] ?? 1.0;
  const slots: SchichtSlot[] = [];
  let totalProg = 0;
  let maxFahrer = 0;

  for (let h = base.getHours(); h < Math.min(base.getHours() + 6, 24); h++) {
    const basisOrders = HOUR_PROFILE[h] ?? 3;
    const prognose = Math.round(basisOrders * faktor);
    const fahrerBen = Math.max(1, Math.ceil(prognose / 5));
    totalProg += prognose;
    maxFahrer = Math.max(maxFahrer, fahrerBen);
    slots.push({
      stunde: h,
      label: `${String(h).padStart(2, '0')}:00–${String(h + 1).padStart(2, '0')}:00`,
      bestellungen_prognose: prognose,
      fahrer_benoetigt: fahrerBen,
      auslastung: auslastungLevel(prognose),
    });
  }

  const geplant = Math.max(1, maxFahrer - 1);
  const luecke = Math.max(0, maxFahrer - geplant);
  const ende = new Date(base);
  ende.setHours(base.getHours() + 6, 0, 0, 0);

  let empfehlung = 'Schichtbesetzung ausreichend.';
  if (luecke >= 3) empfehlung = 'Dringend: Mindestens 3 Springer für Peak-Stunden einplanen.';
  else if (luecke >= 1) empfehlung = `${luecke} weitere Fahrer für Peak-Abdeckung empfohlen.`;

  return {
    naechste_schicht_start: base.toISOString(),
    naechste_schicht_ende: ende.toISOString(),
    wochentag: wochentagName(base),
    bestellungen_gesamt_prognose: totalProg,
    fahrer_benoetigt_max: maxFahrer,
    fahrer_aktuell_geplant: geplant,
    fahrer_luecke: luecke,
    slots,
    empfehlung,
    generiert_am: now.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id') ?? '';

  try {
    const supabase = await createClient();
    const now = new Date();
    const weekday = now.getDay();

    // Historische Bestellungen gleicher Wochentag letzte 4 Wochen, je Stunde
    const vierWochenAgo = new Date(now);
    vierWochenAgo.setDate(vierWochenAgo.getDate() - 28);

    const { data: historisch } = await supabase
      .from('orders')
      .select('created_at')
      .eq('location_id', locationId)
      .gte('created_at', vierWochenAgo.toISOString());

    if (!historisch || historisch.length === 0) {
      return NextResponse.json(buildMockForecast(locationId));
    }

    // Filtere nur gleiche Wochentage + nächste Schichtstunden
    const gleicheWT = historisch.filter((o: { created_at: string }) => {
      const d = new Date(o.created_at);
      return d.getDay() === weekday;
    });

    // Stunden-Aggregation
    const stundenMap: Record<number, number[]> = {};
    for (const o of gleicheWT) {
      const h = new Date(o.created_at).getHours();
      if (!stundenMap[h]) stundenMap[h] = [];
      stundenMap[h].push(1);
    }

    const base = new Date(now);
    const startH = now.getHours() >= 17 ? now.getHours() + 1 : 17;
    base.setHours(startH, 0, 0, 0);

    const faktor = WEEKDAY_FACTOR[base.getDay()] ?? 1.0;
    const slots: SchichtSlot[] = [];
    let totalProg = 0;
    let maxFahrer = 0;

    for (let h = startH; h < Math.min(startH + 6, 24); h++) {
      const werte = stundenMap[h] ?? [];
      const historAvg = werte.length > 0
        ? werte.length / Math.max(1, gleicheWT.length / 24)
        : (HOUR_PROFILE[h] ?? 4);
      const prognose = Math.max(0, Math.round(historAvg * faktor));
      const fahrerBen = Math.max(1, Math.ceil(prognose / 5));
      totalProg += prognose;
      maxFahrer = Math.max(maxFahrer, fahrerBen);
      slots.push({
        stunde: h,
        label: `${String(h).padStart(2, '0')}:00–${String(h + 1).padStart(2, '0')}:00`,
        bestellungen_prognose: prognose,
        fahrer_benoetigt: fahrerBen,
        auslastung: auslastungLevel(prognose),
      });
    }

    // Geplante Fahrer für Schicht
    const { data: geplantShifts } = await supabase
      .from('driver_shifts')
      .select('driver_id')
      .eq('location_id', locationId)
      .gte('start_time', base.toISOString())
      .lte('start_time', new Date(base.getTime() + 6 * 3600_000).toISOString());

    const geplant = geplantShifts?.length ?? Math.max(1, maxFahrer - 1);
    const luecke = Math.max(0, maxFahrer - geplant);
    const ende = new Date(base);
    ende.setHours(startH + 6, 0, 0, 0);

    let empfehlung = 'Schichtbesetzung ausreichend.';
    if (luecke >= 3) empfehlung = 'Dringend: Mindestens 3 Springer für Peak-Stunden einplanen.';
    else if (luecke >= 1) empfehlung = `${luecke} weitere Fahrer für Peak-Abdeckung empfohlen.`;

    return NextResponse.json({
      naechste_schicht_start: base.toISOString(),
      naechste_schicht_ende: ende.toISOString(),
      wochentag: wochentagName(base),
      bestellungen_gesamt_prognose: totalProg,
      fahrer_benoetigt_max: maxFahrer,
      fahrer_aktuell_geplant: geplant,
      fahrer_luecke: luecke,
      slots,
      empfehlung,
      generiert_am: now.toISOString(),
    } satisfies SchichtForecast);
  } catch {
    return NextResponse.json(buildMockForecast(locationId));
  }
}
