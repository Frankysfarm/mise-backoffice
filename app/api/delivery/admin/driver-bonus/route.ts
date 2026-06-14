import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getBonusDashboard,
  getBonusEvents,
  upsertBonusConfig,
  deleteBonusConfig,
  updateBonusEventStatus,
  issueManualBonus,
  evaluateBonusesForLocation,
  type BonusType,
  type BonusPeriod,
  type BonusStatus,
} from '@/lib/delivery/driver-bonus';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const qp = new URL(req.url).searchParams.get('location_id');
  if (qp) return qp;
  const sb = createServiceClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('user_id', session.user.id)
    .single();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') ?? 'dashboard';

  try {
    if (action === 'events') {
      const status  = (searchParams.get('status') as BonusStatus | null) ?? undefined;
      const days    = Math.min(Number(searchParams.get('days') ?? 30), 90);
      const events  = await getBonusEvents(locationId, { status, days });
      return NextResponse.json({ events });
    }

    const dashboard = await getBonusDashboard(locationId);
    return NextResponse.json(dashboard);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const action: string = body.action ?? '';

    if (action === 'evaluate') {
      const result = await evaluateBonusesForLocation(locationId, body.reference_date);
      return NextResponse.json(result);
    }

    if (action === 'manual_bonus') {
      const event = await issueManualBonus({
        locationId,
        driverId:       body.driver_id,
        driverName:     body.driver_name,
        bonusAmountEur: Number(body.bonus_amount_eur ?? 0),
        notes:          body.notes ?? 'Manueller Bonus',
        referenceDate:  body.reference_date,
      });
      return NextResponse.json({ event });
    }

    if (action === 'upsert_config') {
      const cfg = await upsertBonusConfig({
        id:             body.id,
        locationId,
        bonusType:      body.bonus_type as BonusType,
        label:          body.label,
        thresholdValue: Number(body.threshold_value),
        bonusAmountEur: Number(body.bonus_amount_eur),
        period:         (body.period as BonusPeriod) ?? 'daily',
        enabled:        body.enabled !== false,
      });
      return NextResponse.json({ config: cfg });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body   = await req.json();
    const ids    = Array.isArray(body.event_ids) ? (body.event_ids as string[]) : [];
    const status = body.status as 'approved' | 'paid' | 'cancelled';

    if (!ids.length || !['approved', 'paid', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'event_ids[] und gültiger status erforderlich' }, { status: 400 });
    }

    const result = await updateBonusEventStatus(ids, status, locationId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const configId = searchParams.get('config_id');
  if (!configId) return NextResponse.json({ error: 'config_id erforderlich' }, { status: 400 });

  try {
    await deleteBonusConfig(configId, locationId);
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
