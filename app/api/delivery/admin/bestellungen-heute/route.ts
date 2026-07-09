/**
 * GET /api/delivery/admin/bestellungen-heute?location_id=<uuid>
 *
 * Phase 899 — Bestellungen-Heute-API
 * Tagesbestellzähler je Standort + aktive Bestellungen jetzt.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get('location_id');
  if (fromQuery) return fromQuery;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = await createClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const ACTIVE_STATUSES = ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs', 'abgeholt', 'dispatched', 'in_delivery'];

  const [{ count: bestellungenHeute }, { count: bestellungenAktiv }] = await Promise.all([
    sb
      .from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString()),
    sb
      .from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .in('status', ACTIVE_STATUSES),
  ]);

  return NextResponse.json({
    bestellungen_heute: bestellungenHeute ?? 0,
    bestellungen_jetzt_aktiv: bestellungenAktiv ?? 0,
    generatedAt: now.toISOString(),
  });
}
