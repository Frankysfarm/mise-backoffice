/**
 * GET  /api/delivery/admin/loyalty
 *   ?location_id=...
 *   ?location_id=...&view=transactions&email=...
 *
 * POST /api/delivery/admin/loyalty
 *   { location_id, email, points, reason }  — manuelle Punkte-Anpassung
 *
 * Auth: Manager+ erforderlich
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getLeaderboard,
  getLoyaltyKpis,
  getTransactionHistory,
  manualAdjust,
} from '@/lib/delivery/loyalty-points';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(userId: string, requested: string | null): Promise<string | null> {
  const { createServiceClient } = await import('@/lib/supabase/server');
  const svc = createServiceClient();
  const { data } = await svc
    .from('employees')
    .select('location_id, role')
    .eq('auth_user_id', userId)
    .maybeSingle();
  if (!data) return null;
  if (requested) return requested;
  return data.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = await resolveLocationId(user.id, searchParams.get('location_id'));
  if (!locationId) return NextResponse.json({ error: 'location_id nicht gefunden' }, { status: 400 });

  const view = searchParams.get('view') ?? 'overview';

  if (view === 'transactions') {
    const email = searchParams.get('email') ?? '';
    if (!email) return NextResponse.json({ error: 'email erforderlich' }, { status: 400 });
    const history = await getTransactionHistory(email, locationId, 50);
    return NextResponse.json({ transactions: history });
  }

  const [kpis, leaderboard] = await Promise.all([
    getLoyaltyKpis(locationId),
    getLeaderboard(locationId, 25),
  ]);

  return NextResponse.json({ kpis, leaderboard });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json() as {
    location_id?: string;
    email?: string;
    points?: number;
    reason?: string;
  };

  if (!body.email || !body.location_id || body.points === undefined || !body.reason) {
    return NextResponse.json({ error: 'email, location_id, points und reason erforderlich' }, { status: 400 });
  }

  const locationId = await resolveLocationId(user.id, body.location_id);
  if (!locationId) return NextResponse.json({ error: 'location_id nicht gefunden' }, { status: 400 });

  const result = await manualAdjust({
    customerEmail: body.email,
    locationId,
    points:        body.points,
    reason:        body.reason,
    adminId:       user.id,
  });

  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
