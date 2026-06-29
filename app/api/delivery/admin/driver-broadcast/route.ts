/**
 * POST /api/delivery/admin/driver-broadcast
 *
 * Fahrer-Chat-Broadcast: Nachricht an alle/bestimmte Fahrer senden.
 * Phase 515
 *
 * Body: { location_id, message, driver_ids?: string[], priority?: 'normal' | 'urgent' }
 * Response: { ok, sentCount, results: BroadcastResult[] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface BroadcastResult {
  driverId: string;
  driverName: string | null;
  status: 'sent' | 'failed' | 'offline';
}

interface BroadcastBody {
  location_id: string;
  message: string;
  driver_ids?: string[];
  priority?: 'normal' | 'urgent';
}

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  return (emp?.location_id as string) ?? null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: BroadcastBody;
  try {
    body = (await req.json()) as BroadcastBody;
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  let locationId = body.location_id;
  if (!locationId) locationId = (await resolveLocationId(user.id)) ?? '';
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const message = (body.message ?? '').trim();
  if (!message || message.length > 500) {
    return NextResponse.json({ error: 'Nachricht fehlt oder zu lang (max 500 Zeichen)' }, { status: 400 });
  }

  const priority = body.priority === 'urgent' ? 'urgent' : 'normal';

  const ssb = createServiceClient();

  // Determine target drivers
  let targetDriverIds: string[] = body.driver_ids ?? [];

  if (targetDriverIds.length === 0) {
    // All active drivers for this location (online in last 30 min)
    const thirtyMinAgo = new Date(Date.now() - 30 * 60_000);
    const { data: gpsRows } = await ssb
      .from('driver_gps_events')
      .select('driver_id')
      .eq('location_id', locationId)
      .gte('recorded_at', thirtyMinAgo.toISOString());

    targetDriverIds = [...new Set((gpsRows ?? []).map((g) => g.driver_id as string))];
  }

  if (targetDriverIds.length === 0) {
    return NextResponse.json({ ok: true, sentCount: 0, results: [], note: 'Keine Fahrer online' });
  }

  // Load driver names
  const { data: driverRows } = await ssb
    .from('drivers')
    .select('id, name')
    .in('id', targetDriverIds);

  const nameMap = new Map<string, string>(
    (driverRows ?? []).map((d) => [d.id as string, d.name as string]),
  );

  // Load push tokens
  const { data: tokenRows } = await ssb
    .from('driver_push_tokens')
    .select('driver_id, token, platform')
    .in('driver_id', targetDriverIds);

  const tokenMap = new Map<string, string>(
    (tokenRows ?? []).map((t) => [t.driver_id as string, t.token as string]),
  );

  // Insert broadcast messages into driver_messages table (best-effort)
  const now = new Date().toISOString();
  const inserts = targetDriverIds.map((driverId) => ({
    location_id: locationId,
    driver_id: driverId,
    message,
    priority,
    sender: 'dispatch',
    sent_at: now,
    read: false,
  }));

  const { error: insertError } = await ssb.from('driver_messages').insert(inserts);

  const results: BroadcastResult[] = targetDriverIds.map((driverId) => {
    const hasToken = tokenMap.has(driverId);
    return {
      driverId,
      driverName: nameMap.get(driverId) ?? null,
      status: insertError ? 'failed' : hasToken ? 'sent' : 'offline',
    };
  });

  const sentCount = results.filter((r) => r.status === 'sent').length;

  return NextResponse.json({ ok: !insertError, sentCount, results });
}

// GET: list recent broadcast messages for a location
export async function GET(req: NextRequest): Promise<NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const ssb = createServiceClient();
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();

  const { data: messages } = await ssb
    .from('driver_messages')
    .select('id, driver_id, message, priority, sent_at, read, sender')
    .eq('location_id', locationId)
    .eq('sender', 'dispatch')
    .gte('sent_at', since)
    .order('sent_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ ok: true, messages: messages ?? [] });
}
