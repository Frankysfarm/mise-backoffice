import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';

const VALID_TRANSITIONS: Record<string, string[]> = {
  neu: ['bestätigt', 'storniert'],
  bestätigt: ['in_zubereitung', 'storniert'],
  in_zubereitung: ['fertig', 'storniert'],
  fertig: ['unterwegs', 'abgeholt'],
  unterwegs: ['geliefert'],
  storniert: ['neu'], // 10-Sek-Undo nach versehentlichem Ablehnen
};

const TIME_FIELD: Record<string, string> = {
  bestätigt: 'bestaetigt_am',
  in_zubereitung: 'zubereitung_start',
  fertig: 'fertig_am',
  abgeholt: 'abgeholt_am',
  geliefert: 'geliefert_am',
  storniert: 'storniert_am',
};

interface PostBody {
  status?: string;
  reason?: string;
  fahrer_id?: string | null;
  eta_min?: number | null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const emp = await requireManagerPlus();
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as PostBody | null;
  if (!body) {
    return NextResponse.json({ error: 'body fehlt' }, { status: 400 });
  }

  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb
    .from('employees').select('tenant_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id) {
    return NextResponse.json({ error: 'tenant unbekannt' }, { status: 403 });
  }

  const { data: order } = await svc
    .from('customer_orders')
    .select('id, status, location_id, fahrer_id, geschaetzte_lieferung_min, tenant_id, storniert_am')
    .eq('id', id)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
  }

  const orderRow = order as { id: string; status: string; location_id: string; tenant_id: string; storniert_am: string | null };
  // Tenant-Auth: stelle sicher dass Mitarbeiter zur gleichen Tenant gehört wie die Bestellung
  if (orderRow.tenant_id !== empRow.tenant_id) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }
  // Undo-Limit: storniert→neu nur innerhalb 60 Sek erlaubt (verhindert Reaktivierung alter Stornos)
  if (orderRow.status === 'storniert' && body.status === 'neu') {
    if (!orderRow.storniert_am || Date.now() - new Date(orderRow.storniert_am).getTime() > 60_000) {
      return NextResponse.json({ error: 'Undo-Frist abgelaufen' }, { status: 400 });
    }
  }
  const update: Record<string, unknown> = {};

  if (body.status) {
    const allowed = VALID_TRANSITIONS[orderRow.status] ?? [];
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { error: `Übergang nicht erlaubt: ${orderRow.status} → ${body.status}` },
        { status: 400 },
      );
    }
    update.status = body.status;
    const timeField = TIME_FIELD[body.status];
    if (timeField) update[timeField] = new Date().toISOString();
    if (body.status === 'storniert' && body.reason) {
      update.stornogrund = body.reason;
    }
    // Bei Undo (storniert → neu): Stornofelder wieder leeren
    if (body.status === 'neu' && orderRow.status === 'storniert') {
      update.storniert_am = null;
      update.stornogrund = null;
    }
  }

  if (body.fahrer_id !== undefined) {
    update.fahrer_id = body.fahrer_id;
  }

  if (body.eta_min !== undefined && body.eta_min !== null) {
    const minutes = Math.max(1, Math.min(180, Math.round(body.eta_min)));
    update.geschaetzte_lieferung_min = minutes;
    update.eta = new Date(Date.now() + minutes * 60_000).toISOString();
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nichts zu ändern' }, { status: 400 });
  }

  const { error: updErr } = await svc
    .from('customer_orders')
    .update(update)
    .eq('id', id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...update });
}
