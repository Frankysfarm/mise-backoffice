/**
 * POST /api/admin/drivers/invite
 *
 * Phase 1: Email-Auth via Supabase Auth.
 *
 * Restaurant-Admin lädt Fahrer per Email ein:
 *   1. Supabase Auth: erzeugt invite-Magic-Link für die Email-Adresse
 *      (legt auth.users-Row an wenn nicht existiert)
 *   2. mise_drivers row anlegen (oder beziehen wenn schon da) und
 *      mit auth_user_id verknüpfen
 *   3. mise_driver_tenants link upserten (active)
 *   4. Mail via Resend rausschicken; falls RESEND_API_KEY fehlt: Link
 *      in Response zurückgeben (Backoffice zeigt's als Fallback an)
 *
 * Body: { email, name, vehicle?, max_radius_km? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAdminContext, isAdminContext } from '../../_lib/tenant-from-session';
import { sendEmail } from '@/lib/email';
import { renderDriverInviteEmail } from '@/lib/driver-invite-email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface InviteBody {
  email: string;
  name: string;
  vehicle?: 'bike' | 'car';
  max_radius_km?: number;
}

export async function POST(req: NextRequest) {
  const ctx = await getAdminContext();
  if (!isAdminContext(ctx)) return ctx;

  let body: InviteBody;
  try {
    body = (await req.json()) as InviteBody;
  } catch {
    return NextResponse.json({ error: 'Ungültiges JSON' }, { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const name = (body.name ?? '').trim();
  const vehicle = body.vehicle ?? 'bike';
  const max_radius_km = Math.min(
    vehicle === 'car' ? 15 : 8,
    Math.max(1, body.max_radius_km ?? (vehicle === 'car' ? 10 : 4)),
  );

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Bitte eine gültige Email-Adresse angeben.' }, { status: 400 });
  }
  if (name.length < 2) {
    return NextResponse.json({ error: 'Bitte den Namen des Fahrers angeben.' }, { status: 400 });
  }

  const sb = createServiceClient();

  // 1) Tenant-Name für Email-Template holen
  const { data: tenant } = await sb
    .from('tenants')
    .select('id, name')
    .eq('id', ctx.tenant_id)
    .maybeSingle();
  const restaurantName = tenant?.name ?? 'dein Restaurant';

  // 2) Supabase Auth: invite-Link erzeugen.
  //    generateLink legt den auth.users-User an wenn nicht da.
  //    Wir setzen redirect_to auf unsere Setup-Page.
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://mise-gastro.de';
  const redirectTo = `${siteUrl.replace(/\/$/, '')}/driver/setup`;

  // Versuche zuerst 'invite' (neuer User). Schlägt fehl wenn email schon in auth.users
  // existiert (z.B. nach DB-Wipe der mise_drivers ohne auth.users zu räumen, oder weil
  // der Driver schon mal eingeladen wurde). Dann fallen wir auf 'recovery' zurück:
  // schickt einen Passwort-Reset-Link zur selben Setup-Page.
  let linkRes = await sb.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo, data: { app: 'mise-driver', invited_name: name } },
  });

  if (linkRes.error || !linkRes.data?.user) {
    const msg = linkRes.error?.message?.toLowerCase() ?? '';
    const alreadyExists = msg.includes('already') || msg.includes('registered') || msg.includes('exists');
    if (alreadyExists) {
      linkRes = await sb.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo },
      });
    }
  }

  if (linkRes.error || !linkRes.data?.user) {
    return NextResponse.json(
      { error: `Konnte Einladung nicht erzeugen: ${linkRes.error?.message ?? 'unknown'}` },
      { status: 500 },
    );
  }

  const authUserId = linkRes.data.user.id;
  const inviteLink = linkRes.data.properties?.action_link;

  if (!authUserId || !inviteLink) {
    return NextResponse.json({ error: 'Auth-Setup fehlgeschlagen' }, { status: 500 });
  }

  // 3) mise_drivers: existiert (über email oder auth_user_id)?
  let driverId: string;
  let isNew = false;

  const { data: existingDriver } = await sb
    .from('mise_drivers')
    .select('id')
    .or(`email.eq.${email},auth_user_id.eq.${authUserId}`)
    .maybeSingle();

  if (existingDriver) {
    driverId = existingDriver.id;
    await sb
      .from('mise_drivers')
      .update({ auth_user_id: authUserId, email, name })
      .eq('id', driverId);
  } else {
    const { data: created, error: createErr } = await sb
      .from('mise_drivers')
      .insert({
        email,
        auth_user_id: authUserId,
        name,
        vehicle,
        max_radius_km,
        frank_mode: 'confirm',
      })
      .select('id')
      .single();
    if (createErr || !created) {
      return NextResponse.json(
        { error: createErr?.message ?? 'Konnte Fahrer-Datensatz nicht anlegen' },
        { status: 500 },
      );
    }
    driverId = created.id;
    isNew = true;
  }

  // 4) Tenant-Link
  const { error: linkUpsertErr } = await sb.from('mise_driver_tenants').upsert(
    {
      driver_id: driverId,
      tenant_id: ctx.tenant_id,
      status: 'active',
      invited_by: ctx.employee_id,
    },
    { onConflict: 'driver_id,tenant_id' },
  );
  if (linkUpsertErr) {
    return NextResponse.json({ error: linkUpsertErr.message }, { status: 500 });
  }

  // 5) Mail rausschicken
  const { subject, html, text } = renderDriverInviteEmail({
    driverName: name,
    restaurantName,
    inviteLink,
  });
  const mailResult = await sendEmail({ to: email, subject, html, text });

  return NextResponse.json({
    ok: true,
    driver_id: driverId,
    is_new_driver: isNew,
    auth_user_id: authUserId,
    email,
    mail: {
      sent: mailResult.sent,
      skipped: mailResult.skipped,
      error: mailResult.error,
    },
    // Fallback: wenn Mail nicht raus konnte, kann das Backoffice den Link
    // dem Restaurant-Admin direkt zeigen (er gibt ihn dann manuell weiter).
    invite_link: mailResult.sent ? null : inviteLink,
  });
}
