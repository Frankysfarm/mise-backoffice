/**
 * GET  /api/delivery/admin/assignment-optimizer
 *   ?action=dashboard  — Dashboard + aktive Vorschläge (Default)
 *   ?action=suggestions — Nur aktive Vorschläge
 *
 * POST /api/delivery/admin/assignment-optimizer
 *   { action: 'generate' }                   — Neue Vorschläge generieren
 *   { action: 'accept', id: string }          — Vorschlag annehmen
 *   { action: 'dismiss', id: string }         — Vorschlag verwerfen
 *   { action: 'expire' }                      — Abgelaufene Vorschläge bereinigen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  buildAssignmentSuggestions,
  getSuggestionDashboard,
  getActiveSuggestions,
  acceptSuggestion,
  dismissSuggestion,
  expireOldSuggestions,
  autoDispatchHighScoreSuggestions,
} from '@/lib/delivery/assignment-optimizer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  return (emp?.location_id as string | null)
    ?? new URL(req.url).searchParams.get('location_id');
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Nicht eingeloggt oder kein Standort' }, { status: 401 });

  const action = new URL(req.url).searchParams.get('action') ?? 'dashboard';

  try {
    if (action === 'suggestions') {
      const suggestions = await getActiveSuggestions(locationId);
      return NextResponse.json({ suggestions });
    }

    // Default: dashboard
    const dashboard = await getSuggestionDashboard(locationId);
    return NextResponse.json(dashboard);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  const locationId: string | null = (emp?.location_id as string | null)
    ?? new URL(req.url).searchParams.get('location_id');

  if (!locationId) return NextResponse.json({ error: 'Kein Standort zugeordnet' }, { status: 400 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body ok */ }

  const action = body.action as string | undefined;

  try {
    if (action === 'generate') {
      const result = await buildAssignmentSuggestions(locationId);
      return NextResponse.json({ ok: true, result });
    }

    if (action === 'accept') {
      const id = body.id as string | undefined;
      if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 });
      await acceptSuggestion(id, locationId);
      return NextResponse.json({ ok: true });
    }

    if (action === 'dismiss') {
      const id = body.id as string | undefined;
      if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 });
      await dismissSuggestion(id, locationId);
      return NextResponse.json({ ok: true });
    }

    if (action === 'expire') {
      const svc = createServiceClient();
      const { data: locs } = await svc.from('locations').select('id').eq('aktiv', true);
      const count = await expireOldSuggestions(1);
      return NextResponse.json({ ok: true, expired: count, locations: (locs ?? []).length });
    }

    // Phase 277: Manueller Auto-Dispatch-Trigger (Score ≥ 85 + idle Fahrer)
    if (action === 'auto_dispatch') {
      const result = await autoDispatchHighScoreSuggestions(locationId);
      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
