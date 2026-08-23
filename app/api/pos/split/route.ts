import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { resolvePosCart, type PosMenuItem, type PosFulfillment } from '@/lib/pos/checkout';
import {
  createProviderCheckout,
  mapSplitState,
  parseSplitScope,
  recoverProviderCheckout,
  requirePositiveCents,
  requireUuid,
  verifyProviderCheckout,
  type SplitProvider,
  type SplitTenantPayments,
} from '@/lib/pos/split-payment';
import { signTransaction } from '@/lib/pos/tse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

type EmployeeContext = {
  svc: ReturnType<typeof createServiceClient>;
  employee: { id: string; tenant_id: string; location_id: string };
};

export async function GET(req: NextRequest) {
  const context = await getEmployeeContext();
  if ('response' in context) return context.response;
  let splitSessionId: string;
  let registerId: string;
  let shiftId: string;
  try {
    splitSessionId = requireUuid(req.nextUrl.searchParams.get('splitSessionId'), 'Split-Vorgang');
    registerId = requireUuid(req.nextUrl.searchParams.get('registerId'), 'Kasse');
    shiftId = requireUuid(req.nextUrl.searchParams.get('shiftId'), 'Schicht');
  } catch (error) {
    return failure(error, 400);
  }
  const row = await getSplitStatus(context, { splitSessionId, registerId, shiftId });
  return row ? json({ ok: true, split: mapSplitState(row) }, 200) : json({ ok: false, error: 'Split-Vorgang nicht gefunden' }, 404);
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin && origin !== req.nextUrl.origin) return json({ ok: false, error: 'Origin nicht erlaubt' }, 403);
  const context = await getEmployeeContext();
  if ('response' in context) return context.response;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ ok: false, error: 'Ungültige Split-Anfrage' }, 400);

  try {
    switch (body.action) {
      case 'begin': return await beginSplit(req, context, body);
      case 'cash': return await recordCash(context, body);
      case 'create_provider': return await createProvider(req, context, body);
      case 'confirm_provider': return await confirmProvider(context, body);
      default: return json({ ok: false, error: 'Unbekannte Split-Aktion' }, 400);
    }
  } catch (error) {
    return failure(error, statusForError(error));
  }
}

async function beginSplit(req: NextRequest, context: EmployeeContext, body: Record<string, unknown>) {
  const registerId = requireUuid(body.registerId, 'Kasse');
  const shiftId = requireUuid(body.shiftId, 'Schicht');
  const tableId = body.tableId ? requireUuid(body.tableId, 'Tisch') : null;
  const idempotencyKey = requireUuid(req.headers.get('idempotency-key') ?? body.idempotencyKey, 'Idempotenz');
  const fulfillment = parseFulfillment(body.fulfillment);
  if (!fulfillment || (fulfillment === 'table' && !tableId)) throw new Error('Verkaufsart oder Tisch prüfen');
  await requireRuntimeBinding(context, { registerId, shiftId, tableId });

  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) {
    throw new Error('Warenkorb ist leer oder zu groß');
  }
  const rawItems = body.items as Array<Record<string, unknown>>;
  const itemIds = [...new Set(rawItems.map((item) => String(item.id ?? '')).filter(Boolean))];
  const { data: menuItems } = await context.svc.from('menu_items')
    .select('id,name,preis,mwst_satz,option_groups').in('id', itemIds)
    .eq('tenant_id', context.employee.tenant_id).eq('location_id', context.employee.location_id)
    .eq('verfuegbar', true);
  const sale = resolvePosCart({
    rawItems,
    menuItems: (menuItems ?? []) as PosMenuItem[],
    fulfillment,
    tip: body.tip,
  });
  const rpcItems = sale.items.map((item, index) => {
    const seat = rawItems[index]?.seat;
    if (seat !== undefined && (!Number.isInteger(Number(seat)) || Number(seat) < 1 || Number(seat) > 99)) {
      throw new Error('Ungültiger Sitz oder Gast');
    }
    return {
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPriceCents: Math.round(item.unitPrice * 100),
      taxRate: item.taxRate,
      note: item.note,
      selections: item.selections,
      ...(seat === undefined ? {} : { seat: Number(seat) }),
    };
  });
  const { data, error } = await context.svc.rpc('create_pos_split_sale_085', {
    p_tenant_id: context.employee.tenant_id,
    p_location_id: context.employee.location_id,
    p_register_id: registerId,
    p_shift_id: shiftId,
    p_employee_id: context.employee.id,
    p_table_id: tableId,
    p_fulfillment: fulfillment,
    p_items: rpcItems,
    p_subtotal_cents: Math.round(sale.subtotal * 100),
    p_tip_cents: Math.round(sale.tip * 100),
    p_training: body.training === true,
    p_idempotency_key: idempotencyKey,
  });
  const row = firstRow(data);
  if (error || !row) throw rpcError(error, 'Split-Verkauf konnte nicht angelegt werden');
  const current = await getSplitStatus(context, {
    splitSessionId: String(row.split_session_id), registerId, shiftId,
  });
  if (!current) throw new Error('Split-Status konnte nicht geladen werden');
  return json({
    ok: true,
    split: { ...mapSplitState(current), idempotent: row.was_created === false },
  }, row.was_created === false ? 200 : 201);
}

async function recordCash(context: EmployeeContext, body: Record<string, unknown>) {
  const ids = paymentIds(body);
  const scope = parseSplitScope(body.scope);
  const cashReceivedCents = requirePositiveCents(body.cashReceivedCents, 'Erhaltener Barbetrag');
  const { data, error } = await context.svc.rpc('record_pos_split_cash_085', {
    p_tenant_id: context.employee.tenant_id,
    p_location_id: context.employee.location_id,
    p_register_id: ids.registerId,
    p_shift_id: ids.shiftId,
    p_employee_id: context.employee.id,
    p_split_session_id: ids.splitSessionId,
    p_scope_type: scope.type,
    p_requested_cents: scope.requestedCents ?? 0,
    p_order_item_ids: scope.itemIds,
    p_seat_no: scope.seatNo,
    p_cash_received_cents: cashReceivedCents,
    p_idempotency_key: ids.idempotencyKey,
  });
  const row = firstRow(data);
  if (error || !row) throw rpcError(error, 'Bar-Teilzahlung konnte nicht verbucht werden');
  const tseActive = row.completed === true && row.was_confirmed !== false
    ? await signCompletedSplit(context, String(row.transaction_id))
    : false;
  const current = await getSplitStatus(context, {
    splitSessionId: ids.splitSessionId,
    registerId: ids.registerId,
    shiftId: ids.shiftId,
  });
  if (!current) throw new Error('Split-Status konnte nicht aktualisiert werden');
  return json({ ok: true, split: { ...mapSplitState(current), tseActive } }, row.was_confirmed === false ? 200 : 201);
}

async function createProvider(req: NextRequest, context: EmployeeContext, body: Record<string, unknown>) {
  const ids = paymentIds(body);
  const provider = parseProvider(body.provider);
  const scope = parseSplitScope(body.scope);
  const tenant = await getTenantPayments(context);
  requireProviderConfiguration(provider, tenant);
  const { data, error } = await context.svc.rpc('prepare_pos_split_payment_085', {
    p_tenant_id: context.employee.tenant_id,
    p_location_id: context.employee.location_id,
    p_register_id: ids.registerId,
    p_shift_id: ids.shiftId,
    p_employee_id: context.employee.id,
    p_split_session_id: ids.splitSessionId,
    p_method: provider,
    p_scope_type: scope.type,
    p_requested_cents: scope.requestedCents ?? 0,
    p_order_item_ids: scope.itemIds,
    p_seat_no: scope.seatNo,
    p_idempotency_key: ids.idempotencyKey,
  });
  const prepared = firstRow(data);
  if (error || !prepared) throw rpcError(error, 'Provider-Teilzahlung konnte nicht reserviert werden');
  if (prepared.attempt_status === 'failed') throw new Error('Dieser Zahlungsversuch ist fehlgeschlagen');

  const attemptId = String(prepared.payment_attempt_id);
  const bound = await getBoundAttempt(context, {
    attemptId,
    registerId: ids.registerId,
    shiftId: ids.shiftId,
  });
  if (!bound) throw new Error('Provider-Zahlungsversuch ist nicht gebunden');
  const existingReference = prepared.provider_reference ? String(prepared.provider_reference) : null;
  let checkout;
  try {
    checkout = existingReference
      ? await recoverProviderCheckout({ provider, tenant, reference: existingReference })
      : await createProviderCheckout({
          provider,
          tenant,
          amountCents: Number(prepared.amount_cents),
          attemptId,
          tenantId: context.employee.tenant_id,
          orderNumber: bound.orderNumber,
          origin: req.nextUrl.origin,
        });
  } catch (cause) {
    throw cause;
  }

  if (!existingReference) {
    const { error: attachError } = await context.svc.rpc('attach_pos_split_provider_085', {
      p_tenant_id: context.employee.tenant_id,
      p_location_id: context.employee.location_id,
      p_register_id: ids.registerId,
      p_shift_id: ids.shiftId,
      p_employee_id: context.employee.id,
      p_payment_attempt_id: attemptId,
      p_provider_reference: checkout.reference,
    });
    if (attachError) throw rpcError(attachError, 'Provider-Referenz konnte nicht gespeichert werden');
  }

  return json({
    ok: true,
    paymentAttemptId: attemptId,
    provider,
    providerReference: checkout.reference,
    checkoutUrl: checkout.url,
    status: checkout.status,
    amountCents: Number(prepared.amount_cents),
    idempotent: prepared.was_created === false,
  }, prepared.was_created === false ? 200 : 201);
}

async function confirmProvider(context: EmployeeContext, body: Record<string, unknown>) {
  const ids = paymentIds(body, false);
  const attemptId = requireUuid(body.paymentAttemptId, 'Zahlungsversuch');
  const bound = await getBoundAttempt(context, {
    attemptId,
    registerId: ids.registerId,
    shiftId: ids.shiftId,
  });
  if (!bound || !bound.providerReference) throw new Error('Provider-Zahlungsversuch ist nicht gebunden');
  if (bound.status === 'failed') throw new Error('Provider-Zahlung ist fehlgeschlagen');

  const tenant = await getTenantPayments(context);
  const verification = await verifyProviderCheckout({
    provider: bound.provider,
    tenant,
    reference: bound.providerReference,
    amountCents: bound.amountCents,
    attemptId,
    tenantId: context.employee.tenant_id,
  });
  if (verification.state === 'pending') {
    return json({ ok: true, status: 'pending', message: verification.reason ?? null }, 202);
  }
  if (verification.state === 'failed') {
    await failAttempt(context, ids, attemptId, verification.reason ?? 'Providerzahlung fehlgeschlagen');
    return json({ ok: false, status: 'failed', error: verification.reason ?? 'Providerzahlung fehlgeschlagen' }, 409);
  }

  const { data, error } = await context.svc.rpc('confirm_pos_split_payment_085', {
    p_tenant_id: context.employee.tenant_id,
    p_location_id: context.employee.location_id,
    p_register_id: ids.registerId,
    p_shift_id: ids.shiftId,
    p_employee_id: context.employee.id,
    p_payment_attempt_id: attemptId,
    p_provider_payment_id: verification.paymentId ?? bound.providerReference,
  });
  const row = firstRow(data);
  if (error || !row) throw rpcError(error, 'Provider-Teilzahlung konnte nicht bestätigt werden');
  const tseActive = row.completed === true && row.was_confirmed !== false
    ? await signCompletedSplit(context, String(row.transaction_id))
    : false;
  const current = await getSplitStatus(context, {
    splitSessionId: bound.splitSessionId,
    registerId: ids.registerId,
    shiftId: ids.shiftId,
  });
  if (!current) throw new Error('Split-Status konnte nicht aktualisiert werden');
  return json({ ok: true, status: 'confirmed', split: { ...mapSplitState(current), tseActive } }, row.was_confirmed === false ? 200 : 201);
}

async function getEmployeeContext(): Promise<EmployeeContext | { response: NextResponse }> {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { response: json({ ok: false, error: 'Nicht eingeloggt' }, 401) };
  const svc = createServiceClient();
  const { data: employee } = await svc.from('employees')
    .select('id,tenant_id,location_id').eq('auth_user_id', user.id).maybeSingle();
  if (!employee?.tenant_id || !employee.location_id) {
    return { response: json({ ok: false, error: 'Kein POS-Zugriff' }, 403) };
  }
  return { svc, employee: employee as EmployeeContext['employee'] };
}

async function requireRuntimeBinding(context: EmployeeContext, ids: {
  registerId: string; shiftId: string; tableId: string | null;
}) {
  const [register, shift, table] = await Promise.all([
    context.svc.from('pos_registers').select('id').eq('id', ids.registerId)
      .eq('tenant_id', context.employee.tenant_id).eq('location_id', context.employee.location_id)
      .eq('aktiv', true).maybeSingle(),
    context.svc.from('pos_shifts').select('id').eq('id', ids.shiftId)
      .eq('tenant_id', context.employee.tenant_id).eq('location_id', context.employee.location_id)
      .eq('register_id', ids.registerId).eq('employee_id', context.employee.id)
      .eq('status', 'offen').maybeSingle(),
    ids.tableId
      ? context.svc.from('restaurant_tables').select('id').eq('id', ids.tableId)
          .eq('tenant_id', context.employee.tenant_id).eq('location_id', context.employee.location_id)
          .eq('aktiv', true).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!register.data || !shift.data || (ids.tableId && !table.data)) {
    throw new Error('Kasse, Schicht oder Tisch ist nicht aktiv');
  }
}

async function getSplitStatus(context: EmployeeContext, ids: {
  splitSessionId: string; registerId: string; shiftId: string;
}) {
  const { data, error } = await context.svc.rpc('get_pos_split_status_085', {
    p_tenant_id: context.employee.tenant_id,
    p_location_id: context.employee.location_id,
    p_register_id: ids.registerId,
    p_shift_id: ids.shiftId,
    p_employee_id: context.employee.id,
    p_split_session_id: ids.splitSessionId,
  });
  if (error) throw rpcError(error, 'Split-Status konnte nicht geladen werden');
  const row = firstRow(data);
  if (!row || row.status !== 'paid') return row;
  const { data: tx } = await context.svc.from('pos_transactions')
    .select('tse_transaction_id').eq('id', row.transaction_id)
    .eq('tenant_id', context.employee.tenant_id)
    .eq('location_id', context.employee.location_id).maybeSingle();
  return { ...row, tse_active: Boolean(tx?.tse_transaction_id) };
}

async function getBoundAttempt(context: EmployeeContext, ids: {
  attemptId: string; registerId: string; shiftId: string;
}) {
  const { data: attempt } = await context.svc.from('pos_payment_attempts')
    .select('id,split_session_id,method,amount_cents,status,provider_reference')
    .eq('id', ids.attemptId).eq('tenant_id', context.employee.tenant_id)
    .eq('location_id', context.employee.location_id).maybeSingle();
  if (!attempt) return null;
  const { data: session } = await context.svc.from('pos_split_sessions')
    .select('id,order_id').eq('id', attempt.split_session_id)
    .eq('tenant_id', context.employee.tenant_id).eq('location_id', context.employee.location_id)
    .eq('register_id', ids.registerId).eq('shift_id', ids.shiftId)
    .eq('employee_id', context.employee.id).maybeSingle();
  if (!session) return null;
  const { data: order } = await context.svc.from('customer_orders')
    .select('bestellnummer').eq('id', session.order_id)
    .eq('tenant_id', context.employee.tenant_id).eq('location_id', context.employee.location_id)
    .maybeSingle();
  if (!order) return null;
  return {
    splitSessionId: String(session.id),
    provider: attempt.method as SplitProvider,
    amountCents: Number(attempt.amount_cents),
    status: String(attempt.status),
    providerReference: attempt.provider_reference ? String(attempt.provider_reference) : null,
    orderNumber: String(order.bestellnummer),
  };
}

async function getTenantPayments(context: EmployeeContext): Promise<SplitTenantPayments> {
  const { data: tenant } = await context.svc.from('tenants')
    .select('name,sumup_api_key,sumup_merchant_code,stripe_secret_key')
    .eq('id', context.employee.tenant_id).maybeSingle();
  if (!tenant) throw new Error('Zahlungskonfiguration fehlt');
  return tenant as SplitTenantPayments;
}

function requireProviderConfiguration(provider: SplitProvider, tenant: SplitTenantPayments) {
  if (provider === 'sumup' && (!tenant.sumup_api_key || !tenant.sumup_merchant_code)) {
    throw new Error('SumUp ist nicht eingerichtet');
  }
  if (provider === 'stripe' && !tenant.stripe_secret_key) {
    throw new Error('Stripe ist nicht eingerichtet');
  }
}

async function failAttempt(
  context: EmployeeContext,
  ids: { registerId: string; shiftId: string },
  attemptId: string,
  reason: string,
) {
  await context.svc.rpc('fail_pos_split_provider_085', {
    p_tenant_id: context.employee.tenant_id,
    p_location_id: context.employee.location_id,
    p_register_id: ids.registerId,
    p_shift_id: ids.shiftId,
    p_employee_id: context.employee.id,
    p_payment_attempt_id: attemptId,
    p_reason: reason,
  });
}

async function signCompletedSplit(context: EmployeeContext, transactionId: string) {
  const { data: tx } = await context.svc.from('pos_transactions')
    .select('id,brutto_gesamt,netto_gesamt,mwst_gesamt,trainingsbon,tse_transaction_id')
    .eq('id', transactionId).eq('tenant_id', context.employee.tenant_id)
    .eq('location_id', context.employee.location_id).maybeSingle();
  if (!tx || tx.tse_transaction_id) return Boolean(tx?.tse_transaction_id);
  const { data: items } = await context.svc.from('pos_transaction_items')
    .select('gesamt_brutto,mwst_betrag,mwst_satz').eq('transaction_id', transactionId);
  const vatRates = [7, 19].flatMap((rate) => {
    const matching = (items ?? []).filter((item) => Number(item.mwst_satz) === rate);
    if (!matching.length) return [];
    const brutto = matching.reduce((sum, item) => sum + Number(item.gesamt_brutto), 0);
    const steuer = matching.reduce((sum, item) => sum + Number(item.mwst_betrag), 0);
    return [{ satz: rate, brutto, steuer, netto: brutto - steuer }];
  });
  const { data: attempts } = await context.svc.from('pos_payment_attempts')
    .select('method').eq('split_session_id',
      (await context.svc.from('pos_split_sessions').select('id').eq('transaction_id', transactionId).single()).data?.id ?? '')
    .eq('status', 'confirmed');
  const onlyCash = (attempts ?? []).every((attempt) => attempt.method === 'bar');
  const tse = await signTransaction({
    tenantId: context.employee.tenant_id,
    bruttoGesamt: Number(tx.brutto_gesamt),
    nettoGesamt: Number(tx.netto_gesamt),
    mwstGesamt: Number(tx.mwst_gesamt),
    vatRates,
    zahlungsart: onlyCash ? 'bar' : 'karte',
    isTraining: tx.trainingsbon === true,
  });
  if (!tse) return false;
  const { error } = await context.svc.from('pos_transactions')
    .update(tse).eq('id', transactionId).is('tse_transaction_id', null);
  return !error;
}

function paymentIds(body: Record<string, unknown>, withSession = true) {
  return {
    registerId: requireUuid(body.registerId, 'Kasse'),
    shiftId: requireUuid(body.shiftId, 'Schicht'),
    splitSessionId: withSession ? requireUuid(body.splitSessionId, 'Split-Vorgang') : String(body.splitSessionId ?? ''),
    idempotencyKey: withSession ? requireUuid(body.idempotencyKey, 'Idempotenz') : String(body.idempotencyKey ?? ''),
  };
}

function parseProvider(value: unknown): SplitProvider {
  if (value !== 'sumup' && value !== 'stripe') throw new Error('Zahlungsanbieter auswählen');
  return value;
}

function parseFulfillment(value: unknown): PosFulfillment | null {
  return value === 'table' || value === 'counter' || value === 'takeaway' ? value : null;
}

function firstRow(data: unknown): Record<string, any> | null {
  if (Array.isArray(data)) return (data[0] as Record<string, any> | undefined) ?? null;
  return data && typeof data === 'object' ? data as Record<string, any> : null;
}

function rpcError(error: { message?: string } | null, fallback: string) {
  return new Error(error?.message ? `${fallback}: ${error.message}` : fallback);
}

function statusForError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/exceeds|not open|idempotency|conflict|failed|nicht aktiv|reserviert|unavailable/i.test(message)) return 409;
  if (/binding|Kein POS|outside/i.test(message)) return 403;
  return 400;
}

function failure(error: unknown, status: number) {
  const raw = error instanceof Error ? error.message : 'Split-Zahlung fehlgeschlagen';
  console.error('POS split payment failed', { status, reason: raw.slice(0, 180) });
  const safe = status >= 500 ? 'Split-Zahlung konnte nicht verarbeitet werden' : raw.replace(/^.*?: /, '');
  return json({ ok: false, error: safe }, status);
}

function json(payload: Record<string, unknown>, status: number) {
  return NextResponse.json(payload, { status, headers: PRIVATE_HEADERS });
}
