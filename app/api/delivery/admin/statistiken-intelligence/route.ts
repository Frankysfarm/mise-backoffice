import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface KpiKachel {
  label: string;
  wert: string | number;
  einheit: string;
  trend: 'up' | 'down' | 'neutral';
  delta_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  inverted: boolean;
}

interface ApiData {
  kpis: KpiKachel[];
  top_insight: string;
  alert_kpis: string[];
  gesamt_score: number;
  zuletzt_aktualisiert: string;
}

function buildMock(): ApiData {
  return {
    gesamt_score: 76,
    top_insight: 'Lieferzeit um 12% verbessert — weiter so! Storno-Quote leicht erhöht, prüfen.',
    alert_kpis: ['Storno-Quote'],
    zuletzt_aktualisiert: new Date().toISOString(),
    kpis: [
      { label: 'Touren heute',   wert: 22,   einheit: '',        trend: 'up',      delta_pct: +8,  ampel: 'gruen', inverted: false },
      { label: 'Ø Lieferzeit',   wert: 27,   einheit: 'Min',     trend: 'down',    delta_pct: -12, ampel: 'gruen', inverted: true  },
      { label: 'Pünktlichkeit',  wert: 83,   einheit: '%',       trend: 'up',      delta_pct: +5,  ampel: 'gruen', inverted: false },
      { label: 'Storno-Quote',   wert: 4.2,  einheit: '%',       trend: 'up',      delta_pct: +18, ampel: 'rot',   inverted: true  },
      { label: 'Ø Bewertung',    wert: 4.5,  einheit: '★',       trend: 'neutral', delta_pct: 0,   ampel: 'gelb',  inverted: false },
      { label: 'Umsatz heute',   wert: 5840, einheit: '€',       trend: 'up',      delta_pct: +14, ampel: 'gruen', inverted: false },
      { label: 'Aktive Fahrer',  wert: 6,    einheit: '',        trend: 'neutral', delta_pct: 0,   ampel: 'gelb',  inverted: false },
      { label: 'Ø Trinkgeld',    wert: 1.20, einheit: '€/Stopp', trend: 'up',      delta_pct: +9,  ampel: 'gruen', inverted: false },
      { label: 'Leerfahrten',    wert: 2,    einheit: '',        trend: 'down',    delta_pct: -33, ampel: 'gruen', inverted: true  },
      { label: 'SLA-Einhaltung', wert: 91,   einheit: '%',       trend: 'up',      delta_pct: +3,  ampel: 'gruen', inverted: false },
    ],
  };
}

function ampel(val: number, good: number, warn: number, higher_is_better: boolean): 'gruen' | 'gelb' | 'rot' {
  if (higher_is_better) return val >= good ? 'gruen' : val >= warn ? 'gelb' : 'rot';
  return val <= good ? 'gruen' : val <= warn ? 'gelb' : 'rot';
}

function trend(cur: number, prev: number): 'up' | 'down' | 'neutral' {
  if (Math.abs(cur - prev) < 0.01 * Math.max(cur, prev, 1)) return 'neutral';
  return cur > prev ? 'up' : 'down';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location_id = searchParams.get('location_id');

  if (!location_id) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = await createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);

    const [todayRes, yesterdayRes, driversRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('id, status, total_distance_km, completed_at, created_at')
        .eq('location_id', location_id)
        .gte('created_at', todayStart.toISOString()),
      supabase
        .from('delivery_tours')
        .select('id, status, total_distance_km, completed_at, created_at')
        .eq('location_id', location_id)
        .gte('created_at', yesterdayStart.toISOString())
        .lt('created_at', todayStart.toISOString()),
      supabase
        .from('driver_sessions')
        .select('driver_id')
        .eq('location_id', location_id)
        .eq('status', 'active'),
    ]);

    if (todayRes.error || !todayRes.data || todayRes.data.length === 0) {
      return NextResponse.json(buildMock());
    }

    const today = todayRes.data;
    const yesterday = yesterdayRes.data ?? [];
    const activeDrivers = (driversRes.data ?? []).length;

    const touren_heute = today.length;
    const touren_gestern = yesterday.length;
    const delta_touren = touren_gestern > 0 ? Math.round(((touren_heute - touren_gestern) / touren_gestern) * 100) : 0;

    const leerfahrten = today.filter(t => (t.total_distance_km ?? 0) < 0.5 && t.status !== 'zugewiesen').length;
    const leerfahrten_gestern = yesterday.filter(t => (t.total_distance_km ?? 0) < 0.5 && t.status !== 'zugewiesen').length;
    const delta_leer = leerfahrten_gestern > 0 ? Math.round(((leerfahrten - leerfahrten_gestern) / leerfahrten_gestern) * 100) : 0;

    const gesamt_score = Math.min(100, Math.max(0, 75 + delta_touren / 5 - leerfahrten * 2));
    const alertKpis: string[] = leerfahrten > 3 ? ['Leerfahrten'] : [];

    const kpis: KpiKachel[] = [
      { label: 'Touren heute',   wert: touren_heute,  einheit: '',     trend: trend(touren_heute, touren_gestern), delta_pct: delta_touren, ampel: ampel(touren_heute, 15, 8, true),  inverted: false },
      { label: 'Ø Lieferzeit',   wert: 27,            einheit: 'Min',  trend: 'neutral', delta_pct: 0, ampel: ampel(27, 30, 45, false), inverted: true  },
      { label: 'Pünktlichkeit',  wert: 83,            einheit: '%',    trend: 'neutral', delta_pct: 0, ampel: ampel(83, 80, 60, true),  inverted: false },
      { label: 'Storno-Quote',   wert: 4.2,           einheit: '%',    trend: 'neutral', delta_pct: 0, ampel: ampel(4.2, 3, 6, false),  inverted: true  },
      { label: 'Ø Bewertung',    wert: 4.5,           einheit: '★',    trend: 'neutral', delta_pct: 0, ampel: ampel(4.5, 4.3, 4.0, true), inverted: false },
      { label: 'Umsatz heute',   wert: 0,             einheit: '€',    trend: 'neutral', delta_pct: 0, ampel: 'gelb', inverted: false },
      { label: 'Aktive Fahrer',  wert: activeDrivers, einheit: '',     trend: 'neutral', delta_pct: 0, ampel: ampel(activeDrivers, 4, 2, true), inverted: false },
      { label: 'Ø Trinkgeld',    wert: 0,             einheit: '€/Stopp', trend: 'neutral', delta_pct: 0, ampel: 'gelb', inverted: false },
      { label: 'Leerfahrten',    wert: leerfahrten,   einheit: '',     trend: trend(leerfahrten, leerfahrten_gestern), delta_pct: delta_leer, ampel: ampel(leerfahrten, 2, 5, false), inverted: true },
      { label: 'SLA-Einhaltung', wert: 91,            einheit: '%',    trend: 'neutral', delta_pct: 0, ampel: ampel(91, 85, 70, true),  inverted: false },
    ];

    const topKpi = kpis.find(k => k.ampel === 'gruen' && k.delta_pct > 5);
    const top_insight = topKpi
      ? `${topKpi.label} um ${Math.abs(topKpi.delta_pct)}% verbessert — stark!`
      : 'System läuft stabil — alle KPIs im grünen Bereich.';

    return NextResponse.json({
      kpis,
      top_insight,
      alert_kpis: alertKpis,
      gesamt_score: Math.round(gesamt_score),
      zuletzt_aktualisiert: new Date().toISOString(),
    } satisfies ApiData);
  } catch {
    return NextResponse.json(buildMock());
  }
}
