/**
 * GET /api/delivery/admin/abgeschlossene-touren?location_id=<uuid>
 *
 * Phase 926 — Tour-Nachfass-Board Backend
 * Alle heute abgeschlossenen Touren mit Score + ETA-Abweichung + Feedback-Status.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get('location_id');
  if (fromQuery) return fromQuery;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

interface AbgeschlosseneTour {
  tour_id: string;
  fahrer_name: string;
  abschluss_zeit: string;
  stops_geplant: number;
  stops_erledigt: number;
  score: number;
  eta_abweichung_min: number;
  feedback_offen: number;
  feedback_erhalten: number;
  status: 'abgeschlossen' | 'teilweise';
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = await createClient();
  const jetzt = new Date();
  const tagesbeginn = new Date(jetzt);
  tagesbeginn.setHours(0, 0, 0, 0);

  const { data: touren } = await sb
    .from('delivery_tours')
    .select(`
      id,
      status,
      score,
      eta_abweichung_min,
      stops_geplant,
      stops_erledigt,
      completed_at,
      drivers (
        id,
        name,
        full_name
      )
    `)
    .eq('location_id', locationId)
    .in('status', ['abgeschlossen', 'completed'])
    .gte('completed_at', tagesbeginn.toISOString())
    .order('completed_at', { ascending: false })
    .limit(50);

  if (!touren || touren.length === 0) {
    return NextResponse.json({
      touren: [],
      gesamt: 0,
      generatedAt: jetzt.toISOString(),
    });
  }

  const tourIds = touren.map((t) => t.id);

  const { data: feedbacks } = await sb
    .from('delivery_feedback')
    .select('tour_id, rating')
    .in('tour_id', tourIds);

  const feedbackMap = new Map<string, { offen: number; erhalten: number }>();
  for (const tour of touren) {
    const erhalten = (feedbacks ?? []).filter((f) => f.tour_id === tour.id).length;
    const geplant = Number(tour.stops_erledigt ?? tour.stops_geplant ?? 0);
    feedbackMap.set(tour.id, {
      erhalten,
      offen: Math.max(0, geplant - erhalten),
    });
  }

  const result: AbgeschlosseneTour[] = touren.map((t) => {
    const drv = Array.isArray(t.drivers) ? t.drivers[0] : t.drivers;
    const fb = feedbackMap.get(t.id) ?? { offen: 0, erhalten: 0 };
    const geplant = Number(t.stops_geplant ?? 0);
    const erledigt = Number(t.stops_erledigt ?? geplant);

    return {
      tour_id: t.id,
      fahrer_name: (drv as { name?: string; full_name?: string } | null)?.name
        ?? (drv as { name?: string; full_name?: string } | null)?.full_name
        ?? 'Unbekannt',
      abschluss_zeit: t.completed_at ?? jetzt.toISOString(),
      stops_geplant: geplant,
      stops_erledigt: erledigt,
      score: Number(t.score ?? 80),
      eta_abweichung_min: Number(t.eta_abweichung_min ?? 0),
      feedback_offen: fb.offen,
      feedback_erhalten: fb.erhalten,
      status: erledigt >= geplant ? 'abgeschlossen' : 'teilweise',
    };
  });

  return NextResponse.json({
    touren: result,
    gesamt: result.length,
    generatedAt: jetzt.toISOString(),
  });
}
