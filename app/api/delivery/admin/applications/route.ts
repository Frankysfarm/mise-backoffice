import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getApplications,
  getOnboardingFunnelStats,
  type ApplicationStatus,
  type ApplicationFilters,
} from '@/lib/delivery/onboarding';

// GET /api/delivery/admin/applications?location_id=&status=&search=&view=funnel
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp         = req.nextUrl.searchParams;
  const locationId = sp.get('location_id');
  const view       = sp.get('view') ?? 'list';

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  if (view === 'funnel') {
    const stats = await getOnboardingFunnelStats(locationId);
    return NextResponse.json({ stats });
  }

  const filters: ApplicationFilters = {
    status: (sp.get('status') ?? undefined) as ApplicationStatus | undefined,
    search: sp.get('search') ?? undefined,
    limit:  Math.min(Number(sp.get('limit') ?? 50), 200),
    offset: Number(sp.get('offset') ?? 0),
  };

  try {
    const applications = await getApplications(locationId, filters);
    return NextResponse.json({ applications, count: applications.length });
  } catch (err) {
    console.error('[admin/applications GET]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
