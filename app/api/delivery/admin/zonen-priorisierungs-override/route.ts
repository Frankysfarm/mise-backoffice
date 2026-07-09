/**
 * GET  /api/delivery/admin/zonen-priorisierungs-override?location_id=<uuid>
 * POST /api/delivery/admin/zonen-priorisierungs-override
 *      body: { location_id, zone, prioritaet } — zone: A|B|C|D, prioritaet: hoch|normal|niedrig
 *
 * Phase 913 — Zonen-Priorisierungs-Override-API
 * Manuelle Priorisierung von Lieferzonen bei Engpässen.
 * Speichert Override in delivery_zone_overrides (oder Fallback: in-memory Map).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Prioritaet = 'hoch' | 'normal' | 'niedrig';

// In-memory Fallback wenn Tabelle nicht existiert
const inMemoryOverrides = new Map<string, Record<string, Prioritaet>>();

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get('location_id');
  if (fromQuery) return fromQuery;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = await createClient();

  // Versuche aus DB zu lesen
  const { data, error } = await sb
    .from('delivery_zone_overrides')
    .select('zone, prioritaet, updated_at')
    .eq('location_id', locationId);

  if (error) {
    // Fallback: In-Memory
    const mem = inMemoryOverrides.get(locationId) ?? {};
    return NextResponse.json({
      overrides: Object.entries(mem).map(([zone, prioritaet]) => ({ zone, prioritaet })),
      generatedAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    overrides: data ?? [],
    generatedAt: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { location_id?: string; zone?: string; prioritaet?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const locationId = body.location_id;
  const zone = body.zone;
  const prioritaet = body.prioritaet as Prioritaet;

  if (!locationId || !zone || !prioritaet) {
    return NextResponse.json({ error: 'location_id, zone, prioritaet required' }, { status: 400 });
  }
  if (!['A', 'B', 'C', 'D'].includes(zone)) {
    return NextResponse.json({ error: 'zone must be A|B|C|D' }, { status: 400 });
  }
  if (!['hoch', 'normal', 'niedrig'].includes(prioritaet)) {
    return NextResponse.json({ error: 'prioritaet must be hoch|normal|niedrig' }, { status: 400 });
  }

  // Versuche in DB zu speichern
  const { error } = await sb
    .from('delivery_zone_overrides')
    .upsert({ location_id: locationId, zone, prioritaet, updated_at: new Date().toISOString() }, {
      onConflict: 'location_id,zone',
    });

  if (error) {
    // Fallback: In-Memory
    const mem = inMemoryOverrides.get(locationId) ?? {};
    mem[zone] = prioritaet;
    inMemoryOverrides.set(locationId, mem);
  }

  return NextResponse.json({ ok: true, zone, prioritaet });
}
