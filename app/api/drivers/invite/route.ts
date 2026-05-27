import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  email: string;
  vorname: string;
  nachname: string;
  telefon?: string;
  fahrzeug?: 'bike' | 'ebike' | 'scooter' | 'auto';
  location_id?: string;
};

function generatePassword(length = 12): string {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digit = '23456789';
  const all = upper + lower + digit;
  // Mindestens je 1 aus jeder Kategorie
  let pw = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digit[Math.floor(Math.random() * digit.length)],
  ];
  while (pw.length < length) pw.push(all[Math.floor(Math.random() * all.length)]);
  return pw.sort(() => Math.random() - 0.5).join('');
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: emp } = await sb
    .from('employees').select('id, tenant_id, location_id, rolle').eq('auth_user_id', user.id).maybeSingle();
  if (!emp?.tenant_id || !['admin', 'manager', 'backoffice'].includes(emp.rolle as string)) {
    return NextResponse.json({ error: 'Nur Admins/Manager dürfen einladen' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.email || !body.vorname) {
    return NextResponse.json({ error: 'Email + Vorname sind Pflicht' }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) {
    return NextResponse.json({ error: 'Ungültige E-Mail' }, { status: 400 });
  }

  // Tenant-Info holen für Email + Slug
  const { data: tenant } = await svc
    .from('tenants')
    .select('id, name, slug, resend_api_key, resend_from_email, resend_from_name, theme_primary, theme_accent')
    .eq('id', emp.tenant_id).single();
  if (!tenant) return NextResponse.json({ error: 'Tenant nicht gefunden' }, { status: 404 });

  const locationId = body.location_id ?? emp.location_id;
  if (!locationId) return NextResponse.json({ error: 'Keine Filiale zuordenbar' }, { status: 400 });

  // 1) Auth-User erstellen (auto-confirm)
  const tempPw = generatePassword();
  const { data: auth, error: authErr } = await svc.auth.admin.createUser({
    email: body.email,
    password: tempPw,
    email_confirm: true,
    user_metadata: {
      name: `${body.vorname} ${body.nachname}`,
      tenant_id: tenant.id,
      role: 'fahrer',
    },
  });

  if (authErr || !auth.user) {
    // User existiert vielleicht schon — dann kein Fehler, aber Employee-Anlage
    if (authErr?.message?.includes('already registered')) {
      return NextResponse.json(
        { error: `E-Mail ${body.email} ist bereits registriert. Bitte existierenden Account zuordnen.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: authErr?.message ?? 'Auth fehlgeschlagen' }, { status: 500 });
  }

  // 2) Employee-Row mit kann_ausliefern=true
  // Nächste freie Fahrer-Nummer via RPC (tenant-scoped, kollisionsfrei)
  const { data: personalNr } = await svc.rpc('next_personalnummer', {
    p_tenant_id: tenant.id,
    p_prefix: 'F',
  });

  const { data: newEmp, error: empErr } = await svc
    .from('employees')
    .insert({
      tenant_id: tenant.id,
      location_id: locationId,
      auth_user_id: auth.user.id,
      email: body.email,
      vorname: body.vorname,
      nachname: body.nachname || '—',
      telefon: body.telefon ?? null,
      rolle: 'mitarbeiter',
      status: 'aktiv',
      kann_ausliefern: true,
      fahrzeug_praeferenz: body.fahrzeug ?? 'ebike',
      personalnummer: (personalNr as string) ?? `F${Date.now().toString().slice(-4)}`,
      muss_passwort_aendern: true,
    })
    .select('id')
    .single();

  if (empErr || !newEmp) {
    await svc.auth.admin.deleteUser(auth.user.id);
    return NextResponse.json({ error: empErr?.message ?? 'Mitarbeiter-Row fehlt' }, { status: 500 });
  }

  // 3) driver_status initial anlegen
  await svc.from('driver_status').insert({
    employee_id: newEmp.id,
    ist_online: false,
    fahrzeug: body.fahrzeug ?? 'ebike',
  });

  // 4) Welcome-Email via Resend
  const origin = new URL(req.url).origin;
  const appUrl = `${origin}/fahrer`;
  const loginUrl = `${origin}/login?email=${encodeURIComponent(body.email)}`;

  let emailSent = false;
  let emailError: string | null = null;

  if (tenant.resend_api_key && tenant.resend_from_email) {
    try {
      const resend = new Resend(tenant.resend_api_key);
      const r = await resend.emails.send({
        from: `${tenant.resend_from_name ?? tenant.name} <${tenant.resend_from_email}>`,
        to: body.email,
        subject: `Willkommen im ${tenant.name}-Fahrerteam 🛵`,
        html: renderWelcomeEmail({
          vorname: body.vorname,
          tenantName: tenant.name,
          themePrimary: tenant.theme_primary ?? '#14532d',
          themeAccent: tenant.theme_accent ?? '#4ae68a',
          email: body.email,
          password: tempPw,
          appUrl,
          loginUrl,
        }),
      });
      if (r.error) throw new Error(r.error.message);
      emailSent = true;
    } catch (e) {
      emailError = e instanceof Error ? e.message : 'Email-Fehler';
    }
  }

  return NextResponse.json({
    ok: true,
    employee_id: newEmp.id,
    email_sent: emailSent,
    email_error: emailError,
    // Bei fehlender Resend-Config: Login-Daten direkt zurückgeben, damit Admin sie manuell weitergeben kann
    credentials: emailSent ? null : { email: body.email, password: tempPw, app_url: appUrl },
  });
}

function renderWelcomeEmail(opts: {
  vorname: string;
  tenantName: string;
  themePrimary: string;
  themeAccent: string;
  email: string;
  password: string;
  appUrl: string;
  loginUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Willkommen</title>
</head>
<body style="margin:0; padding:0; background:#f5f2ed; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color:#1a1a1a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f2ed; padding: 40px 20px;">
<tr><td align="center">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px; background:#ffffff; border-radius:20px; overflow:hidden;">
  <!-- Hero -->
  <tr><td style="background: linear-gradient(135deg, ${opts.themePrimary} 0%, ${opts.themeAccent}22 100%); padding: 40px; color:#ffffff;">
    <div style="font-size:40px; margin-bottom:16px;">🛵</div>
    <div style="font-size:11px; letter-spacing:3px; text-transform:uppercase; opacity:0.8;">${opts.tenantName}</div>
    <h1 style="margin:8px 0 0; font-size:32px; font-weight:800; letter-spacing:-0.5px;">
      Willkommen im Team, ${opts.vorname}.
    </h1>
  </td></tr>

  <!-- Intro -->
  <tr><td style="padding: 32px 40px 0; font-size:16px; line-height:1.6; color:#333;">
    Wir freuen uns, dass du ab sofort für uns unterwegs bist. In wenigen Schritten bist du startklar:
  </td></tr>

  <!-- Step 1: App -->
  <tr><td style="padding: 24px 40px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e5e5e5; border-radius:16px; padding: 24px;">
      <tr><td>
        <div style="display:inline-block; background:${opts.themeAccent}; color:${opts.themePrimary}; width:32px; height:32px; border-radius:16px; text-align:center; line-height:32px; font-weight:bold;">1</div>
        <strong style="margin-left:12px; font-size:16px;">Fahrer-App installieren</strong>
        <p style="color:#666; margin:8px 0 16px; font-size:14px; line-height:1.5;">
          Öffne den Link unten auf deinem Handy und tippe „Zum Home-Bildschirm" — schon hast du die App.
          Sie funktioniert wie eine native App, ganz ohne App-Store.
        </p>
        <a href="${opts.appUrl}" style="display:inline-block; background:${opts.themePrimary}; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:10px; font-weight:bold; font-size:14px;">
          📱 Fahrer-App öffnen
        </a>
        <div style="margin-top:12px; font-family:monospace; color:#666; font-size:12px; word-break:break-all;">${opts.appUrl}</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- Step 2: Login -->
  <tr><td style="padding: 0 40px 24px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e5e5e5; border-radius:16px; padding: 24px;">
      <tr><td>
        <div style="display:inline-block; background:${opts.themeAccent}; color:${opts.themePrimary}; width:32px; height:32px; border-radius:16px; text-align:center; line-height:32px; font-weight:bold;">2</div>
        <strong style="margin-left:12px; font-size:16px;">Mit deinen Zugangsdaten einloggen</strong>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:16px; background:#f5f5f5; border-radius:10px; padding:16px;">
          <tr><td style="font-size:11px; color:#888; letter-spacing:2px; text-transform:uppercase;">E-Mail</td></tr>
          <tr><td style="font-family:monospace; font-size:14px; color:#000; padding-bottom:12px;">${opts.email}</td></tr>
          <tr><td style="font-size:11px; color:#888; letter-spacing:2px; text-transform:uppercase;">Temporäres Passwort</td></tr>
          <tr><td style="font-family:monospace; font-size:16px; color:#000; font-weight:bold; letter-spacing:1px;">${opts.password}</td></tr>
        </table>

        <p style="color:#666; margin:16px 0 0; font-size:13px;">
          <strong style="color:#b45309;">Wichtig:</strong> Ändere das Passwort beim ersten Login in deinem Profil.
        </p>
      </td></tr>
    </table>
  </td></tr>

  <!-- Step 3: Los! -->
  <tr><td style="padding: 0 40px 32px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e5e5e5; border-radius:16px; padding: 24px;">
      <tr><td>
        <div style="display:inline-block; background:${opts.themeAccent}; color:${opts.themePrimary}; width:32px; height:32px; border-radius:16px; text-align:center; line-height:32px; font-weight:bold;">3</div>
        <strong style="margin-left:12px; font-size:16px;">Online gehen und loslegen</strong>
        <p style="color:#666; margin:8px 0 0; font-size:14px; line-height:1.5;">
          In der App klickst du auf „Online gehen", wählst dein Fahrzeug — fertig.
          Sobald eine Bestellung fertig ist, bekommst du eine Push-Benachrichtigung.
        </p>
        <ul style="color:#666; margin:12px 0 0; padding-left:20px; font-size:13px; line-height:1.7;">
          <li>GPS-Tracking läuft nur während aktiver Tour</li>
          <li>Chat direkt mit Kunden möglich</li>
          <li>Bar-/Karte-Zahlung wird automatisch im System gebucht</li>
        </ul>
      </td></tr>
    </table>
  </td></tr>

  <!-- Support -->
  <tr><td style="padding: 24px 40px 32px; border-top: 1px solid #e5e5e5; font-size:13px; color:#888; line-height:1.5;">
    Fragen? Antworte einfach auf diese E-Mail.<br>
    Viel Erfolg auf den Straßen! 🚀
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding: 16px 40px 24px; background:#f5f5f5; font-size:11px; color:#999; text-align:center;">
    Gesendet von <strong>${opts.tenantName}</strong> via Mise
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
