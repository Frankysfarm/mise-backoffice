import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1242 — Küchen-Auslastungs-Prognose-API
// GET /api/delivery/admin/kuechen-auslastungs-prognose?location_id=<uuid>
// Erwartete Bestellungen nächste 30/60 Min basierend auf Wochentag×Stunde-Pattern
// Mock-Fallback wenn keine DB-Daten

interface StundenSlot {
  stunde: number;
  erwartete_bestellungen: number;
  historischer_schnitt: number;
  auslastungs_level: 'ruhig' | 'normal' | 'hoch' | 'peak';
}

interface PrognoseResponse {
  naechste_30_min: StundenSlot;
  naechste_60_min: StundenSlot;
  jetzt_stunde: number;
  wochentag: number; // 0=So … 6=Sa
  prognose_qualitaet: 'hoch' | 'mittel' | 'gering';
  location_id: string;
  generiert_am: string;
}

function auslastungsLevel(bestellungen: number): StundenSlot['auslastungs_level'] {
  if (bestellungen >= 12) return 'peak';
  if (bestellungen >= 8) return 'hoch';
  if (bestellungen >= 4) return 'normal';
  return 'ruhig';
}

function buildMock(locationId: string): PrognoseResponse {
  const now = new Date();
  const stunde = now.getHours();
  const wochentag = now.getDay();

  // Simple pattern: lunch 12-14, dinner 18-21 are peak hours
  const peakHours: Record<number, number> = { 12: 14, 13: 16, 14: 12, 18: 10, 19: 15, 20: 14, 21: 11 };
  const baseVal = (h: number) => peakHours[h] ?? (h >= 11 && h <= 22 ? 6 : 2);

  const h30 = (stunde + 1) % 24;
  const h60 = (stunde + 2) % 24;

  const v30 = baseVal(h30);
  const v60 = baseVal(h60);

  return {
    naechste_30_min: {
      stunde: h30,
      erwartete_bestellungen: v30,
      historischer_schnitt: Math.round(v30 * 0.9),
      auslastungs_level: auslastungsLevel(v30),
    },
    naechste_60_min: {
      stunde: h60,
      erwartete_bestellungen: v60,
      historischer_schnitt: Math.round(v60 * 0.9),
      auslastungs_level: auslastungsLevel(v60),
    },
    jetzt_stunde: stunde,
    wochentag,
    prognose_qualitaet: 'gering',
    location_id: locationId,
    generiert_am: now.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  const now = new Date();
  const stunde = now.getHours();
  const wochentag = now.getDay();

  try {
    const supabase = await createClient();

    // Look at historical orders for this weekday × hour pattern (last 4 weeks)
    const fourWeeksAgo = new Date(now);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const { data: historicalOrders, error } = await supabase
      .from('customer_orders')
      .select('created_at')
      .eq('location_id', locationId)
      .gte('created_at', fourWeeksAgo.toISOString())
      .not('status', 'eq', 'CANCELLED');

    if (error || !historicalOrders || historicalOrders.length === 0) {
      return NextResponse.json(buildMock(locationId));
    }

    // Group by weekday × hour to get pattern
    const pattern: Record<string, number[]> = {};
    historicalOrders.forEach((o) => {
      const d = new Date(o.created_at);
      const key = `${d.getDay()}_${d.getHours()}`;
      if (!pattern[key]) pattern[key] = [];
      pattern[key].push(1);
    });

    const avgForSlot = (dow: number, h: number): number => {
      const key = `${dow}_${h}`;
      const entries = pattern[key];
      if (!entries || entries.length === 0) return 2;
      return Math.round(entries.length / 4); // avg over 4 weeks
    };

    const h30 = (stunde + 1) % 24;
    const h60 = (stunde + 2) % 24;

    const avg30 = avgForSlot(wochentag, h30);
    const avg60 = avgForSlot(wochentag, h60);

    // Today so far — current hour pace
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const { count: todayCount } = await supabase
      .from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString())
      .not('status', 'eq', 'CANCELLED');

    const qualitaet = historicalOrders.length >= 100 ? 'hoch' : historicalOrders.length >= 30 ? 'mittel' : 'gering';

    const response: PrognoseResponse = {
      naechste_30_min: {
        stunde: h30,
        erwartete_bestellungen: avg30,
        historischer_schnitt: avg30,
        auslastungs_level: auslastungsLevel(avg30),
      },
      naechste_60_min: {
        stunde: h60,
        erwartete_bestellungen: avg60,
        historischer_schnitt: avg60,
        auslastungs_level: auslastungsLevel(avg60),
      },
      jetzt_stunde: stunde,
      wochentag,
      prognose_qualitaet: qualitaet,
      location_id: locationId,
      generiert_am: now.toISOString(),
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
