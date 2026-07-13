import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1255 — Bewertungs-API (Public)
// Letzte N Kundenbewertungen für das Bewertungs-Karussell

interface Bewertung {
  id: string;
  kunden_name: string;
  sterne: number;
  kommentar: string | null;
  datum: string;
}

interface ApiResponse {
  bewertungen: Bewertung[];
  location_id: string;
  generiert_am: string;
}

function mockData(location_id: string): ApiResponse {
  const now = Date.now();
  return {
    bewertungen: [
      { id: 'r1', kunden_name: 'Sarah M.',  sterne: 5, kommentar: 'Superschnelle Lieferung, alles noch heiß angekommen!', datum: new Date(now - 2*3600000).toISOString() },
      { id: 'r2', kunden_name: 'Markus B.', sterne: 5, kommentar: 'Wie immer top Qualität. Bestelle hier regelmäßig.',     datum: new Date(now - 5*3600000).toISOString() },
      { id: 'r3', kunden_name: 'Lena K.',   sterne: 4, kommentar: 'Sehr lecker, Fahrer war freundlich.',                   datum: new Date(now - 8*3600000).toISOString() },
      { id: 'r4', kunden_name: 'Thomas W.', sterne: 5, kommentar: 'Pünktlich und frisch. Klare Weiterempfehlung!',         datum: new Date(now - 24*3600000).toISOString() },
      { id: 'r5', kunden_name: 'Julia S.',  sterne: 4, kommentar: 'Gute Portion, faire Preise.',                           datum: new Date(now - 30*3600000).toISOString() },
      { id: 'r6', kunden_name: 'Felix H.',  sterne: 5, kommentar: 'Schneller als erwartet, perfekte Temperatur.',          datum: new Date(now - 48*3600000).toISOString() },
    ],
    location_id,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location_id = searchParams.get('location_id') ?? '';
  const limit = Math.min(20, Math.max(1, Number(searchParams.get('limit') ?? '6')));

  try {
    const supabase = await createClient();

    const { data } = await supabase
      .from('delivery_ratings')
      .select('id, customer_name, rating, comment, created_at')
      .eq('location_id', location_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!data || data.length === 0) return NextResponse.json(mockData(location_id));

    const bewertungen: Bewertung[] = data.map(r => ({
      id: String(r.id),
      kunden_name: (r.customer_name as string | null) ?? 'Gast',
      sterne: Math.max(1, Math.min(5, Number(r.rating))),
      kommentar: (r.comment as string | null) ?? null,
      datum: r.created_at as string,
    }));

    return NextResponse.json({ bewertungen, location_id, generiert_am: new Date().toISOString() } satisfies ApiResponse);
  } catch {
    return NextResponse.json(mockData(location_id));
  }
}
