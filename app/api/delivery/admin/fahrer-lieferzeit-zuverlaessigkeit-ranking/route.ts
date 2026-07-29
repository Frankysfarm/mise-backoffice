import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MOCK_DATA = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia', rang: 1, zuverlaessigkeit_pct: 92, rank_delta: 0, ampel: 'gruen' as const, alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max', rang: 2, zuverlaessigkeit_pct: 85, rank_delta: 1, ampel: 'gruen' as const, alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara', rang: 3, zuverlaessigkeit_pct: 76, rank_delta: -1, ampel: 'gelb' as const, alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim', rang: 4, zuverlaessigkeit_pct: 58, rank_delta: 0, ampel: 'rot' as const, alert_niedrig: true },
  ],
  team_avg_pct: 77.75,
  beste_name: 'Julia',
  niedrigste_name: 'Tim',
  alert_count: 1,
  gesamt: 4,
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('location_id');

  try {
    await createClient();
  } catch {
    return NextResponse.json(MOCK_DATA);
  }

  if (!locationId) {
    return NextResponse.json(MOCK_DATA);
  }

  return NextResponse.json(MOCK_DATA);
}
