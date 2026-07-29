import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MOCK_DATA = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Sara', rang: 1, avg_wartezeit_min: 4.2, rank_delta: 0, ampel: 'gruen' as const, alert_lang: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia', rang: 2, avg_wartezeit_min: 6.8, rank_delta: 1, ampel: 'gelb' as const, alert_lang: false },
    { fahrer_id: 'f3', fahrer_name: 'Max', rang: 3, avg_wartezeit_min: 9.1, rank_delta: -1, ampel: 'gelb' as const, alert_lang: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim', rang: 4, avg_wartezeit_min: 18.3, rank_delta: 0, ampel: 'rot' as const, alert_lang: true },
  ],
  team_avg_wartezeit: 9.6,
  beste_name: 'Sara',
  laengste_name: 'Tim',
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
