/**
 * GET/POST /api/delivery/driver/shift-swap
 *
 * Phase 324 — Shift-Swap Engine Driver API
 *
 * GET  ?action=my_requests|open_requests|partners&shift_id=
 * POST { action: 'create'|'accept'|'reject'|'cancel' }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getDriverRequests,
  getOpenRequests,
  createSwapRequest,
  acceptSwapRequest,
  rejectSwapRequest,
  cancelSwapRequest,
  getAvailableSwapPartners,
} from '@/lib/delivery/shift-swap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveDriver(): Promise<{
  driverId: string;
  locationId: string;
} | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const svc = createServiceClient();
  const { data: driver } = await svc
    .from('mise_drivers')
    .select('id, location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!driver) return null;
  return {
    driverId:   driver.id as string,
    locationId: driver.location_id as string,
  };
}

export async function GET(req: NextRequest) {
  const auth = await resolveDriver();
  if (!auth) return NextResponse.json({ error: 'Kein Fahrer-Profil' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action  = searchParams.get('action') ?? 'my_requests';
  const shiftId = searchParams.get('shift_id');

  try {
    switch (action) {
      case 'my_requests':
        return NextResponse.json({
          requests: await getDriverRequests(auth.driverId, auth.locationId),
        });

      case 'open_requests':
        return NextResponse.json({
          requests: await getOpenRequests(auth.locationId),
        });

      case 'partners': {
        if (!shiftId) {
          return NextResponse.json({ error: 'shift_id erforderlich' }, { status: 400 });
        }
        return NextResponse.json({
          partners: await getAvailableSwapPartners(shiftId, auth.locationId),
        });
      }

      default:
        return NextResponse.json({ error: 'Unbekannte Action' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await resolveDriver();
  if (!auth) return NextResponse.json({ error: 'Kein Fahrer-Profil' }, { status: 401 });

  try {
    const body   = await req.json() as Record<string, unknown>;
    const action = body.action as string;

    switch (action) {
      case 'create': {
        const shiftId        = body.shift_id as string;
        const targetDriverId = body.target_driver_id as string | undefined;
        const notes          = body.notes as string | undefined;

        if (!shiftId) {
          return NextResponse.json({ error: 'shift_id erforderlich' }, { status: 400 });
        }

        const swap = await createSwapRequest({
          locationId:      auth.locationId,
          requesterDriverId: auth.driverId,
          requesterShiftId:  shiftId,
          targetDriverId,
          notes,
        });
        return NextResponse.json({ swap });
      }

      case 'accept': {
        const swapId          = body.swap_id as string;
        const acceptingShiftId = body.accepting_shift_id as string | undefined;
        if (!swapId) {
          return NextResponse.json({ error: 'swap_id erforderlich' }, { status: 400 });
        }
        const swap = await acceptSwapRequest(swapId, auth.driverId, acceptingShiftId);
        return NextResponse.json({ swap });
      }

      case 'reject': {
        const swapId = body.swap_id as string;
        if (!swapId) {
          return NextResponse.json({ error: 'swap_id erforderlich' }, { status: 400 });
        }
        await rejectSwapRequest(swapId, auth.driverId);
        return NextResponse.json({ ok: true });
      }

      case 'cancel': {
        const swapId = body.swap_id as string;
        if (!swapId) {
          return NextResponse.json({ error: 'swap_id erforderlich' }, { status: 400 });
        }
        await cancelSwapRequest(swapId, auth.driverId);
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: 'Unbekannte Action' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
