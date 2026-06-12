import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { rerouteBundle } from '@/lib/frank';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Optimiert die Stopp-Reihenfolge der Tour via Google Maps (TSP). Vom Fahrer nach "Route berechnen" aufgerufen.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let uid: string | null = null;
  const auth = req.headers.get('authorization') ?? '';
  const mm = /^Bearer (.+)$/i.exec(auth);
  if (mm) {
    const svc = createServiceClient();
    const { data } = await svc.auth.getUser(mm[1].trim());
    if (data?.user) uid = data.user.id;
  }
  if (!uid) {
    const sb = await createClient();
    const { data } = await sb.auth.getUser();
    if (data?.user) uid = data.user.id;
  }
  if (!uid) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  const { id } = await ctx.params;
  try { await rerouteBundle(id); } catch { /* Route-Fehler nicht fatal */ }
  return NextResponse.json({ ok: true });
}
