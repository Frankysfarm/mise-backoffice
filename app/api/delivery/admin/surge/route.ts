/**
 * GET+POST+PATCH /api/delivery/admin/surge
 *
 * Surge Pricing + Driver Incentive — Admin API
 *
 * GET  ?location_id=...
 *   → SurgeSummary (Status + Verlauf + Fahrer-Boni)
 *
 * GET  ?location_id=...&action=rules
 *   → SurgeRule[] für die Location
 *
 * GET  ?location_id=...&action=status
 *   → SurgeStatus (schlanker Echtzeit-Status)
 *
 * POST { action: 'configure', location_id, rule: SurgeRuleInput }
 *   → Surge-Regel anlegen / aktualisieren
 *
 * POST { action: 'activate', location_id, multiplier, driver_bonus_eur }
 *   → Surge manuell aktivieren
 *
 * POST { action: 'deactivate', location_id }
 *   → Aktiven Surge beenden
 *
 * POST { action: 'evaluate', location_id }
 *   → Surge-Bedingungen sofort auswerten (debug)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getSurgeSummary,
  getCurrentSurge,
  listSurgeRules,
  configureSurgeRule,
  manuallyActivateSurge,
  manuallyDeactivateSurge,
  evaluateSurgeForLocation,
  type SurgeRuleInput,
} from '@/lib/delivery/surge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(
  sb: Awaited<ReturnType<typeof createClient>>,
  queryLocationId: string | null,
): Promise<string | null> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!emp?.location_id) return null;

  // Wenn location_id übergeben: prüfen ob sie zum eigenen Tenant gehört
  if (queryLocationId && queryLocationId !== emp.location_id) {
    const { data: ownLoc } = await sb
      .from('locations')
      .select('tenant_id')
      .eq('id', emp.location_id)
      .maybeSingle();

    const { data: targetLoc } = await sb
      .from('locations')
      .select('tenant_id')
      .eq('id', queryLocationId)
      .maybeSingle();

    if (!ownLoc || !targetLoc || ownLoc.tenant_id !== targetLoc.tenant_id) {
      return null;
    }
    return queryLocationId;
  }

  return queryLocationId ?? emp.location_id;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { searchParams } = new URL(req.url);
  const locationId = await resolveLocationId(sb, searchParams.get('location_id'));

  if (!locationId) {
    return NextResponse.json({ error: 'Nicht eingeloggt oder Location nicht gefunden' }, { status: 401 });
  }

  const action = searchParams.get('action') ?? 'summary';

  try {
    if (action === 'rules') {
      const rules = await listSurgeRules(locationId);
      return NextResponse.json({ rules, location_id: locationId });
    }

    if (action === 'status') {
      const status = await getCurrentSurge(locationId);
      return NextResponse.json({ status, location_id: locationId });
    }

    // Default: Vollständiges Summary
    const summary = await getSurgeSummary(locationId);
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? 'Interner Fehler' },
      { status: 500 },
    );
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const sb = await createClient();

  const body = await req.json() as {
    action?: string;
    location_id?: string;
    rule?: SurgeRuleInput;
    multiplier?: number;
    driver_bonus_eur?: number;
  };

  const locationId = await resolveLocationId(sb, body.location_id ?? null);
  if (!locationId) {
    return NextResponse.json({ error: 'Nicht eingeloggt oder Location nicht gefunden' }, { status: 401 });
  }

  const action = body.action ?? 'configure';

  try {
    if (action === 'configure') {
      if (!body.rule) {
        return NextResponse.json({ error: 'rule-Objekt fehlt' }, { status: 400 });
      }
      const rule = await configureSurgeRule(locationId, body.rule);
      return NextResponse.json({ ok: true, rule });
    }

    if (action === 'activate') {
      const multiplier = Number(body.multiplier ?? 1.25);
      const driverBonusEur = Number(body.driver_bonus_eur ?? 0.50);

      if (multiplier < 1.0 || multiplier > 3.0) {
        return NextResponse.json({ error: 'multiplier muss zwischen 1.0 und 3.0 liegen' }, { status: 400 });
      }

      const event = await manuallyActivateSurge(locationId, multiplier, driverBonusEur);
      return NextResponse.json({ ok: true, event });
    }

    if (action === 'deactivate') {
      const ended = await manuallyDeactivateSurge(locationId);
      return NextResponse.json({ ok: true, ended });
    }

    if (action === 'evaluate') {
      const result = await evaluateSurgeForLocation(locationId);
      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.json({ error: `Unbekannte Action: ${action}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? 'Interner Fehler' },
      { status: 500 },
    );
  }
}
