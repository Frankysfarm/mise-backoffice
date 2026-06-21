/**
 * GET /api/delivery/admin/zone-difficulty
 *   ?action=cache     — aktueller Cache für alle Zonen
 *   ?action=modifiers — Dispatch-Modifikatoren (stopCount + detour)
 * POST /api/delivery/admin/zone-difficulty
 *   { action: 'refresh', days?: number }  — Cache neu berechnen
 *   { action: 'prune',   days?: number }  — Alte Einträge löschen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getZoneDifficultyCache,
  getZoneDifficultyModifiers,
  refreshZoneDifficultyCache,
} from '@/lib/delivery/zone-difficulty';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const url = new URL(req.url);
  const qLoc = url.searchParams.get('location_id');
  if (qLoc) return qLoc;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .single();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Kein Standort zugeordnet' }, { status: 400 });

  const action = new URL(req.url).searchParams.get('action') ?? 'cache';

  if (action === 'modifiers') {
    const modifiers = await getZoneDifficultyModifiers(locationId);
    return NextResponse.json({ ok: true, locationId, modifiers });
  }

  const cache = await getZoneDifficultyCache(locationId);
  return NextResponse.json({ ok: true, locationId, cache });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Kein Standort zugeordnet' }, { status: 400 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action ?? '');

  if (action === 'refresh') {
    const days = typeof body.days === 'number' ? body.days : 14;
    const result = await refreshZoneDifficultyCache(locationId, days);
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}
