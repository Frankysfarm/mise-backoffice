import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FeedbackEintrag = {
  id: string;
  sterne: number;        // 1–5
  kommentar: string | null;
  bestell_datum: string; // ISO date
  datum_label: string;   // "Mo 07.07."
};

type ApiResponse = {
  eintraege: FeedbackEintrag[];
  schnitt_sterne: number;
  anzahl_gesamt: number;
  driver_id: string;
  generiert_am: string;
};

const MOCK_KOMMENTARE = [
  'Super schnelle Lieferung, alles heiß!',
  'Freundlicher Fahrer, gerne wieder.',
  null,
  'Etwas spät, aber nett.',
  'Alles top, vielen Dank!',
  null,
  'Sehr höflich und pünktlich.',
  'Essen war noch warm, top!',
  'Hat geklingelt, sehr aufmerksam.',
  null,
];

function dateLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  const wt = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  return `${wt[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.`;
}

function mockData(driverId: string): ApiResponse {
  const eintraege: FeedbackEintrag[] = [];
  const sterne = [5, 5, 4, 3, 5, 5, 4, 5, 4, 5];
  for (let i = 0; i < 10; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - Math.floor(i * 0.7));
    const iso = d.toISOString().split('T')[0];
    eintraege.push({
      id: `mock-${i}`,
      sterne: sterne[i],
      kommentar: MOCK_KOMMENTARE[i],
      bestell_datum: iso,
      datum_label: dateLabel(iso),
    });
  }
  const schnitt = eintraege.reduce((a, e) => a + e.sterne, 0) / eintraege.length;
  return { eintraege, schnitt_sterne: parseFloat(schnitt.toFixed(1)), anzahl_gesamt: 10, driver_id: driverId, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get('driver_id');

  if (!driverId) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const { data: reviews } = await supabase
      .from('mise_delivery_reviews')
      .select('id, rating, comment, created_at')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!reviews?.length) throw new Error('no reviews');

    const eintraege: FeedbackEintrag[] = reviews.map(r => {
      const iso = (r.created_at as string).split('T')[0];
      return {
        id: r.id,
        sterne: Math.max(1, Math.min(5, Math.round(r.rating ?? 5))),
        kommentar: r.comment ?? null,
        bestell_datum: iso,
        datum_label: dateLabel(iso),
      };
    });

    const schnitt = eintraege.reduce((a, e) => a + e.sterne, 0) / eintraege.length;

    return NextResponse.json({
      eintraege,
      schnitt_sterne: parseFloat(schnitt.toFixed(1)),
      anzahl_gesamt: eintraege.length,
      driver_id: driverId,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(mockData(driverId));
  }
}
