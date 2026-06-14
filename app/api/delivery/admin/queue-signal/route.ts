/**
 * GET/POST/DELETE /api/delivery/admin/queue-signal
 *
 * Admin-API zur Verwaltung des Queue-Signals einer Location.
 * Auth: authentifizierter Mitarbeiter (employees.auth_user_id → location_id).
 *
 * GET ?action=status          → aktuelles Signal + letzten 10 History-Einträge
 * GET ?action=history&limit=N → nur History
 *
 * POST { signal_type, eta_extension_min?, message_de?, expires_at? }
 *   → setzt das Signal manuell (trigger_source='manual')
 *
 * DELETE → setzt Signal auf 'normal' zurück
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getCurrentQueueSignal,
  setQueueSignal,
  resetQueueSignal,
  getSignalHistory,
  type QueueSignalType,
} from '@/lib/delivery/capacity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_SIGNAL_TYPES: QueueSignalType[] = ['normal', 'extended', 'paused'];

// ──────────────────────────────────────────────────────────────────────────────
// Auth-Helper
// ──────────────────────────────────────────────────────────────────────────────

async function resolveLocationId(): Promise<{ locationId: string; userId: string } | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!emp?.location_id) return null;
  return { locationId: emp.location_id as string, userId: user.id };
}

// ──────────────────────────────────────────────────────────────────────────────
// GET
// ──────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await resolveLocationId();
  if (!auth) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const action = new URL(req.url).searchParams.get('action') ?? 'status';
  const limit  = Math.min(
    parseInt(new URL(req.url).searchParams.get('limit') ?? '20', 10) || 20,
    100,
  );

  if (action === 'history') {
    const history = await getSignalHistory(auth.locationId, limit);
    return NextResponse.json({ history });
  }

  // action === 'status' (default)
  const [signal, history] = await Promise.all([
    getCurrentQueueSignal(auth.locationId),
    getSignalHistory(auth.locationId, 10),
  ]);

  return NextResponse.json({ signal, history });
}

// ──────────────────────────────────────────────────────────────────────────────
// POST
// ──────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await resolveLocationId();
  if (!auth) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const signalType = body.signal_type as QueueSignalType;
  if (!VALID_SIGNAL_TYPES.includes(signalType)) {
    return NextResponse.json(
      { error: `signal_type muss einer von ${VALID_SIGNAL_TYPES.join(', ')} sein` },
      { status: 400 },
    );
  }

  const etaExtensionMin = body.eta_extension_min != null
    ? Number(body.eta_extension_min)
    : undefined;

  if (etaExtensionMin !== undefined && (isNaN(etaExtensionMin) || etaExtensionMin < 0 || etaExtensionMin > 120)) {
    return NextResponse.json(
      { error: 'eta_extension_min muss zwischen 0 und 120 liegen' },
      { status: 400 },
    );
  }

  const messageDe = typeof body.message_de === 'string'
    ? body.message_de.slice(0, 200)
    : (body.message_de === null ? null : undefined);

  const expiresAt = typeof body.expires_at === 'string' ? body.expires_at : null;

  const signal = await setQueueSignal(
    auth.locationId,
    { signalType, etaExtensionMin, messageDe, expiresAt },
    false,
    'manual',
    null,
    auth.userId,
  );

  // Phase 155: Fahrer bei manueller Signal-Setzung per Push informieren
  if (signalType !== 'normal') {
    void import('@/lib/delivery/push-notify').then(({ enqueueQueueSignalPushForLocation }) =>
      enqueueQueueSignalPushForLocation({
        locationId:      auth.locationId,
        signalType:      signalType as 'extended' | 'paused',
        etaExtensionMin: etaExtensionMin ?? (signalType === 'paused' ? 0 : 10),
        messageDe:       typeof messageDe === 'string' ? messageDe : null,
      }).catch(() => {}),
    ).catch(() => {});
  }

  return NextResponse.json({ signal, push_queued: signalType !== 'normal' }, { status: 200 });
}

// ──────────────────────────────────────────────────────────────────────────────
// DELETE
// ──────────────────────────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest) {
  const auth = await resolveLocationId();
  if (!auth) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  await resetQueueSignal(auth.locationId);
  return NextResponse.json({ ok: true });
}
