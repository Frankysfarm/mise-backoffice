/**
 * GET/POST /api/delivery/admin/driver-lending
 *
 * Smart Cross-Location Driver Lending Engine — Phase 348
 *
 * GET ?action=dashboard  → Übersicht: Kandidaten + Anfragen + KPIs
 * GET ?action=config     → Tenant-Konfiguration
 * GET ?action=candidates → Lending-Kandidaten neu berechnen
 * POST action=update_config  → Konfiguration speichern
 * POST action=create         → Neue Lending-Anfrage anlegen
 *   body: { from_location_id, to_location_id, driver_id, notes? }
 * POST action=update_status  → Status ändern (accepted/rejected/active/completed/cancelled)
 *   body: { request_id, status }
 * POST action=prune          → alte abgeschlossene Anfragen löschen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getConfig,
  upsertConfig,
  detectCandidates,
  createLendingRequest,
  updateLendingStatus,
  getDashboard,
  pruneOldRequests,
} from '@/lib/delivery/driver-lending';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveTenantId(req: NextRequest): Promise<string | null> {
  void req;
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!emp?.location_id) return null;

  const { data: loc } = await sb
    .from('locations')
    .select('tenant_id')
    .eq('id', emp.location_id as string)
    .maybeSingle();

  return (loc?.tenant_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const tenantId = await resolveTenantId(req);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  try {
    if (action === 'config') {
      const config = await getConfig(tenantId);
      return NextResponse.json({ config });
    }
    if (action === 'candidates') {
      const candidates = await detectCandidates(tenantId);
      return NextResponse.json({ candidates });
    }
    // default: dashboard
    const dashboard = await getDashboard(tenantId);
    return NextResponse.json(dashboard);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const tenantId = await resolveTenantId(req);
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const { data: emp } = user
    ? await sb.from('employees').select('id').eq('user_id', user.id).maybeSingle()
    : { data: null };
  const employeeId = (emp?.id as string | null) ?? null;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const action = body.action as string | undefined;

  try {
    if (action === 'update_config') {
      const cfg = await upsertConfig(tenantId, {
        isEnabled: body.is_enabled as boolean | undefined,
        maxDistanceKm: body.max_distance_km != null ? Number(body.max_distance_km) : undefined,
        minIdleToLend: body.min_idle_to_lend != null ? Number(body.min_idle_to_lend) : undefined,
        minPendingToRequest:
          body.min_pending_to_request != null
            ? Number(body.min_pending_to_request)
            : undefined,
        autoSuggest: body.auto_suggest as boolean | undefined,
        hourlyCompensationEur:
          body.hourly_compensation_eur != null
            ? Number(body.hourly_compensation_eur)
            : undefined,
      });
      return NextResponse.json({ ok: true, config: cfg });
    }

    if (action === 'create') {
      const { from_location_id, to_location_id, driver_id, notes } = body as {
        from_location_id?: string;
        to_location_id?: string;
        driver_id?: string;
        notes?: string;
      };
      if (!from_location_id || !to_location_id || !driver_id) {
        return NextResponse.json(
          { error: 'from_location_id, to_location_id und driver_id erforderlich' },
          { status: 400 },
        );
      }
      const request = await createLendingRequest(
        tenantId,
        from_location_id,
        to_location_id,
        driver_id,
        employeeId,
        notes,
      );
      return NextResponse.json({ ok: true, request });
    }

    if (action === 'update_status') {
      const { request_id, status } = body as { request_id?: string; status?: string };
      if (!request_id || !status) {
        return NextResponse.json(
          { error: 'request_id und status erforderlich' },
          { status: 400 },
        );
      }
      const validStatuses = ['accepted', 'rejected', 'active', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Ungültiger Status' }, { status: 400 });
      }
      const request = await updateLendingStatus(
        request_id,
        tenantId,
        status as 'accepted' | 'rejected' | 'active' | 'completed' | 'cancelled',
      );
      return NextResponse.json({ ok: true, request });
    }

    if (action === 'prune') {
      const daysToKeep = body.days_to_keep != null ? Number(body.days_to_keep) : 90;
      const result = await pruneOldRequests(daysToKeep);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: `Unbekannte Aktion: ${action}` }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
