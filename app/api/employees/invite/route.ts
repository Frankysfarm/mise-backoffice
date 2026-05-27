import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/requireRole';
import { z } from 'zod';

const schema = z.object({
  employee_id: z.string().uuid(),
  send_email: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  // Nur Admin darf Accounts anlegen
  await requireAdmin();

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { employee_id } = parsed.data;

  const supabase = await createClient();
  const { data: emp, error: eErr } = await supabase.from('employees')
    .select('id,email,vorname,nachname,rolle,auth_user_id')
    .eq('id', employee_id).maybeSingle();
  if (eErr || !emp) return NextResponse.json({ error: 'Employee nicht gefunden' }, { status: 404 });
  if (!emp.email) return NextResponse.json({ error: 'Employee hat keine E-Mail' }, { status: 400 });
  if (emp.auth_user_id) return NextResponse.json({ error: 'Employee bereits verknüpft' }, { status: 409 });

  const service = createServiceClient();
  const redirectTo = `${new URL(req.url).origin}/auth/callback?next=/`;

  // @supabase/ssr unterstützt direkt inviteUserByEmail via admin API
  const { data, error } = await (service as any).auth.admin.inviteUserByEmail(emp.email, {
    data: { vorname: emp.vorname, nachname: emp.nachname, employee_id: emp.id, rolle: emp.rolle },
    redirectTo,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userId = data?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Kein User erstellt' }, { status: 500 });

  // Employee mit auth_user_id verknüpfen
  const { error: linkErr } = await service.from('employees').update({ auth_user_id: userId }).eq('id', emp.id);
  if (linkErr) return NextResponse.json({ error: `Link fehlgeschlagen: ${linkErr.message}` }, { status: 500 });

  return NextResponse.json({ ok: true, user_id: userId, email: emp.email });
}
