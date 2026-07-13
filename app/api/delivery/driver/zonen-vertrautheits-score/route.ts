import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Phase 1206 — Zonen-Vertrautheits-Score-API
// GET /api/delivery/driver/zonen-vertrautheits-score?driver_id=<uuid>
// Wie gut kennt der Fahrer eine Zone: Lieferanzahl + Ø-Lieferzeit je Zone → Score 0–100

type ZonenScore = {
  zone: string;
  lieferungen: number;
  avg_lieferzeit_min: number;
  score: number;
  level: 'anfaenger' | 'vertraut' | 'experte' | 'profi';
  empfehlung: string;
};

type ApiResponse = {
  fahrer_id: string;
  zonen: ZonenScore[];
  best_zone: string | null;
  generiert_am: string;
};

function deriveLevel(score: number): ZonenScore['level'] {
  if (score < 25) return 'anfaenger';
  if (score < 50) return 'vertraut';
  if (score < 75) return 'experte';
  return 'profi';
}

function deriveEmpfehlung(level: ZonenScore['level'], zone: string): string {
  if (level === 'profi') return `Zone ${zone} ist deine Stärke — optimal für schnelle Touren`;
  if (level === 'experte') return `Zone ${zone} kennst du gut — gute Wahl für nächste Tour`;
  if (level === 'vertraut') return `Zone ${zone} — du wirst sicherer mit mehr Touren`;
  return `Zone ${zone} — noch wenig Erfahrung, lieber andere Zone wählen`;
}

function mockData(driverId: string): ApiResponse {
  return {
    fahrer_id: driverId,
    zonen: [
      { zone: 'A', lieferungen: 52, avg_lieferzeit_min: 22, score: 88, level: 'profi', empfehlung: 'Zone A ist deine Stärke — optimal für schnelle Touren' },
      { zone: 'B', lieferungen: 28, avg_lieferzeit_min: 27, score: 61, level: 'experte', empfehlung: 'Zone B kennst du gut — gute Wahl für nächste Tour' },
      { zone: 'C', lieferungen: 9, avg_lieferzeit_min: 34, score: 22, level: 'anfaenger', empfehlung: 'Zone C — noch wenig Erfahrung, lieber andere Zone wählen' },
      { zone: 'D', lieferungen: 15, avg_lieferzeit_min: 31, score: 38, level: 'vertraut', empfehlung: 'Zone D — du wirst sicherer mit mehr Touren' },
    ],
    best_zone: 'A',
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get('driver_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  try {
    const supabase = await createClient();
    const vor30d = new Date(Date.now() - 30 * 24 * 3600000).toISOString();

    const { data: stops } = await supabase
      .from('mise_delivery_stops')
      .select('delivery_zone, actual_delivery_minutes')
      .eq('driver_id', driverId)
      .eq('status', 'completed')
      .gte('completed_at', vor30d);

    if (!stops || stops.length === 0) return NextResponse.json(mockData(driverId));

    const byZone = new Map<string, { count: number; totalMin: number }>();
    for (const s of stops) {
      const z = (s.delivery_zone as string) ?? 'A';
      const min = (s.actual_delivery_minutes as number) ?? 30;
      const prev = byZone.get(z) ?? { count: 0, totalMin: 0 };
      byZone.set(z, { count: prev.count + 1, totalMin: prev.totalMin + min });
    }

    const maxCount = Math.max(...Array.from(byZone.values()).map(v => v.count), 1);
    const minAvgMin = 15;
    const maxAvgMin = 45;

    const zonen: ZonenScore[] = Array.from(byZone.entries()).map(([zone, { count, totalMin }]) => {
      const avg = parseFloat((totalMin / count).toFixed(1));
      const countScore = Math.min(100, Math.round((count / maxCount) * 60));
      const speedScore = Math.max(0, Math.round(((maxAvgMin - avg) / (maxAvgMin - minAvgMin)) * 40));
      const score = Math.min(100, countScore + speedScore);
      const level = deriveLevel(score);
      return { zone, lieferungen: count, avg_lieferzeit_min: avg, score, level, empfehlung: deriveEmpfehlung(level, zone) };
    }).sort((a, b) => b.score - a.score);

    const bestZone = zonen[0]?.zone ?? null;

    return NextResponse.json({ fahrer_id: driverId, zonen, best_zone: bestZone, generiert_am: new Date().toISOString() } as ApiResponse);
  } catch {
    return NextResponse.json(mockData(driverId));
  }
}
