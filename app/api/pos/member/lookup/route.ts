import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requirePosAccess } from '@/lib/auth/requireRole';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/pos/member/lookup?id=UUID
 *
 * Sucht Customer-Profile in 2 Quellen:
 *  - customer_profiles (Stammkunden mit bonus_points)
 *  - loyalty_customers (Stempelkarten-Members)
 *
 * Liefert ein konsolidiertes Member-Objekt + aktive Coupons.
 */
export async function GET(req: NextRequest) {
  const emp = await requirePosAccess();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees')
    .select('tenant_id, location_id')
    .eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id) {
    return NextResponse.json({ error: 'Keine Tenant-Zuordnung' }, { status: 400 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id-Param fehlt' }, { status: 400 });

  const tenantId = empRow.tenant_id;

  // 1) Direkter Lookup: customer_profiles
  const { data: profile } = await svc.from('customer_profiles')
    .select('id, name, email, telefon, anzahl_bestellungen, umsatz_total, bonus_points, letzter_besuch')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  // 2) Direkter Lookup: loyalty_customers
  const { data: loyalty } = await svc.from('loyalty_customers')
    .select('id, first_name, last_name, email, phone, stamps, rewards_redeemed, total_spent_cents, visits_count, last_visit_at, birthday')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!profile && !loyalty) {
    return NextResponse.json({ found: false, error: 'Kein Member mit dieser ID' }, { status: 404 });
  }

  // 3) Aktive Coupons (Mise-weit für diesen Tenant)
  const todayIso = new Date().toISOString().slice(0, 10);
  const { data: activeCoupons } = await svc.from('loyalty_coupons')
    .select('id, code, name, beschreibung, typ, wert, mindestbestellwert, gueltig_bis')
    .eq('tenant_id', tenantId)
    .eq('aktiv', true)
    .or(`gueltig_bis.is.null,gueltig_bis.gte.${todayIso}`);

  const member = {
    found: true,
    id: profile?.id ?? loyalty?.id,
    name: profile?.name ?? [loyalty?.first_name, loyalty?.last_name].filter(Boolean).join(' ') ?? 'Mitglied',
    email: profile?.email ?? loyalty?.email,
    telefon: profile?.telefon ?? loyalty?.phone,
    bonus_points: profile?.bonus_points ?? null,
    umsatz_total: profile?.umsatz_total ?? (loyalty?.total_spent_cents ? Number(loyalty.total_spent_cents) / 100 : null),
    anzahl_bestellungen: profile?.anzahl_bestellungen ?? loyalty?.visits_count ?? null,
    stamps: loyalty?.stamps ?? null,
    rewards_redeemed: loyalty?.rewards_redeemed ?? null,
    letzter_besuch: profile?.letzter_besuch ?? loyalty?.last_visit_at ?? null,
    birthday: loyalty?.birthday ?? null,
    coupons: activeCoupons ?? [],
  };

  return NextResponse.json(member);
}
