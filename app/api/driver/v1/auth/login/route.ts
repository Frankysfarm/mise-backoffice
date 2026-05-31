import { NextRequest, NextResponse } from 'next/server';
import {
  badRequest,
  createDriverSession,
  hashOtp,
  normalizePhone,
  otpHashesEqual,
  sb,
  type DriverPublic,
} from '../../_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/driver/v1/auth/login
 * Body: { phone, code }
 *
 * Restaurant erstellt Driver-Account im Backoffice mit Initial-Login-Code.
 * Driver gibt Phone + Code in der App ein → eingeloggt.
 *
 * Code wird einmalig konsumiert. Token in mise_driver_sessions, 90 Tage.
 * Falls Token abläuft: Restaurant-Owner generiert neuen Code im Backoffice.
 */
interface Body {
  phone: string;
  code: string;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return badRequest('Ungültiges JSON');
  }

  const phone = body.phone ? normalizePhone(body.phone) : '';
  const code = (body.code ?? '').trim();
  if (!phone || code.length < 4) {
    return badRequest('Phone und Code sind nötig');
  }

  const c = sb();

  const { data: driver } = await c
    .from('mise_drivers')
    .select(
      'id,employee_id,phone,email,name,vehicle,max_radius_km,frank_mode,state,active,total_deliveries,total_earnings,initial_code_hash,initial_code_expires_at,initial_code_consumed_at',
    )
    .eq('phone', phone)
    .maybeSingle();

  if (!driver) {
    return NextResponse.json(
      { error: 'Kein Account zu dieser Telefonnummer. Frag dein Restaurant.' },
      { status: 404 },
    );
  }

  if (!driver.initial_code_hash) {
    return NextResponse.json(
      {
        error:
          'Account hat keinen aktiven Login-Code. Bitte Restaurant um neuen Code.',
      },
      { status: 401 },
    );
  }

  if (driver.initial_code_consumed_at) {
    return NextResponse.json(
      {
        error:
          'Login-Code wurde schon benutzt. Falls Token abgelaufen, neuen Code beim Restaurant holen.',
      },
      { status: 401 },
    );
  }

  if (
    driver.initial_code_expires_at &&
    new Date(driver.initial_code_expires_at) < new Date()
  ) {
    return NextResponse.json(
      { error: 'Login-Code abgelaufen. Bitte Restaurant um neuen Code.' },
      { status: 401 },
    );
  }

  const ok = otpHashesEqual(driver.initial_code_hash, hashOtp(code));
  if (!ok) {
    return NextResponse.json({ error: 'Code stimmt nicht.' }, { status: 401 });
  }

  // Code konsumieren (kann nur einmal genutzt werden)
  await c
    .from('mise_drivers')
    .update({ initial_code_consumed_at: new Date().toISOString() })
    .eq('id', driver.id);

  // Driver's aktive Tenants laden
  const { data: tenantLinks } = await c
    .from('mise_driver_tenants')
    .select('tenant_id, status, tenants:tenant_id(name, slug)')
    .eq('driver_id', driver.id)
    .eq('status', 'active');

  const tenants = (tenantLinks ?? []).map((row: any) => ({
    id: row.tenant_id as string,
    name: (row.tenants?.name ?? null) as string | null,
    slug: (row.tenants?.slug ?? null) as string | null,
  }));

  const ua = req.headers.get('user-agent');
  const { token } = await createDriverSession(driver.id, ua);

  // Strip-out internal fields before returning
  const driverPublic: DriverPublic = {
    id: driver.id,
    employee_id: driver.employee_id ?? null,
    phone: driver.phone,
    email: driver.email,
    name: driver.name,
    vehicle: driver.vehicle,
    max_radius_km: driver.max_radius_km,
    frank_mode: driver.frank_mode,
    state: driver.state,
    active: driver.active,
    total_deliveries: driver.total_deliveries,
    total_earnings: Number(driver.total_earnings),
  };

  return NextResponse.json({
    ok: true,
    token,
    driver: driverPublic,
    tenants,
  });
}
