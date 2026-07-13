import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationSlug = searchParams.get('location_slug');
  const limit = Math.min(10, parseInt(searchParams.get('limit') ?? '3', 10));

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ bestellungen: [] });

    const locationQ = supabase.from('locations').select('id').eq('slug', locationSlug).single();
    const { data: location } = await locationQ;

    const q = supabase
      .from('customer_orders')
      .select('id, bestellnummer, created_at, gesamtbetrag, status, items')
      .eq('customer_id', user.id)
      .in('status', ['geliefert', 'delivered', 'abgeholt', 'completed'])
      .order('created_at', { ascending: false })
      .limit(limit);
    if (location?.id) q.eq('location_id', location.id);

    const { data: orders } = await q;

    const bestellungen = (orders ?? []).map((o) => {
      let artikel: string[] = [];
      try {
        const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
        artikel = Array.isArray(items) ? items.map((i: { name?: string }) => i.name ?? '').filter(Boolean) : [];
      } catch { /* ignore */ }
      return {
        id: o.id,
        bestellnummer: o.bestellnummer ?? o.id.slice(0, 6),
        datum: o.created_at,
        gesamtbetrag: o.gesamtbetrag ?? 0,
        artikel,
        status: o.status,
      };
    });

    return NextResponse.json({ bestellungen });
  } catch {
    return NextResponse.json({ bestellungen: [] });
  }
}
