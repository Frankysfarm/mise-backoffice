import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTourProfitDashboard } from '@/lib/delivery/tour-profit';

async function getLocationId(req: NextRequest): Promise<string | null> {
  const override = req.nextUrl.searchParams.get('location_id');
  if (override) return override;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', user.id)
    .maybeSingle();

  return (emp as { location_id: string | null } | null)?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const dashboard = await getTourProfitDashboard(locationId);
    return NextResponse.json({ ok: true, ...dashboard });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
