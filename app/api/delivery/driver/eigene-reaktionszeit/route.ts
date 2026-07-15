/**
 * GET /api/delivery/driver/eigene-reaktionszeit?driver_id=<uuid>
 *
 * Phase 1745 — Eigene Reaktionszeit (Fahrer-App Backend)
 * Ø Reaktionszeit des Fahrers heute + Team-Vergleich; Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildMock(): object {
  return {
    eigene_avg_sek: 95,
    eigene_avg_min: 1.6,
    team_avg_sek: 156,
    team_avg_min: 2.6,
    touren_heute: 4,
    besser_als_team: true,
    differenz_sek: 61,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const driverId = req.nextUrl.searchParams.get('driver_id') ?? '';

  try {
    const supabase = await createClient();
    const datum = new Date().toISOString().split('T')[0];

    const { data: eigenTouren } = await supabase
      .from('delivery_batches')
      .select('dispatch_at, startzeit')
      .gte('startzeit', `${datum}T00:00:00`)
      .lte('startzeit', `${datum}T23:59:59`)
      .eq('fahrer_id', driverId)
      .not('dispatch_at', 'is', null)
      .not('startzeit', 'is', null);

    const { data: alleTouren } = await supabase
      .from('delivery_batches')
      .select('dispatch_at, startzeit')
      .gte('startzeit', `${datum}T00:00:00`)
      .lte('startzeit', `${datum}T23:59:59`)
      .not('dispatch_at', 'is', null)
      .not('startzeit', 'is', null);

    if (!eigenTouren || eigenTouren.length === 0) {
      return NextResponse.json(buildMock());
    }

    const zeiten = (arr: typeof eigenTouren) =>
      arr
        .map(t => Math.round((new Date(t.startzeit as string).getTime() - new Date(t.dispatch_at as string).getTime()) / 1000))
        .filter(s => s > 0 && s < 3600);

    const eigeneZeiten = zeiten(eigenTouren);
    const alleZeiten = zeiten(alleTouren ?? []);

    const eigeneAvg = eigeneZeiten.length > 0
      ? Math.round(eigeneZeiten.reduce((s, v) => s + v, 0) / eigeneZeiten.length)
      : 0;
    const teamAvg = alleZeiten.length > 0
      ? Math.round(alleZeiten.reduce((s, v) => s + v, 0) / alleZeiten.length)
      : 0;

    return NextResponse.json({
      eigene_avg_sek: eigeneAvg,
      eigene_avg_min: Math.round(eigeneAvg / 60 * 10) / 10,
      team_avg_sek: teamAvg,
      team_avg_min: Math.round(teamAvg / 60 * 10) / 10,
      touren_heute: eigeneZeiten.length,
      besser_als_team: eigeneAvg < teamAvg,
      differenz_sek: Math.abs(eigeneAvg - teamAvg),
    });
  } catch {
    return NextResponse.json(buildMock());
  }
}
