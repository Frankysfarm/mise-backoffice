/**
 * GET  /api/delivery/admin/credits
 * POST /api/delivery/admin/credits
 *
 * GET: Listet Gutschriften einer Location auf.
 *   ?status=issued|redeemed|expired|cancelled   (optional Filter)
 *   ?limit=50   ?offset=0   ?summary=true
 * POST: Stellt manuellen Credit aus.
 *   Body: { amount_eur, reason, order_id?, customer_name?, customer_email?,
 *           customer_phone?, notes?, expires_in_days? }
 *
 * Auth: employees.auth_user_id → location_id
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getCredits,
  getCreditSummary,
  issueManualCredit,
  type CreditStatus,
  type CreditReason,
} from '@/lib/delivery/credits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUSES: CreditStatus[] = ['issued', 'redeemed', 'expired', 'cancelled'];
const VALID_REASONS: CreditReason[]  = ['late_delivery', 'failed_delivery', 'manual', 'quality'];

async function getLocationId(sb: ReturnType<typeof createClient> extends Promise<infer T> ? T : never): Promise<string | null> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return (emp?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const locationId = await getLocationId(sb);
  if (!locationId) return NextResponse.json({ error: 'Nicht eingeloggt oder kein Employee' }, { status: 401 });

  const p = req.nextUrl.searchParams;

  if (p.get('summary') === 'true') {
    const summary = await getCreditSummary(locationId);
    return NextResponse.json({ summary: summary ?? null });
  }

  const statusParam = p.get('status');
  const status: CreditStatus | undefined =
    statusParam && VALID_STATUSES.includes(statusParam as CreditStatus)
      ? (statusParam as CreditStatus)
      : undefined;

  const limit  = Math.min(200, Math.max(1, parseInt(p.get('limit')  ?? '50', 10)));
  const offset = Math.max(0,               parseInt(p.get('offset') ?? '0',  10));

  const [credits, summary] = await Promise.all([
    getCredits(locationId, { status, limit, offset, withOrderDetails: true }),
    getCreditSummary(locationId),
  ]);

  return NextResponse.json({ credits, summary });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  const locationId = emp?.location_id as string | null;
  if (!locationId) return NextResponse.json({ error: 'Kein Employee-Konto gefunden' }, { status: 403 });

  const body = await req.json() as {
    amount_eur?: unknown;
    reason?: unknown;
    order_id?: unknown;
    customer_name?: unknown;
    customer_email?: unknown;
    customer_phone?: unknown;
    notes?: unknown;
    expires_in_days?: unknown;
  };

  if (!body.amount_eur || typeof body.amount_eur !== 'number' || body.amount_eur <= 0) {
    return NextResponse.json({ error: 'amount_eur muss eine positive Zahl sein' }, { status: 400 });
  }
  if (!body.reason || !VALID_REASONS.includes(body.reason as CreditReason)) {
    return NextResponse.json({ error: `reason muss einer von: ${VALID_REASONS.join(', ')} sein` }, { status: 400 });
  }

  const credit = await issueManualCredit({
    locationId,
    orderId:       typeof body.order_id === 'string'       ? body.order_id       : null,
    amountEur:     body.amount_eur,
    reason:        body.reason as CreditReason,
    customerName:  typeof body.customer_name === 'string'  ? body.customer_name  : null,
    customerEmail: typeof body.customer_email === 'string' ? body.customer_email : null,
    customerPhone: typeof body.customer_phone === 'string' ? body.customer_phone : null,
    notes:         typeof body.notes === 'string'          ? body.notes          : null,
    expiresInDays: typeof body.expires_in_days === 'number' ? body.expires_in_days : 30,
    createdBy:     user.id,
  });

  return NextResponse.json({ credit }, { status: 201 });
}
