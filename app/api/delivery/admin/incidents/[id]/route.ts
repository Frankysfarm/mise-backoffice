/**
 * GET   /api/delivery/admin/incidents/[id]
 *   → Einzelner Incident mit Actions-Log
 *
 * PATCH /api/delivery/admin/incidents/[id]
 *   Aktionen via ?action=...:
 *     (kein action) — normales Update: status, severity, description, resolution_notes
 *     action=resolve  — { notes, credit_issued_id? }
 *     action=escalate — { note }
 *     action=add_note — { note }
 *     action=customer_contacted — { note? }
 *     action=driver_contacted   — { note? }
 *     action=close — schließt den Incident
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getIncident,
  updateIncident,
  addIncidentAction,
  resolveIncident,
  escalateIncident,
  type IncidentStatus,
  type IncidentSeverity,
  type IncidentActionType,
} from '@/lib/delivery/incidents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!emp?.location_id) return NextResponse.json({ error: 'Kein Standort' }, { status: 403 });

  const incident = await getIncident(params.id, emp.location_id);
  if (!incident) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

  return NextResponse.json({ incident });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { data: emp } = await sb
    .from('employees')
    .select('location_id, email')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!emp?.location_id) return NextResponse.json({ error: 'Kein Standort' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const performedBy = emp.email ?? user.email ?? 'admin';

  const body = await req.json() as {
    status?: string;
    severity?: string;
    description?: string;
    resolution_notes?: string;
    credit_issued_id?: string;
    notes?: string;
    note?: string;
  };

  // ── action=resolve ─────────────────────────────────────────
  if (action === 'resolve') {
    if (!body.notes) {
      return NextResponse.json({ error: 'notes erforderlich' }, { status: 400 });
    }
    const incident = await resolveIncident(
      params.id,
      emp.location_id,
      body.notes,
      body.credit_issued_id,
      performedBy,
    );
    if (!incident) return NextResponse.json({ error: 'Nicht gefunden oder Fehler' }, { status: 404 });
    return NextResponse.json({ incident });
  }

  // ── action=escalate ────────────────────────────────────────
  if (action === 'escalate') {
    const incident = await escalateIncident(
      params.id,
      emp.location_id,
      body.note ?? body.notes ?? 'Eskaliert',
      performedBy,
    );
    if (!incident) return NextResponse.json({ error: 'Nicht gefunden oder Fehler' }, { status: 404 });
    return NextResponse.json({ incident });
  }

  // ── action=close ───────────────────────────────────────────
  if (action === 'close') {
    const incident = await updateIncident(
      params.id,
      emp.location_id,
      { status: 'closed' as IncidentStatus },
      performedBy,
    );
    if (!incident) return NextResponse.json({ error: 'Nicht gefunden oder Fehler' }, { status: 404 });
    return NextResponse.json({ incident });
  }

  // ── action=add_note | action=customer_contacted | action=driver_contacted ──
  const contactActions: IncidentActionType[] = ['customer_contacted', 'driver_contacted', 'note'];
  const mappedAction = action === 'add_note' ? 'note' : action as IncidentActionType | null;
  if (mappedAction && contactActions.includes(mappedAction)) {
    const actionEntry = await addIncidentAction(
      params.id,
      emp.location_id,
      mappedAction,
      body.note ?? body.notes ?? null,
      performedBy,
    );
    if (!actionEntry) return NextResponse.json({ error: 'Nicht gefunden oder Fehler' }, { status: 404 });
    return NextResponse.json({ action: actionEntry });
  }

  // ── Default: plain field update ────────────────────────────
  const update: {
    status?: IncidentStatus;
    severity?: IncidentSeverity;
    description?: string;
    resolution_notes?: string;
    credit_issued_id?: string;
  } = {};

  if (body.status)           update.status           = body.status as IncidentStatus;
  if (body.severity)         update.severity         = body.severity as IncidentSeverity;
  if (body.description)      update.description      = body.description;
  if (body.resolution_notes) update.resolution_notes = body.resolution_notes;
  if (body.credit_issued_id) update.credit_issued_id = body.credit_issued_id;

  const incident = await updateIncident(params.id, emp.location_id, update, performedBy);
  if (!incident) return NextResponse.json({ error: 'Nicht gefunden oder Fehler' }, { status: 404 });

  return NextResponse.json({ incident });
}
