import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  generateRecommendations,
  getRecommendationsDashboard,
  resolveRecommendation,
  pruneOldRecommendations,
} from '@/lib/delivery/ops-recommendations';

async function getLocationId(
  req: NextRequest,
): Promise<{ locationId: string | null }> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { locationId: null };

  const { data: employee } = await sb
    .from('employees')
    .select('location_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  const override = req.nextUrl.searchParams.get('location_id');
  const locationId =
    employee?.role === 'superadmin' && override
      ? override
      : (employee?.location_id as string | null);

  return { locationId };
}

export async function GET(req: NextRequest) {
  const { locationId } = await getLocationId(req);
  if (!locationId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await getRecommendationsDashboard(locationId);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { locationId } = await getLocationId(req);
  if (!locationId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as Record<string, unknown>;
  const { action } = body;

  if (action === 'resolve') {
    const { id, status } = body as {
      id: string;
      status: 'accepted' | 'dismissed';
    };
    if (!id || !['accepted', 'dismissed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
    }
    await resolveRecommendation(id, locationId, status);
    const data = await getRecommendationsDashboard(locationId);
    return NextResponse.json(data);
  }

  if (action === 'run_now') {
    await generateRecommendations(locationId);
    const data = await getRecommendationsDashboard(locationId);
    return NextResponse.json(data);
  }

  if (action === 'prune') {
    const pruned = await pruneOldRecommendations(7);
    return NextResponse.json({ pruned });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
