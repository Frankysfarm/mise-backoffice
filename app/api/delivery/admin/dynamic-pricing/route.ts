/**
 * GET+POST /api/delivery/admin/dynamic-pricing
 *
 * Phase 340 — Dynamic Pricing Engine API
 *
 * GET  ?action=config      → Konfiguration laden
 * GET  ?action=dashboard   → Dashboard-Daten (KPIs + Events + Muster)
 * GET  ?action=events      → Ereignis-Log (last 50)
 *
 * POST action=update_config   → Konfiguration speichern
 * POST action=toggle          → Dynamic Pricing an/aus
 * POST action=preview         → Gebühr berechnen ohne DB-Write
 * POST action=prune           → Alte Events bereinigen
 *
 * Auth: employees.location_id
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getDynamicPricingConfig,
  upsertDynamicPricingConfig,
  computeDynamicFee,
  logPricingEvent,
  getDynamicPricingDashboard,
  getRecentPricingEvents,
  pruneOldPricingEvents,
  type SurgeLevel,
} from '@/lib/delivery/dynamic-pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const qsLoc = req.nextUrl.searchParams.get('location_id');
  if (qsLoc) {
    const svc = createServiceClient();
    const { data: emp } = await svc
      .from('employees')
      .select('tenant_id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (emp?.tenant_id) return qsLoc;
  }

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  return (emp?.location_id as string | null) ?? null;
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const locationId = await resolveLocationId(req);
    if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

    if (action === 'config') {
      const config = await getDynamicPricingConfig(locationId);
      return NextResponse.json({ ok: true, config });
    }

    if (action === 'events') {
      const limit = Math.min(100, parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10));
      const events = await getRecentPricingEvents(locationId, limit);
      return NextResponse.json({ ok: true, events });
    }

    // default: dashboard
    const dashboard = await getDynamicPricingDashboard(locationId);
    return NextResponse.json({ ok: true, ...dashboard });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const locationId = await resolveLocationId(req);
    if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json() as Record<string, unknown>;
    const action = body.action as string;

    if (action === 'toggle') {
      const current = await getDynamicPricingConfig(locationId);
      const updated = await upsertDynamicPricingConfig(locationId, {
        isEnabled: !current.isEnabled,
      });
      return NextResponse.json({ ok: true, isEnabled: updated.isEnabled, config: updated });
    }

    if (action === 'update_config') {
      const cfg = await upsertDynamicPricingConfig(locationId, {
        isEnabled:             body.isEnabled as boolean | undefined,
        multiplierNormal:      body.multiplierNormal      != null ? Number(body.multiplierNormal)      : undefined,
        multiplierSurgeLow:    body.multiplierSurgeLow    != null ? Number(body.multiplierSurgeLow)    : undefined,
        multiplierSurgeMid:    body.multiplierSurgeMid    != null ? Number(body.multiplierSurgeMid)    : undefined,
        multiplierSurgeHigh:   body.multiplierSurgeHigh   != null ? Number(body.multiplierSurgeHigh)   : undefined,
        maxSurchargeEur:       body.maxSurchargeEur       != null ? Number(body.maxSurchargeEur)       : undefined,
        offPeakEnabled:        body.offPeakEnabled as boolean | undefined,
        offPeakDiscountPct:    body.offPeakDiscountPct    != null ? Number(body.offPeakDiscountPct)    : undefined,
        offPeakStartHour:      body.offPeakStartHour      != null ? Number(body.offPeakStartHour)      : undefined,
        offPeakEndHour:        body.offPeakEndHour        != null ? Number(body.offPeakEndHour)        : undefined,
        customerBannerEnabled: body.customerBannerEnabled as boolean | undefined,
      });
      return NextResponse.json({ ok: true, config: cfg });
    }

    if (action === 'preview') {
      const baseFee    = Number(body.baseFeeEur ?? 2.99);
      const surgeLevel = (body.surgeLevel as SurgeLevel) ?? 'none';
      const result = await computeDynamicFee(locationId, baseFee, surgeLevel);
      // Preview ohne Log-Write (orderId = null) — optional loggen wenn preview_log=true
      if (body.logEvent === true) {
        void logPricingEvent(locationId, null, result);
      }
      return NextResponse.json({ ok: true, preview: result });
    }

    if (action === 'prune') {
      const days = Number(body.daysToKeep ?? 30);
      const result = await pruneOldPricingEvents(days);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: 'Unbekannte Action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
