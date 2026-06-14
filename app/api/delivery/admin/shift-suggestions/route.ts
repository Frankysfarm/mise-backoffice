/**
 * GET/POST/PATCH /api/delivery/admin/shift-suggestions
 *
 * Auto-Shift Vorschläge — Phase 156
 *
 * GET  ?status=pending|accepted|all&from=YYYY-MM-DD
 *   → Offene/akzeptierte Vorschläge für die Location
 *
 * POST { action: 'generate' }
 *   → Vorschläge sofort (re)generieren (manueller Trigger)
 *
 * PATCH { id: uuid, status: 'accepted'|'ignored' }
 *   → Vorschlag annehmen oder ignorieren
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getShiftSuggestions,
  generateShiftSuggestions,
  updateSuggestionStatus,
} from '@/lib/delivery/shift-suggestions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveAuth(): Promise<{ locationId: string; userId: string } | null> {
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

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await resolveAuth();
  if (!auth) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status   = searchParams.get('status') ?? 'pending';
  const fromDate = searchParams.get('from') ?? new Date().toISOString().slice(0, 10);
  const limit    = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);

  try {
    const suggestions = await getShiftSuggestions(auth.locationId, { status, fromDate, limit });
    return NextResponse.json({ suggestions, generatedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json(
      { error: 'Vorschläge konnten nicht geladen werden', detail: String(e) },
      { status: 500 },
    );
  }
}

// ── POST — manuelles Generieren ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await resolveAuth();
  if (!auth) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* default action=generate */ }

  const action = (body.action as string | undefined) ?? 'generate';

  if (action === 'generate') {
    const result = await generateShiftSuggestions(auth.locationId, 7);
    return NextResponse.json({ ok: true, result });
  }

  return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
}

// ── PATCH — Status ändern ─────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const auth = await resolveAuth();
  if (!auth) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 }); }

  const { id, status } = body as { id?: string; status?: string };
  if (!id || !status) {
    return NextResponse.json({ error: 'id und status sind Pflichtfelder' }, { status: 400 });
  }
  if (status !== 'accepted' && status !== 'ignored') {
    return NextResponse.json({ error: 'status muss "accepted" oder "ignored" sein' }, { status: 400 });
  }

  const updated = await updateSuggestionStatus(
    id,
    auth.locationId,
    status as 'accepted' | 'ignored',
    auth.userId,
  );

  if (!updated) {
    return NextResponse.json({ error: 'Vorschlag nicht gefunden' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, suggestion: updated });
}
