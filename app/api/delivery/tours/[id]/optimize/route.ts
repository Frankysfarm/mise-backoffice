/**
 * POST /api/delivery/tours/[id]/optimize
 * Optimiert die Route einer Tour via Google Directions (TSP).
 */
import { NextRequest, NextResponse } from 'next/server';
import { optimizeTour } from '@/lib/delivery/tour-optimizer';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  try {
    const result = await optimizeTour(params.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
