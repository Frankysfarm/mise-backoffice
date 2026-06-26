/**
 * GET /api/delivery/admin/kitchen-kochziel-ampel?location_id=...&ziel=80
 *
 * Schicht-Kochziel-Ampel: Prüft ob das Tages-Bestellungsziel erreichbar ist.
 *
 * Response:
 *   { ok, data: KochzielData, generatedAt: string }
 *
 * Multi-Tenant: alle Queries filtern location_id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface KochzielData {
  ziel: number;
  aktuelleBestellungen: number;
  stundenVerbleibend: number;
  prognosenBestellungen: number;
  erreichbarkeit_pct: number;
  status: 'uebertroffen' | 'auf-kurs' | 'hinter-plan' | 'kritisch';
  generatedAt: string;
}

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  return (emp?.location_id as string) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const ziel = Math.max(1, parseInt(searchParams.get('ziel') ?? '80', 10));

  const ssb = createServiceClient();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  // Schichtende: 22:00 UTC heute
  const shiftEnd = new Date(now);
  shiftEnd.setUTCHours(22, 0, 0, 0);

  // Schichtstart: 00:00 UTC heute
  const shiftStart = new Date(now);
  shiftStart.setUTCHours(0, 0, 0, 0);

  const totalShiftHours = (shiftEnd.getTime() - shiftStart.getTime()) / 3_600_000; // 22 hours
  const stundenVerbleibend = Math.max(0, (shiftEnd.getTime() - now.getTime()) / 3_600_000);

  // Count today's orders (not storniert)
  const { count } = await ssb
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .neq('status', 'storniert')
    .gte('created_at', todayStart.toISOString());

  const aktuelleBestellungen = count ?? 0;

  // Calculate prognose
  const stundenVergangen = totalShiftHours - stundenVerbleibend;
  let prognosenBestellungen: number;
  if (stundenVergangen < 0.01) {
    prognosenBestellungen = 0;
  } else {
    prognosenBestellungen = Math.round(
      (aktuelleBestellungen / stundenVergangen) * totalShiftHours,
    );
  }

  const erreichbarkeit_pct = Math.round((prognosenBestellungen / ziel) * 100);

  let status: KochzielData['status'];
  if (aktuelleBestellungen >= ziel) {
    status = 'uebertroffen';
  } else if (prognosenBestellungen >= ziel * 0.9) {
    status = 'auf-kurs';
  } else if (prognosenBestellungen >= ziel * 0.7) {
    status = 'hinter-plan';
  } else {
    status = 'kritisch';
  }

  const data: KochzielData = {
    ziel,
    aktuelleBestellungen,
    stundenVerbleibend: Math.round(stundenVerbleibend * 10) / 10,
    prognosenBestellungen,
    erreichbarkeit_pct,
    status,
    generatedAt: now.toISOString(),
  };

  return NextResponse.json({ ok: true, data, generatedAt: now.toISOString() });
}
