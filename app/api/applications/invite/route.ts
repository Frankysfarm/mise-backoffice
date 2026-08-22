import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { sendEmail, renderInviteEmail } from '@/lib/email';
import { z } from 'zod';

const schema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  vorname: z.string().trim().min(1).max(100),
  nachname: z.string().trim().min(1).max(100),
  location_id: z.string().uuid().optional(),
});

function token(): string {
  return randomBytes(24).toString('base64url');
}

function publicOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const requestHost = req.headers.get('host');
  const host = (forwardedHost ?? requestHost ?? '').split(',')[0].trim().toLowerCase();
  const safeHost = host === 'mise-gastro.de' || host === 'www.mise-gastro.de' || host.startsWith('localhost:')
    ? host
    : 'mise-gastro.de';
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0].trim();
  const proto = safeHost.startsWith('localhost:') ? 'http' : forwardedProto === 'http' || forwardedProto === 'https' ? forwardedProto : 'https';
  return `${proto}://${safeHost}`;
}

export async function POST(req: NextRequest) {
  const currentEmployee = await requireManagerPlus();
  if (!currentEmployee.tenant_id) {
    return NextResponse.json({ error: 'Mitarbeiterkonto ist keinem Mandanten zugeordnet.' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { email, vorname, nachname, location_id } = parsed.data;
  const sb = createServiceClient();

  if (location_id) {
    const { data: location } = await sb.from('locations')
      .select('id')
      .eq('id', location_id)
      .eq('tenant_id', currentEmployee.tenant_id)
      .maybeSingle();
    if (!location) {
      return NextResponse.json({ error: 'Standort gehört nicht zu diesem Betrieb.' }, { status: 400 });
    }
  }

  // Existing applications are matched only inside the current tenant.
  const { data: existing } = await sb.from('employees')
    .select('id,status')
    .eq('email', email)
    .eq('tenant_id', currentEmployee.tenant_id)
    .maybeSingle();
  if (existing && !['registriert', 'wartet_zuteilung', 'abgelehnt'].includes(existing.status)) {
    return NextResponse.json({ error: `E-Mail existiert bereits (Status: ${existing.status})` }, { status: 409 });
  }

  const t = token();
  const expires = new Date(Date.now() + 14 * 86_400_000).toISOString(); // 14 Tage gültig

  if (existing) {
    const now = new Date().toISOString();
    const { data: reset, error } = await sb.rpc('reissue_candidate_application', {
      p_employee_id: existing.id,
      p_tenant_id: currentEmployee.tenant_id,
      p_vorname: vorname,
      p_nachname: nachname,
      p_location_id: location_id ?? null,
      p_invite_token: t,
      p_invite_expires_at: expires,
      p_beworben_am: now,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!reset) return NextResponse.json({ error: 'Bewerbung wurde zwischenzeitlich geändert. Bitte Seite neu laden.' }, { status: 409 });
  } else {
    const { error } = await sb.from('employees').insert({
      email, vorname, nachname, location_id: location_id ?? null,
      status: 'registriert', rolle: 'mitarbeiter',
      tenant_id: currentEmployee.tenant_id,
      invite_token: t, invite_expires_at: expires, beworben_am: new Date().toISOString(),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const origin = publicOrigin(req);
  const link = `${origin}/register/${t}`;

  const mail = renderInviteEmail({ vorname, link });
  const emailResult = await sendEmail({ to: email, ...mail });

  return NextResponse.json({ ok: true, link, expires, email: emailResult });
}
