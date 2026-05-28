import { NextRequest, NextResponse } from 'next/server';
import {
  badRequest,
  createDriverSession,
  hashOtp,
  MAX_OTP_ATTEMPTS_CONST,
  normalizePhone,
  otpHashesEqual,
  sb,
  type DriverPublic,
} from '../../_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  phone: string;
  code: string;
  name?: string;
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

  const { data: otp } = await sb()
    .from('mise_driver_otp_codes')
    .select('id,phone,code_hash,attempts,consumed_at,expires_at')
    .eq('phone', phone)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otp) {
    return NextResponse.json(
      { error: 'Kein gültiger Code gefunden — fordere einen neuen an.' },
      { status: 401 },
    );
  }
  if (new Date(otp.expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'Code abgelaufen — fordere einen neuen an.' },
      { status: 401 },
    );
  }
  if ((otp.attempts ?? 0) >= MAX_OTP_ATTEMPTS_CONST) {
    return NextResponse.json(
      { error: 'Zu viele Versuche — fordere einen neuen Code an.' },
      { status: 429 },
    );
  }

  const ok = otpHashesEqual(otp.code_hash, hashOtp(code));
  if (!ok) {
    await sb()
      .from('mise_driver_otp_codes')
      .update({ attempts: (otp.attempts ?? 0) + 1 })
      .eq('id', otp.id);
    return NextResponse.json({ error: 'Code ist falsch.' }, { status: 401 });
  }

  await sb()
    .from('mise_driver_otp_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', otp.id);

  const { data: existing } = await sb()
    .from('mise_drivers')
    .select(
      'id,phone,email,name,vehicle,max_radius_km,frank_mode,state,active,total_deliveries,total_earnings',
    )
    .eq('phone', phone)
    .maybeSingle();

  let driver: DriverPublic;
  if (existing) {
    driver = existing as DriverPublic;
  } else {
    const { data: created, error: createErr } = await sb()
      .from('mise_drivers')
      .insert({
        phone,
        name: (body.name ?? '').trim() || 'Neuer Fahrer',
        vehicle: 'bike',
        max_radius_km: 4,
        frank_mode: 'confirm',
      })
      .select(
        'id,phone,email,name,vehicle,max_radius_km,frank_mode,state,active,total_deliveries,total_earnings',
      )
      .single();
    if (createErr || !created) {
      return NextResponse.json(
        { error: 'Konnte Fahrer-Profil nicht anlegen' },
        { status: 500 },
      );
    }
    driver = created as DriverPublic;
  }

  // Bei Login: alle wartenden Invitations einlösen + Driver-Tenants verlinken
  let invitationsConsumed = 0;
  try {
    const { data: consumed } = await sb().rpc('fn_consume_driver_invitations', {
      p_driver_id: driver.id,
      p_phone: phone,
    });
    invitationsConsumed = Number(consumed ?? 0);
  } catch {
    /* nicht-kritisch */
  }

  // Falls Driver durch Invitation aktualisiert wurde — neuste Daten laden
  if (invitationsConsumed > 0) {
    const { data: refreshed } = await sb()
      .from('mise_drivers')
      .select(
        'id,phone,email,name,vehicle,max_radius_km,frank_mode,state,active,total_deliveries,total_earnings',
      )
      .eq('id', driver.id)
      .maybeSingle();
    if (refreshed) driver = refreshed as DriverPublic;
  }

  // Driver's aktive Tenants laden
  const { data: tenantLinks } = await sb()
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

  return NextResponse.json({
    ok: true,
    token,
    driver,
    tenants,
    invitations_consumed: invitationsConsumed,
  });
}
