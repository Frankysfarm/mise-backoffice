import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';

const VALID_STATUS = ['angefragt', 'bestaetigt', 'wartet', 'platziert', 'noshow', 'storniert', 'beendet'];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const emp = await requireManagerPlus();
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { status?: string; notiz?: string; tisch_id?: string | null } | null;
  if (!body) return NextResponse.json({ error: 'body fehlt' }, { status: 400 });

  const sb = await createClient();
  const svc = createServiceClient();
  const { data: empRow } = await sb.from('employees').select('tenant_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id) return NextResponse.json({ error: 'tenant unbekannt' }, { status: 403 });

  const { data: existing } = await svc
    .from('tisch_reservierungen')
    .select('id, tenant_id')
    .eq('id', id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: 'nicht gefunden' }, { status: 404 });
  if ((existing as { tenant_id: string }).tenant_id !== empRow.tenant_id) {
    return NextResponse.json({ error: 'keine Berechtigung' }, { status: 403 });
  }

  const update: Record<string, unknown> = {};
  if (body.status) {
    if (!VALID_STATUS.includes(body.status)) {
      return NextResponse.json({ error: 'ungültiger Status' }, { status: 400 });
    }
    update.status = body.status;
    if (body.status === 'bestaetigt') {
      update.bestaetigt_am = new Date().toISOString();
      update.bestaetigt_von = emp.id;
    }
    if (body.status === 'storniert') update.storniert_am = new Date().toISOString();
  }
  if (body.notiz !== undefined) update.notiz = body.notiz;
  if (body.tisch_id !== undefined) update.tisch_id = body.tisch_id;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nichts zu ändern' }, { status: 400 });
  }

  const { error } = await svc.from('tisch_reservierungen').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const emp = await requireManagerPlus();
  const { id } = await params;
  const sb = await createClient();
  const svc = createServiceClient();
  const { data: empRow } = await sb.from('employees').select('tenant_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id) return NextResponse.json({ error: 'tenant unbekannt' }, { status: 403 });

  const { data: existing } = await svc
    .from('tisch_reservierungen').select('tenant_id').eq('id', id).maybeSingle();
  if (!existing) return NextResponse.json({ error: 'nicht gefunden' }, { status: 404 });
  if ((existing as { tenant_id: string }).tenant_id !== empRow.tenant_id) {
    return NextResponse.json({ error: 'keine Berechtigung' }, { status: 403 });
  }

  const { error } = await svc.from('tisch_reservierungen').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
