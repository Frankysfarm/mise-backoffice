/**
 * GET  /api/delivery/admin/credit-rules
 * POST /api/delivery/admin/credit-rules
 *
 * GET:  Lädt alle Kreditregeln für die Location des eingeloggten Admins.
 * POST: Erstellt oder aktualisiert eine Regel (UPSERT auf trigger_type).
 *   Body: { trigger_type, threshold_min?, credit_eur, credit_pct?,
 *           max_credit_eur?, expires_in_days?, active? }
 *
 * Auth: employees.auth_user_id → location_id
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCreditRules, upsertCreditRule, type CreditTrigger } from '@/lib/delivery/credits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_TRIGGERS: CreditTrigger[] = ['late_delivery', 'failed_delivery', 'manual'];

export async function GET(_req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  const locationId = emp?.location_id as string | null;
  if (!locationId) return NextResponse.json({ error: 'Kein Employee-Konto' }, { status: 403 });

  const rules = await getCreditRules(locationId);
  return NextResponse.json({ rules });
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
  if (!locationId) return NextResponse.json({ error: 'Kein Employee-Konto' }, { status: 403 });

  const body = await req.json() as {
    trigger_type?: unknown;
    threshold_min?: unknown;
    credit_eur?: unknown;
    credit_pct?: unknown;
    max_credit_eur?: unknown;
    expires_in_days?: unknown;
    active?: unknown;
  };

  if (!body.trigger_type || !VALID_TRIGGERS.includes(body.trigger_type as CreditTrigger)) {
    return NextResponse.json({ error: `trigger_type muss einer von: ${VALID_TRIGGERS.join(', ')} sein` }, { status: 400 });
  }
  if (!body.credit_eur || typeof body.credit_eur !== 'number' || body.credit_eur <= 0) {
    return NextResponse.json({ error: 'credit_eur muss eine positive Zahl sein' }, { status: 400 });
  }

  const rule = await upsertCreditRule(locationId, {
    triggerType:   body.trigger_type as CreditTrigger,
    thresholdMin:  typeof body.threshold_min === 'number' ? body.threshold_min : null,
    creditEur:     body.credit_eur,
    creditPct:     typeof body.credit_pct === 'number'    ? body.credit_pct    : null,
    maxCreditEur:  typeof body.max_credit_eur === 'number' ? body.max_credit_eur : 10,
    expiresInDays: typeof body.expires_in_days === 'number' ? body.expires_in_days : 30,
    active:        typeof body.active === 'boolean' ? body.active : true,
  });

  return NextResponse.json({ rule }, { status: 201 });
}
