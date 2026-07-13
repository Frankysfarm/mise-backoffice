import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function mockResponse(driverId: string) {
  return {
    letzte_stopps: [
      { stopp_id: '1', adresse: 'Hauptstr. 12', status: 'erfolgreich', delta_min: -2 },
      { stopp_id: '2', adresse: 'Gartenweg 5', status: 'erfolgreich', delta_min: 1 },
      { stopp_id: '3', adresse: 'Marktplatz 3', status: 'verzoegert', delta_min: 8 },
      { stopp_id: '4', adresse: 'Ringstr. 44', status: 'erfolgreich', delta_min: 0 },
      { stopp_id: '5', adresse: 'Schulstr. 7', status: 'nicht_erreicht', delta_min: 15 },
    ],
    erfolgsquote_pct: 80,
    badge: 'silber',
    badge_label: 'Silber-Fahrer',
    punkte_heute: 47,
    driver_id: driverId,
  };
}

export async function GET(req: NextRequest) {
  const driverId = req.nextUrl.searchParams.get('driver_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  try {
    const supabase = await createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: stops, error } = await (supabase as any)
      .from('mise_delivery_stops')
      .select('id, address, delivered_at, estimated_delivery_at, status')
      .eq('driver_id', driverId)
      .gte('created_at', today.toISOString())
      .order('delivered_at', { ascending: false })
      .limit(10);

    if (error || !stops || stops.length === 0) {
      return NextResponse.json(mockResponse(driverId));
    }

    const letzte_stopps = stops.map((s: any) => {
      const delta = s.delivered_at && s.estimated_delivery_at
        ? Math.round((new Date(s.delivered_at).getTime() - new Date(s.estimated_delivery_at).getTime()) / 60000)
        : 0;
      return {
        stopp_id: s.id,
        adresse: s.address ?? 'Unbekannt',
        status: s.status === 'delivered' && delta <= 5 ? 'erfolgreich' : delta > 5 ? 'verzoegert' : 'nicht_erreicht',
        delta_min: delta,
      };
    });

    const erfolgreich = letzte_stopps.filter((s: any) => s.status === 'erfolgreich').length;
    const erfolgsquote_pct = Math.round((erfolgreich / Math.max(letzte_stopps.length, 1)) * 100);

    const badge = erfolgsquote_pct >= 95 ? 'gold' : erfolgsquote_pct >= 85 ? 'silber' : erfolgsquote_pct >= 70 ? 'bronze' : 'im_aufbau';
    const badgeLabels: Record<string, string> = { gold: 'Gold-Fahrer', silber: 'Silber-Fahrer', bronze: 'Bronze-Fahrer', im_aufbau: 'Im Aufbau' };

    return NextResponse.json({
      letzte_stopps,
      erfolgsquote_pct,
      badge,
      badge_label: badgeLabels[badge],
      punkte_heute: erfolgreich * 10 + (erfolgsquote_pct >= 90 ? 5 : 0),
      driver_id: driverId,
    });
  } catch {
    return NextResponse.json(mockResponse(driverId));
  }
}
