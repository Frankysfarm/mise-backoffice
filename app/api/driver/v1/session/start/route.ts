import { NextRequest, NextResponse } from 'next/server';
import { getDriverFromBearer, sb, unauthorized } from '../../_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  vehicle?: 'bike' | 'car';
  location_id?: string;
}

export async function POST(req: NextRequest) {
  const m = await getDriverFromBearer(req);
  if (!m) return unauthorized();

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* leerer body ok */
  }

  const c = sb();
  const now = new Date();
  let locationId = typeof body.location_id === 'string' && body.location_id.length > 10
    ? body.location_id
    : null;
  const { data: driverIdentity } = await c.from('mise_drivers')
    .select('auth_user_id').eq('id', m.driver.id).maybeSingle();
  const { data: employee } = driverIdentity?.auth_user_id
    ? await c.from('employees').select('id,location_id,status').eq('auth_user_id', driverIdentity.auth_user_id).maybeSingle()
    : { data: null };

  if (!locationId) {
    const { data: currentShift } = await c.from('driver_shifts').select('location_id')
      .eq('driver_id', m.driver.id).in('status', ['scheduled', 'active'])
      .lte('planned_start', new Date(now.getTime() + 30 * 60_000).toISOString())
      .gt('planned_end', now.toISOString()).order('planned_start').limit(1).maybeSingle();
    locationId = (currentShift?.location_id as string | undefined) ?? (employee?.location_id as string | undefined) ?? null;
  }
  if (!locationId) {
    const { data: memberships } = await c.from('mise_driver_tenants').select('tenant_id')
      .eq('driver_id', m.driver.id).eq('status', 'active');
    const tenantIds = (memberships ?? []).map(row => row.tenant_id as string);
    if (tenantIds.length === 1) {
      const { data: locations } = await c.from('locations').select('id').eq('tenant_id', tenantIds[0]).eq('aktiv', true).limit(2);
      if (locations?.length === 1) locationId = locations[0].id as string;
    }
  }
  if (!locationId) return NextResponse.json({ error: 'Standort für die Fahrerschicht ist nicht eindeutig' }, { status: 409 });

  const { data: started, error } = await c.rpc('start_driver_dispatch_session', {
    p_driver_id: m.driver.id,
    p_location_id: locationId,
    p_vehicle: body.vehicle ?? null,
  });
  if (error || !(started as { ok?: boolean } | null)?.ok) {
    return NextResponse.json({ error: error?.message ?? 'Konnte Schicht nicht starten' }, { status: 409 });
  }

  // Der Online-Status MUSS geschrieben sein, bevor wir "ok" melden. Vorher lief das
  // als fire-and-forget: die Antwort ging raus, der Schreibvorgang wurde mit der
  // Function abgeräumt — die App zeigte "online", die Datenbank blieb auf offline,
  // und nach dem nächsten Laden stand der Fahrer wieder offline da (Befund 14.08.).
  let statusWritten = true;
  if (employee?.id) {
    const statusPatch: Record<string, unknown> = {
      employee_id: employee.id,
      ist_online: true,
      online_seit: new Date().toISOString(),
    };
    if (body.vehicle) statusPatch.fahrzeug = body.vehicle;
    const { error: statusError } = await c.from('driver_status').upsert(statusPatch);
    if (statusError) {
      statusWritten = false;
      console.error('[session/start] driver_status nicht geschrieben:', statusError.message);
      // Kein Split-Brain: Wenn die Legacy-Statusprojektion nicht geschrieben
      // werden kann, die eben gestartete Dispatch-Session sofort zurückrollen.
      const wasExistingSession = Boolean((started as { resumed?: boolean } | null)?.resumed);
      if (wasExistingSession) {
        await c.rpc('pause_driver_dispatch_session', {
          p_driver_id: m.driver.id,
          p_reason: 'manual',
          p_allow_active_batch: false,
        });
      } else {
        await c.rpc('end_driver_dispatch_session', { p_driver_id: m.driver.id });
      }
      return NextResponse.json(
        { ok: false, error: 'Online-Status konnte nicht sicher gespeichert werden', status_written: false },
        { status: 503 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    location_id: locationId,
    status_written: statusWritten,
    fallback: Boolean((started as { fallback?: boolean }).fallback),
  });
}
