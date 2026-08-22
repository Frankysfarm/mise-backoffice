/**
 * GET /api/delivery/admin/franchise?action=overview
 * GET /api/delivery/admin/franchise?action=alerts
 *
 * Franchise Real-Time Command Center — Phase 32
 *
 * Shows live operational status for ALL locations of the calling user's tenant.
 * Complements the period-based /api/delivery/admin/reporting?type=multi with
 * real-time data: queue depth, active tours, kitchen load, alert counts.
 *
 * Auth: must be an authenticated employee of at least one location.
 * Tenant is derived automatically from the caller's location.
 *
 * action=overview (default)
 *   Returns full FranchiseSummary:
 *   {
 *     tenant_id, locations[], drivers{}, alerts[], totals{}, generated_at,
 *     _fallback?: true   — when Migration 028 is not yet applied
 *   }
 *
 * action=alerts
 *   Returns only active alerts across all tenant locations:
 *   { alerts: FranchiseAlert[] }
 *
 * action=locations
 *   Returns static location list for the tenant:
 *   { locations: TenantLocation[] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getFranchiseSummary,
  getFranchiseAlerts,
  getTenantLocations,
} from '@/lib/delivery/franchise';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  // Resolve calling user's tenant via employees → locations
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!emp?.location_id) {
    return NextResponse.json(
      { error: 'Keine Location-Zugehörigkeit für diesen Nutzer' },
      { status: 403 },
    );
  }

  const { data: loc } = await sb
    .from('locations')
    .select('tenant_id')
    .eq('id', emp.location_id)
    .maybeSingle();

  const tenantId = loc?.tenant_id as string | undefined;
  if (!tenantId) {
    return NextResponse.json(
      { error: 'Tenant-ID nicht gefunden' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') ?? 'overview';

  try {
    if (action === 'alerts') {
      const alerts = await getFranchiseAlerts(tenantId);
      return NextResponse.json({ alerts, tenant_id: tenantId });
    }

    if (action === 'locations') {
      const locations = await getTenantLocations(tenantId);
      return NextResponse.json({ locations, tenant_id: tenantId });
    }

    // action=overview (default)
    const summary = await getFranchiseSummary(tenantId);
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Franchise-Abfrage fehlgeschlagen' },
      { status: 500 },
    );
  }
}
