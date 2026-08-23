import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { resolvePosCart, type PosMenuItem } from '@/lib/pos/checkout';
import { signTransaction } from '@/lib/pos/tse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AtomicSaleRow = {
  transaction_id: string;
  order_id: string;
  order_number: string;
  bon_token: string | null;
  bon_number: string | null;
  was_created: boolean;
};

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin && origin !== req.nextUrl.origin) return json({ error: 'Origin nicht erlaubt' }, 403);

  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return json({ error: 'Nicht eingeloggt' }, 401);

  const body = await req.json().catch(() => null);
  const idempotencyKey = String(req.headers.get('idempotency-key') ?? body?.idempotencyKey ?? '').trim();
  const registerId = String(body?.registerId ?? '').trim();
  const shiftId = String(body?.shiftId ?? '').trim();
  const tableId = body?.tableId ? String(body.tableId).trim() : null;
  const fulfillment = body?.fulfillment === 'table'
    ? 'table'
    : body?.fulfillment === 'counter'
      ? 'counter'
      : body?.fulfillment === 'takeaway'
        ? 'takeaway'
        : null;
  const paymentMethod = body?.paymentMethod === 'bar' ? 'bar' : body?.paymentMethod === 'karte' ? 'karte' : null;
  if (!UUID_RE.test(idempotencyKey) || !UUID_RE.test(registerId) || !UUID_RE.test(shiftId)) {
    return json({ error: 'Ungültige POS-Anfrage' }, 400);
  }
  if (!fulfillment || !paymentMethod || (fulfillment === 'table' && !tableId)) {
    return json({ error: 'Verkaufsart, Zahlart und Tisch prüfen' }, 400);
  }
  if (tableId && !UUID_RE.test(tableId)) return json({ error: 'Ungültiger Tisch' }, 400);

  const svc = createServiceClient();
  const { data: employee } = await svc.from('employees')
    .select('id,tenant_id,location_id').eq('auth_user_id', user.id).maybeSingle();
  if (!employee?.tenant_id || !employee.location_id) return json({ error: 'Kein POS-Zugriff' }, 403);

  const [{ data: register }, { data: shift }, { data: table }] = await Promise.all([
    svc.from('pos_registers').select('id').eq('id', registerId)
      .eq('location_id', employee.location_id).eq('aktiv', true).maybeSingle(),
    svc.from('pos_shifts').select('id').eq('id', shiftId)
      .eq('tenant_id', employee.tenant_id).eq('location_id', employee.location_id)
      .eq('register_id', registerId).eq('employee_id', employee.id)
      .eq('status', 'offen').maybeSingle(),
    tableId
      ? svc.from('restaurant_tables').select('id').eq('id', tableId)
        .eq('tenant_id', employee.tenant_id).eq('location_id', employee.location_id)
        .eq('aktiv', true).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!register || !shift || (tableId && !table)) {
    return json({ error: 'Kasse, Schicht oder Tisch ist nicht aktiv' }, 409);
  }

  if (!Array.isArray(body?.items) || body.items.length < 1 || body.items.length > 100) {
    return json({ error: 'Warenkorb ist leer oder zu groß' }, 400);
  }
  const itemIds = [...new Set(body.items.map((item: { id?: unknown }) => String(item?.id ?? '')).filter(Boolean))];
  const { data: menuItems } = await svc.from('menu_items')
    .select('id,name,preis,mwst_satz,option_groups').in('id', itemIds)
    .eq('tenant_id', employee.tenant_id).eq('location_id', employee.location_id)
    .eq('verfuegbar', true);

  let sale;
  try {
    sale = resolvePosCart({
      rawItems: body.items,
      menuItems: (menuItems ?? []) as PosMenuItem[],
      fulfillment,
      tip: body.tip,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Ungültiger Warenkorb' }, 400);
  }

  const cashGiven = Number(body?.cashGiven ?? 0);
  if (paymentMethod === 'bar' && (!Number.isFinite(cashGiven) || cashGiven < sale.paymentTotal)) {
    return json({ error: 'Erhaltener Barbetrag reicht nicht aus' }, 400);
  }
  if (paymentMethod === 'karte') {
    const verified = await verifySumUpPayment({
      svc,
      tenantId: employee.tenant_id,
      checkoutId: String(body?.sumupCheckoutId ?? ''),
      idempotencyKey,
      paymentTotal: sale.paymentTotal,
    });
    if (!verified.ok) return json({ error: verified.error }, 409);
  }

  const rpcItems = sale.items.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    taxRate: item.taxRate,
    note: item.note,
    selections: item.selections,
  }));
  const { data, error } = await svc.rpc('create_pos_sale_atomic', {
    p_tenant_id: employee.tenant_id,
    p_location_id: employee.location_id,
    p_register_id: registerId,
    p_shift_id: shiftId,
    p_employee_id: employee.id,
    p_table_id: tableId,
    p_fulfillment: fulfillment,
    p_payment_method: paymentMethod,
    p_items: rpcItems,
    p_subtotal: sale.subtotal,
    p_tip: sale.tip,
    p_payment_total: sale.paymentTotal,
    p_cash_given: paymentMethod === 'bar' ? cashGiven : null,
    p_training: body?.training === true,
    p_idempotency_key: idempotencyKey,
    p_tse: {},
  });
  const result = (Array.isArray(data) ? data[0] : data) as AtomicSaleRow | null;
  if (error || !result) {
    console.error('create_pos_sale_atomic failed', { code: error?.code ?? 'missing_result' });
    return json({ error: 'Verkauf konnte nicht gespeichert werden' }, 500);
  }

  let tseActive = false;
  if (result.was_created) {
    const vatRates = [
      ...(sale.tax7 > 0 ? [vatRate(sale, 7, sale.tax7)] : []),
      ...(sale.tax19 > 0 ? [vatRate(sale, 19, sale.tax19)] : []),
    ];
    const tse = await signTransaction({
      tenantId: employee.tenant_id,
      bruttoGesamt: sale.subtotal,
      nettoGesamt: sale.net,
      mwstGesamt: sale.tax,
      vatRates,
      zahlungsart: paymentMethod,
      isTraining: body?.training === true,
    });
    if (tse) {
      const { error: tseError } = await svc.from('pos_transactions').update(tse).eq('id', result.transaction_id);
      tseActive = !tseError;
      if (tseError) console.error('POS TSE persistence failed', { code: tseError.code });
    }
  }

  return NextResponse.json({
    ok: true,
    transactionId: result.transaction_id,
    orderId: result.order_id,
    orderNumber: result.order_number,
    bonToken: result.bon_token,
    bonNumber: result.bon_number,
    amountCents: Math.round(sale.paymentTotal * 100),
    changeCents: paymentMethod === 'bar' ? Math.round((cashGiven - sale.paymentTotal) * 100) : 0,
    idempotent: !result.was_created,
    tseActive,
  }, { status: result.was_created ? 201 : 200, headers: PRIVATE_HEADERS });
}

function vatRate(sale: ReturnType<typeof resolvePosCart>, rate: 7 | 19, tax: number) {
  const gross = sale.items.filter((item) => item.taxRate === rate)
    .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  return {
    satz: rate,
    brutto: Number(gross.toFixed(2)),
    netto: Number((gross - tax).toFixed(2)),
    steuer: tax,
  };
}

async function verifySumUpPayment(input: {
  svc: ReturnType<typeof createServiceClient>;
  tenantId: string;
  checkoutId: string;
  idempotencyKey: string;
  paymentTotal: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.checkoutId) return { ok: false, error: 'Bestätigte SumUp-Zahlung fehlt' };
  const { data: tenant } = await input.svc.from('tenants')
    .select('sumup_api_key,sumup_merchant_code').eq('id', input.tenantId).maybeSingle();
  if (!tenant?.sumup_api_key || !tenant.sumup_merchant_code) {
    return { ok: false, error: 'SumUp ist nicht eingerichtet' };
  }
  try {
    const response = await fetch(
      'https://api.sumup.com/v0.1/checkouts/' + encodeURIComponent(input.checkoutId),
      { headers: { Authorization: 'Bearer ' + tenant.sumup_api_key }, cache: 'no-store' },
    );
    if (!response.ok) return { ok: false, error: 'SumUp-Zahlung konnte nicht bestätigt werden' };
    const checkout = await response.json() as {
      status?: string;
      amount?: number;
      currency?: string;
      checkout_reference?: string;
      merchant_code?: string;
    };
    const amountMatches = Math.abs(Number(checkout.amount) - input.paymentTotal) < 0.005;
    if (checkout.status !== 'PAID'
      || checkout.currency !== 'EUR'
      || checkout.checkout_reference !== 'pos-' + input.idempotencyKey
      || checkout.merchant_code !== tenant.sumup_merchant_code
      || !amountMatches) {
      return { ok: false, error: 'SumUp-Zahlung ist nicht eindeutig bestätigt' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'SumUp ist derzeit nicht erreichbar' };
  }
}

function json(payload: Record<string, unknown>, status: number) {
  return NextResponse.json(payload, { status, headers: PRIVATE_HEADERS });
}
