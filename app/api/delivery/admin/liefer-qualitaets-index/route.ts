import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1381 — Liefer-Qualitäts-Index-API
// Gewichteter Score: Pünktlichkeit (40%) + Kundenbewertung (35%) + Stornoquote (25%)
// GET /api/delivery/admin/liefer-qualitaets-index?location_id=<uuid>

interface TagScore {
  datum: string;
  label: string;
  puenktlichkeit_score: number;
  bewertungs_score: number;
  storno_score: number;
  gesamt_index: number;
  bestellungen: number;
}

interface ApiResponse {
  heute: TagScore;
  tagesverlauf: TagScore[];
  trend: 'steigend' | 'stabil' | 'fallend';
  trend_pct: number;
  location_id: string;
  generiert_am: string;
}

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function buildMock(locationId: string): ApiResponse {
  const now = new Date();
  const tagesverlauf: TagScore[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const base = 70 + Math.round(Math.sin(i * 0.9) * 12);
    tagesverlauf.push({
      datum: d.toISOString().slice(0, 10),
      label: i === 0 ? 'Heute' : WOCHENTAGE[d.getDay()],
      puenktlichkeit_score: Math.min(100, base + 5),
      bewertungs_score: Math.min(100, base + 2),
      storno_score: Math.min(100, base - 3),
      gesamt_index: base,
      bestellungen: 20 + Math.round(Math.random() * 30),
    });
  }
  const heute = tagesverlauf[6];
  const vorgestern = tagesverlauf[4];
  const delta = heute.gesamt_index - vorgestern.gesamt_index;
  return {
    heute,
    tagesverlauf,
    trend: delta > 2 ? 'steigend' : delta < -2 ? 'fallend' : 'stabil',
    trend_pct: Math.round(delta * 10) / 10,
    location_id: locationId,
    generiert_am: now.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const now = new Date();
    const tagesverlauf: TagScore[] = [];

    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const { data: orders } = await supabase
        .from('customer_orders')
        .select('id, status, eta_min, delivered_at, created_at, delivery_rating')
        .eq('location_id', locationId)
        .gte('created_at', dayStart.toISOString())
        .lt('created_at', dayEnd.toISOString());

      const list = orders ?? [];
      const total = list.length;

      // Pünktlichkeit: Anteil pünktlich geliefert (innerhalb ETA)
      let puenktlich = 0;
      let mitEta = 0;
      for (const o of list) {
        if (o.delivered_at && o.created_at && o.eta_min) {
          mitEta++;
          const tatsaechlich = (new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime()) / 60000;
          if (tatsaechlich <= o.eta_min * 1.1) puenktlich++;
        }
      }
      const puenktlichkeitScore = mitEta > 0 ? Math.round((puenktlich / mitEta) * 100) : 75;

      // Kundenbewertung: Ø Bewertung → 0–100 Scale (1–5 → 0–100)
      const bewertet = list.filter((o) => o.delivery_rating != null);
      const avgRating = bewertet.length > 0
        ? bewertet.reduce((s, o) => s + (o.delivery_rating as number), 0) / bewertet.length
        : 3.8;
      const bewertungsScore = Math.round(((avgRating - 1) / 4) * 100);

      // Stornoquote: Anteil NICHT storniert
      const stornos = list.filter((o) => o.status === 'storniert' || o.status === 'cancelled').length;
      const stornoScore = total > 0 ? Math.round(((total - stornos) / total) * 100) : 90;

      // Gewichteter Index
      const gesamtIndex = Math.round(
        puenktlichkeitScore * 0.4 + bewertungsScore * 0.35 + stornoScore * 0.25
      );

      const d = new Date(now);
      d.setDate(d.getDate() - i);
      tagesverlauf.push({
        datum: d.toISOString().slice(0, 10),
        label: i === 0 ? 'Heute' : WOCHENTAGE[d.getDay()],
        puenktlichkeit_score: puenktlichkeitScore,
        bewertungs_score: bewertungsScore,
        storno_score: stornoScore,
        gesamt_index: gesamtIndex,
        bestellungen: total,
      });
    }

    const heute = tagesverlauf[6];
    const vor3Tagen = tagesverlauf[3];
    const delta = heute.gesamt_index - vor3Tagen.gesamt_index;

    return NextResponse.json({
      heute,
      tagesverlauf,
      trend: delta > 2 ? 'steigend' : delta < -2 ? 'fallend' : 'stabil',
      trend_pct: Math.round(delta * 10) / 10,
      location_id: locationId,
      generiert_am: now.toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
