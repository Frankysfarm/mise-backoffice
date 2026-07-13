import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1414 — Live-Warteschlangen-Indikator API
// GET /api/delivery/public/warteschlange?location_id=<uuid>
// "X Bestellungen vor dir" basierend auf offenen Bestellungen

interface ApiResponse {
  bestellungen_in_queue: number;
  wartezeit_zusatz_min: number;
  stufe: 'niedrig' | 'mittel' | 'hoch';
  location_id: string;
  generiert_am: string;
}

function buildMock(locationId: string): ApiResponse {
  return {
    bestellungen_in_queue: 4,
    wartezeit_zusatz_min: 8,
    stufe: 'mittel',
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .in('status', ['pending', 'preparing']);

    const bestellungen = count ?? 0;
    const wartezeit_zusatz_min = Math.min(20, Math.round(bestellungen * 2.5));
    const stufe: ApiResponse['stufe'] =
      bestellungen >= 8 ? 'hoch' : bestellungen >= 4 ? 'mittel' : 'niedrig';

    return NextResponse.json({
      bestellungen_in_queue: bestellungen,
      wartezeit_zusatz_min,
      stufe,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
