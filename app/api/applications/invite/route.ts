import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { sendEmail, renderInviteEmail } from '@/lib/email';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  vorname: z.string().min(1),
  nachname: z.string().min(1),
  location_id: z.string().uuid().optional(),
});

function token(): string {
  return randomBytes(24).toString('base64url');
}

export async function POST(req: NextRequest) {
  await requireManagerPlus();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { email, vorname, nachname, location_id } = parsed.data;
  const sb = createServiceClient();

  // Existiert Employee mit dieser E-Mail?
  const { data: existing } = await sb.from('employees')
    .select('id,status').eq('email', email).maybeSingle();
  if (existing && !['registriert', 'wartet_zuteilung'].includes(existing.status)) {
    return NextResponse.json({ error: `E-Mail existiert bereits (Status: ${existing.status})` }, { status: 409 });
  }

  const t = token();
  const expires = new Date(Date.now() + 14 * 86_400_000).toISOString(); // 14 Tage gültig

  if (existing) {
    const { error } = await sb.from('employees').update({
      invite_token: t, invite_expires_at: expires, vorname, nachname, location_id: location_id ?? null,
    }).eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await sb.from('employees').insert({
      email, vorname, nachname, location_id: location_id ?? null,
      status: 'registriert', rolle: 'mitarbeiter',
      invite_token: t, invite_expires_at: expires, beworben_am: new Date().toISOString(),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const origin = new URL(req.url).origin;
  const link = `${origin}/register/${t}`;

  const mail = renderInviteEmail({ vorname, link });
  const emailResult = await sendEmail({ to: email, ...mail });

  return NextResponse.json({ ok: true, link, expires, email: emailResult });
}
