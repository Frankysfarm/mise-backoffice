import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { buildInventoryOrderText } from '@/lib/inventory/order-email';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MANAGER_ROLES = new Set(['manager', 'backoffice', 'admin']);

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  const employee = await getCurrentEmployee();
  if (!employee || !employee.tenant_id || !MANAGER_ROLES.has(employee.rolle)) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
  }

  const service = createServiceClient();
  const { data: order, error: orderError } = await service
    .from('order_lists')
    .select('id,location_id,supplier_id,lieferant,positionen,gesamtbetrag,status,referenz')
    .eq('id', routeParams.id)
    .maybeSingle();
  if (orderError) return NextResponse.json({ error: 'Bestellung konnte nicht geladen werden' }, { status: 500 });
  if (!order) return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
  if (order.status !== 'entwurf') {
    return NextResponse.json({ error: 'Nur Entwürfe können versendet werden' }, { status: 409 });
  }
  if (!order.location_id || !order.supplier_id) {
    return NextResponse.json({ error: 'Standort oder Lieferant fehlt' }, { status: 400 });
  }

  const [{ data: location }, { data: supplier }, { data: tenant }] = await Promise.all([
    service.from('locations').select('id,name').eq('id', order.location_id).eq('tenant_id', employee.tenant_id).maybeSingle(),
    service.from('suppliers').select('id,name,email,kundennummer').eq('id', order.supplier_id).eq('tenant_id', employee.tenant_id).maybeSingle(),
    service.from('tenants').select('name,resend_api_key,resend_from_email,resend_from_name,resend_verified_at').eq('id', employee.tenant_id).maybeSingle(),
  ]);
  if (!location || !supplier) {
    return NextResponse.json({ error: 'Bestellung gehört nicht zu diesem Betrieb' }, { status: 403 });
  }
  if (!supplier.email) return NextResponse.json({ error: 'Beim Lieferanten fehlt die E-Mail-Adresse' }, { status: 400 });
  if (!tenant?.resend_api_key || !tenant.resend_from_email || !tenant.resend_verified_at) {
    return NextResponse.json({ error: 'E-Mail-Versand ist für diesen Betrieb nicht vollständig eingerichtet' }, { status: 400 });
  }

  const reference = order.referenz || `LAGER-${order.id.slice(0, 8).toUpperCase()}`;
  let body: string;
  try {
    body = buildInventoryOrderText({
      tenantName: tenant.name,
      locationName: location.name,
      supplierName: supplier.name,
      customerNumber: supplier.kundennummer,
      reference,
      positions: order.positionen,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Ungültige Bestellpositionen' }, { status: 400 });
  }

  const resend = new Resend(tenant.resend_api_key);
  const { data: sent, error: sendError } = await resend.emails.send({
    from: `${tenant.resend_from_name ?? tenant.name} <${tenant.resend_from_email}>`,
    to: supplier.email,
    subject: `Bestellung ${reference} · ${tenant.name}`,
    text: body,
    replyTo: tenant.resend_from_email,
  }, { idempotencyKey: `inventory-order-${order.id}` });
  if (sendError) {
    return NextResponse.json({ error: `Versand fehlgeschlagen: ${sendError.message}` }, { status: 502 });
  }

  const { data: updated, error: updateError } = await service
    .from('order_lists')
    .update({
      status: 'bestellt',
      bestellt_am: new Date().toISOString(),
      genehmigt_von: employee.id,
      genehmigt_am: new Date().toISOString(),
      referenz: reference,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .eq('status', 'entwurf')
    .select('id')
    .maybeSingle();
  if (updateError || !updated) {
    return NextResponse.json({ error: 'E-Mail wurde versendet, der Bestellstatus konnte aber nicht aktualisiert werden. Bitte erneut öffnen.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email_id: sent?.id ?? null, reference });
}
