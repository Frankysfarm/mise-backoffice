import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { resolvePosCart, type PosMenuItem, type PosFulfillment } from '@/lib/pos/checkout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const denied = checkOrigin(req);
  if (denied) return denied;
  const context = await getEmployeeContext();
  if ('response' in context) return context.response;
  const body = await req.json().catch(() => null);
  const idempotencyKey = String(body?.idempotencyKey ?? req.headers.get('idempotency-key') ?? '').trim();
  const registerId = String(body?.registerId ?? '').trim();
  const shiftId = String(body?.shiftId ?? '').trim();
  const tableId = body?.tableId ? String(body.tableId).trim() : null;
  const fulfillment = parseFulfillment(body?.fulfillment);
  if (!UUID_RE.test(idempotencyKey) || !UUID_RE.test(registerId) || !UUID_RE.test(shiftId)
    || !fulfillment || (fulfillment === 'table' && !tableId) || (tableId && !UUID_RE.test(tableId))) {
    return json({ ok: false, error: 'Ungültige SumUp-Anfrage' }, 400);
  }

  const { svc, employee } = context;
  const valid = await validateRegisterShiftTable({ svc, employee, registerId, shiftId, tableId });
  if (!valid) return json({ ok: false, error: 'Kasse, Schicht oder Tisch ist nicht aktiv' }, 409);
  if (!Array.isArray(body?.items) || body.items.length < 1 || body.items.length > 100) {
    return json({ ok: false, error: 'Warenkorb ist leer oder zu groß' }, 400);
  }

  const itemIds = [...new Set(body.items.map((item: { id?: unknown }) => String(item?.id ?? '')).filter(Boolean))];
  const { data: menuItems } = await svc.from('menu_items')
    .select('id,name,preis,mwst_satz,option_groups').in('id', itemIds)
    .eq('tenant_id', employee.tenant_id).eq('location_id', employee.location_id).eq('verfuegbar', true);
  let sale;
  try {
    sale = resolvePosCart({ rawItems: body.items, menuItems: (menuItems ?? []) as PosMenuItem[], fulfillment, tip: body.tip });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Ungültiger Warenkorb' }, 400);
  }

  const tenant = await getSumUpTenant(svc, employee.tenant_id);
  if (!tenant) return json({ ok: false, error: 'SumUp ist nicht eingerichtet' }, 503);
  try {
    const response = await fetch('https://api.sumup.com/v0.1/checkouts', {
      method: 'POST', cache: 'no-store',
      headers: { Authorization: 'Bearer ' + tenant.sumup_api_key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checkout_reference: 'pos-' + idempotencyKey,
        amount: sale.paymentTotal, currency: 'EUR', merchant_code: tenant.sumup_merchant_code,
        description: `POS-Verkauf ${tenant.name}`.slice(0, 120),
      }),
    });
    if (!response.ok) {
      console.error('SumUp checkout creation failed', { status: response.status });
      return json({ ok: false, error: 'SumUp-Checkout konnte nicht erstellt werden' }, 502);
    }
    const checkout = await response.json() as { id?: string; status?: string };
    if (!checkout.id) return json({ ok: false, error: 'SumUp lieferte keinen Checkout' }, 502);
    return json({ ok: true, checkoutId: checkout.id, status: checkout.status ?? 'PENDING', amountCents: Math.round(sale.paymentTotal * 100) }, 201);
  } catch {
    return json({ ok: false, error: 'SumUp ist derzeit nicht erreichbar' }, 502);
  }
}

export async function GET(req: NextRequest) {
  const context = await getEmployeeContext();
  if ('response' in context) return context.response;
  const checkoutId = String(req.nextUrl.searchParams.get('checkoutId') ?? '').trim();
  const idempotencyKey = String(req.nextUrl.searchParams.get('idempotencyKey') ?? '').trim();
  if (!checkoutId || checkoutId.length > 160 || !UUID_RE.test(idempotencyKey)) {
    return json({ ok: false, error: 'Ungültiger SumUp-Statusabruf' }, 400);
  }
  const tenant = await getSumUpTenant(context.svc, context.employee.tenant_id);
  if (!tenant) return json({ ok: false, error: 'SumUp ist nicht eingerichtet' }, 503);
  try {
    const response = await fetch('https://api.sumup.com/v0.1/checkouts/' + encodeURIComponent(checkoutId), {
      headers: { Authorization: 'Bearer ' + tenant.sumup_api_key }, cache: 'no-store',
    });
    if (!response.ok) return json({ ok: false, error: 'SumUp-Status ist nicht verfügbar' }, 502);
    const checkout = await response.json() as { status?: string; checkout_reference?: string; merchant_code?: string; currency?: string };
    if (checkout.checkout_reference !== 'pos-' + idempotencyKey
      || checkout.merchant_code !== tenant.sumup_merchant_code || checkout.currency !== 'EUR') {
      return json({ ok: false, error: 'SumUp-Checkout gehört nicht zu diesem Verkauf' }, 409);
    }
    return json({ ok: true, status: checkout.status ?? 'PENDING' }, 200);
  } catch {
    return json({ ok: false, error: 'SumUp ist derzeit nicht erreichbar' }, 502);
  }
}

async function getEmployeeContext() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { response: json({ ok: false, error: 'Nicht eingeloggt' }, 401) };
  const svc = createServiceClient();
  const { data: employee } = await svc.from('employees').select('id,tenant_id,location_id').eq('auth_user_id', user.id).maybeSingle();
  if (!employee?.tenant_id || !employee.location_id) {
    return { response: json({ ok: false, error: 'Kein POS-Zugriff' }, 403) };
  }
  return { svc, employee: employee as { id: string; tenant_id: string; location_id: string } };
}

async function validateRegisterShiftTable(input: {
  svc: ReturnType<typeof createServiceClient>; employee: { id: string; tenant_id: string; location_id: string };
  registerId: string; shiftId: string; tableId: string | null;
}) {
  const [register, shift, table] = await Promise.all([
    input.svc.from('pos_registers').select('id').eq('id', input.registerId).eq('tenant_id', input.employee.tenant_id).eq('location_id', input.employee.location_id).eq('aktiv', true).maybeSingle(),
    input.svc.from('pos_shifts').select('id').eq('id', input.shiftId).eq('tenant_id', input.employee.tenant_id).eq('location_id', input.employee.location_id).eq('register_id', input.registerId).eq('employee_id', input.employee.id).eq('status', 'offen').maybeSingle(),
    input.tableId ? input.svc.from('restaurant_tables').select('id').eq('id', input.tableId).eq('tenant_id', input.employee.tenant_id).eq('location_id', input.employee.location_id).eq('aktiv', true).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return Boolean(register.data && shift.data && (!input.tableId || table.data));
}

async function getSumUpTenant(svc: ReturnType<typeof createServiceClient>, tenantId: string) {
  const { data } = await svc.from('tenants').select('sumup_api_key,sumup_merchant_code,name').eq('id', tenantId).maybeSingle();
  return data?.sumup_api_key && data.sumup_merchant_code ? data : null;
}

function parseFulfillment(value: unknown): PosFulfillment | null {
  return value === 'table' || value === 'counter' || value === 'takeaway' ? value : null;
}

function checkOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  return origin && origin !== req.nextUrl.origin ? json({ ok: false, error: 'Origin nicht erlaubt' }, 403) : null;
}

function json(payload: Record<string, unknown>, status: number) {
  return NextResponse.json(payload, { status, headers: PRIVATE_HEADERS });
}
