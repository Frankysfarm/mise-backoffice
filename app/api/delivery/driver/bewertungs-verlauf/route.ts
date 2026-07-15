/**
 * GET /api/delivery/driver/bewertungs-verlauf?driver_id=<uuid>
 *
 * Phase 1705 — Fahrer-Bewertungs-Verlauf-API
 * Letzte 5 Tour-Bewertungen des Fahrers + Ø-Score der letzten 7 Tage.
 * Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Bewertung {
  id: string;
  sterne: number;
  kommentar: string | null;
  erstellt_am: string;
  tour_id: string | null;
}

interface BewertungsVerlaufResponse {
  driver_id: string;
  letzte5: Bewertung[];
  avg_7_tage: number;
  anzahl_7_tage: number;
}

function buildMock(driverId: string): BewertungsVerlaufResponse {
  const seed = driverId.charCodeAt(0) || 65;
  const rnd = (s: number) => Math.min(5, Math.max(1, 3 + ((seed * s) % 3)));

  const comments = [
    'Sehr freundlich und pünktlich!',
    'Schnelle Lieferung, alles top.',
    null,
    'Essen war noch warm, danke!',
    null,
  ];

  const letzte5: Bewertung[] = Array.from({ length: 5 }, (_, i) => ({
    id: `mock-b-${i}`,
    sterne: rnd(i * 7 + 3),
    kommentar: comments[i] ?? null,
    erstellt_am: new Date(Date.now() - (i + 1) * 2 * 3600 * 1000).toISOString(),
    tour_id: `mock-t-${i}`,
  }));

  const avg7 = Math.round((letzte5.reduce((s, b) => s + b.sterne, 0) / letzte5.length) * 10) / 10;

  return {
    driver_id: driverId,
    letzte5,
    avg_7_tage: avg7,
    anzahl_7_tage: 5 + ((seed * 3) % 8),
  };
}

export async function GET(req: NextRequest) {
  const driverId = req.nextUrl.searchParams.get('driver_id');
  if (!driverId) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    // Load last 5 ratings
    const { data: rawBewertungen, error: e1 } = await (sb as any)
      .from('tour_ratings')
      .select('id, sterne, kommentar, created_at, tour_id')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (e1 || !rawBewertungen) {
      return NextResponse.json(buildMock(driverId));
    }

    // Load 7-day average
    const { data: raw7 } = await (sb as any)
      .from('tour_ratings')
      .select('sterne')
      .eq('driver_id', driverId)
      .gte('created_at', sevenDaysAgo);

    const letzte5: Bewertung[] = (rawBewertungen as Array<{
      id: string; sterne: number; kommentar: string | null; created_at: string; tour_id: string | null;
    }>).map(r => ({
      id: r.id,
      sterne: r.sterne,
      kommentar: r.kommentar,
      erstellt_am: r.created_at,
      tour_id: r.tour_id,
    }));

    const arr7 = (raw7 ?? []) as Array<{ sterne: number }>;
    const avg7 = arr7.length
      ? Math.round((arr7.reduce((sum, r) => sum + r.sterne, 0) / arr7.length) * 10) / 10
      : (letzte5.length ? Math.round((letzte5.reduce((s, b) => s + b.sterne, 0) / letzte5.length) * 10) / 10 : 0);

    const response: BewertungsVerlaufResponse = {
      driver_id: driverId,
      letzte5,
      avg_7_tage: avg7,
      anzahl_7_tage: arr7.length,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(buildMock(driverId));
  }
}
