/**
 * GET  /api/delivery/admin/failed-attempts?action=list|stats
 * POST /api/delivery/admin/failed-attempts
 *
 * Admin-API für fehlgeschlagene Zustellversuche.
 *
 * GET ?action=list   → offene Versuche mit Bestellinformationen
 * GET ?action=stats  → Statistiken (Gesamt, Aufschlüsselung, Auflösungsrate)
 *
 * POST { action: 'schedule_retry', attempt_id, next_attempt_at }
 *   → Retry-Zeitpunkt setzen
 * POST { action: 'resolve', attempt_id, resolution }
 *   → Versuch abschliessen (returned / cancelled)
 * POST { action: 'release_retries' }
 *   → Fällige Retry-Orders sofort freigeben (Debug/Cron-Ersatz)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getPendingFailedAttempts,
  getFailedAttemptStats,
  scheduleRetry,
  resolveFailedAttempt,
  releaseRetryAttempts,
  type FailedResolution,
} from '@/lib/delivery/proof';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_RESOLUTIONS: FailedResolution[] = [
  'delivered', 'returned_to_restaurant', 'cancelled', 'rescheduled',
];

async function getLocationId(req: NextRequest): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const locationParam = new URL(req.url).searchParams.get('location_id');
  if (locationParam) return locationParam;

  const { data: employee } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  return (employee?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'location_id nicht ermittelbar' }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') ?? 'list';
  const days   = Math.min(Math.max(Number(searchParams.get('days') ?? 30), 1), 90);

  if (action === 'stats') {
    const stats = await getFailedAttemptStats(locationId, days);
    return NextResponse.json({ stats, days });
  }

  // default: list
  const attempts = await getPendingFailedAttempts(locationId);
  return NextResponse.json({ attempts, count: attempts.length });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'location_id nicht ermittelbar' }, { status: 400 });

  const body = await req.json() as {
    action?: string;
    attempt_id?: string;
    next_attempt_at?: string;
    resolution?: string;
  };

  const { action } = body;

  if (action === 'schedule_retry') {
    if (!body.attempt_id || !UUID_RE.test(body.attempt_id)) {
      return NextResponse.json({ error: 'attempt_id fehlt oder ungültig' }, { status: 400 });
    }
    if (!body.next_attempt_at) {
      return NextResponse.json({ error: 'next_attempt_at fehlt' }, { status: 400 });
    }
    const retryDate = new Date(body.next_attempt_at);
    if (isNaN(retryDate.getTime())) {
      return NextResponse.json({ error: 'next_attempt_at kein gültiges Datum' }, { status: 400 });
    }
    if (retryDate <= new Date()) {
      return NextResponse.json({ error: 'next_attempt_at muss in der Zukunft liegen' }, { status: 400 });
    }

    const ok = await scheduleRetry(body.attempt_id, locationId, retryDate);
    if (!ok) return NextResponse.json({ error: 'Retry konnte nicht eingetragen werden' }, { status: 500 });
    return NextResponse.json({ ok: true, next_attempt_at: retryDate.toISOString() });
  }

  if (action === 'resolve') {
    if (!body.attempt_id || !UUID_RE.test(body.attempt_id)) {
      return NextResponse.json({ error: 'attempt_id fehlt oder ungültig' }, { status: 400 });
    }
    if (!body.resolution || !VALID_RESOLUTIONS.includes(body.resolution as FailedResolution)) {
      return NextResponse.json({
        error: `resolution ungültig. Erlaubt: ${VALID_RESOLUTIONS.join(', ')}`,
      }, { status: 400 });
    }

    const ok = await resolveFailedAttempt(body.attempt_id, locationId, body.resolution as FailedResolution);
    if (!ok) return NextResponse.json({ error: 'Auflösung fehlgeschlagen' }, { status: 500 });
    return NextResponse.json({ ok: true, resolution: body.resolution });
  }

  if (action === 'release_retries') {
    const result = await releaseRetryAttempts();
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json(
    { error: `Unbekannte action. Erlaubt: schedule_retry, resolve, release_retries` },
    { status: 400 },
  );
}
