/**
 * GET  /api/delivery/admin/incidents
 *   ?status=open|open_all|investigating|escalated|resolved|closed
 *   ?type=low_rating|late_delivery|...
 *   ?severity=low|medium|high|critical
 *   ?driver_id=...
 *   ?stats=true    → nur v_incident_stats zurückgeben
 *   ?limit=N&offset=N
 *
 * POST /api/delivery/admin/incidents
 *   { type, title, severity?, description?, order_id?, driver_id?, batch_id?, customer_name?, customer_phone? }
 *   → Manuell erstellter Incident
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getIncidents,
  createManualIncident,
  getIncidentStats,
  type IncidentType,
  type IncidentSeverity,
  type IncidentStatus,
} from '@/lib/delivery/incidents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!emp?.location_id) return NextResponse.json({ error: 'Kein Standort' }, { status: 403 });

  const { searchParams } = new URL(req.url);

  // Stats-only mode
  if (searchParams.get('stats') === 'true') {
    const stats = await getIncidentStats(emp.location_id);
    return NextResponse.json({ stats });
  }

  const { incidents, total } = await getIncidents(emp.location_id, {
    status:    (searchParams.get('status') ?? undefined) as IncidentStatus | 'open_all' | undefined,
    type:      (searchParams.get('type') ?? undefined) as IncidentType | undefined,
    severity:  (searchParams.get('severity') ?? undefined) as IncidentSeverity | undefined,
    driver_id: searchParams.get('driver_id') ?? undefined,
    limit:     searchParams.get('limit') ? Number(searchParams.get('limit')) : 50,
    offset:    searchParams.get('offset') ? Number(searchParams.get('offset')) : 0,
  });

  return NextResponse.json({ incidents, total });
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { data: emp } = await sb
    .from('employees')
    .select('location_id, email')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!emp?.location_id) return NextResponse.json({ error: 'Kein Standort' }, { status: 403 });

  const body = await req.json() as {
    type?: string;
    title?: string;
    severity?: string;
    description?: string;
    order_id?: string;
    driver_id?: string;
    batch_id?: string;
    customer_name?: string;
    customer_phone?: string;
  };

  if (!body.type || !body.title) {
    return NextResponse.json({ error: 'type und title sind erforderlich' }, { status: 400 });
  }

  const validTypes: IncidentType[] = [
    'low_rating', 'late_delivery', 'wrong_item', 'missing_item',
    'damaged', 'driver_behavior', 'failed_delivery', 'manual',
  ];
  if (!validTypes.includes(body.type as IncidentType)) {
    return NextResponse.json({ error: `Ungültiger Typ: ${body.type}` }, { status: 400 });
  }

  const incident = await createManualIncident({
    location_id:    emp.location_id,
    order_id:       body.order_id,
    driver_id:      body.driver_id,
    batch_id:       body.batch_id,
    type:           body.type as IncidentType,
    severity:       (body.severity as IncidentSeverity) ?? 'medium',
    title:          body.title,
    description:    body.description,
    customer_name:  body.customer_name,
    customer_phone: body.customer_phone,
    performed_by:   emp.email ?? user.email ?? 'admin',
  });

  if (!incident) {
    return NextResponse.json({ error: 'Incident konnte nicht erstellt werden' }, { status: 500 });
  }

  return NextResponse.json({ incident }, { status: 201 });
}
