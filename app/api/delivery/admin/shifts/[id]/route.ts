/**
 * PATCH  /api/delivery/admin/shifts/[id]
 * DELETE /api/delivery/admin/shifts/[id]
 *
 * Einzelne Schicht aktualisieren oder stornieren.
 *
 * PATCH-Body (alle Felder optional):
 *   {
 *     status?:        'active' | 'completed' | 'cancelled' | 'missed'
 *     actual_start?:  string (ISO)   — Eincheck-Zeit
 *     actual_end?:    string (ISO)   — Auschcheck-Zeit
 *     planned_start?: string (ISO)   — Schicht verschieben
 *     planned_end?:   string (ISO)
 *     notes?:         string
 *   }
 *
 * DELETE: Storniert die Schicht (status='cancelled').
 *   Nur möglich wenn status='scheduled'.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'ID fehlt' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const allowed = new Set(['status', 'actual_start', 'actual_end', 'planned_start', 'planned_end', 'notes']);
  const update: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(body)) {
    if (!allowed.has(k)) continue;
    if ((k === 'actual_start' || k === 'actual_end' || k === 'planned_start' || k === 'planned_end') && typeof v === 'string') {
      const ts = new Date(v);
      if (isNaN(ts.getTime())) {
        return NextResponse.json({ error: `Ungültiger Zeitstempel für ${k}` }, { status: 400 });
      }
      update[k] = ts.toISOString();
    } else {
      update[k] = v;
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Keine gültigen Felder zum Updaten' }, { status: 400 });
  }

  // Status-Validierung
  if ('status' in update) {
    const validStatuses = ['scheduled', 'active', 'completed', 'missed', 'cancelled'];
    if (!validStatuses.includes(update['status'] as string)) {
      return NextResponse.json({ error: 'Ungültiger Status' }, { status: 400 });
    }
  }

  try {
    const svc = createServiceClient();
    const { data: shift, error } = await svc
      .from('driver_shifts')
      .update(update)
      .eq('id', id)
      .select('id, driver_id, location_id, planned_start, planned_end, actual_start, actual_end, status, notes, created_at')
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!shift) return NextResponse.json({ error: 'Schicht nicht gefunden' }, { status: 404 });

    return NextResponse.json({ shift });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unbekannter Fehler' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'ID fehlt' }, { status: 400 });

  try {
    const svc = createServiceClient();

    // Nur 'scheduled' Schichten können storniert werden
    const { data: existing } = await svc
      .from('driver_shifts')
      .select('status')
      .eq('id', id)
      .maybeSingle();

    if (!existing) return NextResponse.json({ error: 'Schicht nicht gefunden' }, { status: 404 });
    if ((existing.status as string) !== 'scheduled') {
      return NextResponse.json(
        { error: `Schicht kann nicht storniert werden (Status: ${existing.status})` },
        { status: 409 },
      );
    }

    const { error } = await svc
      .from('driver_shifts')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, message: 'Schicht storniert' });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unbekannter Fehler' },
      { status: 500 },
    );
  }
}
