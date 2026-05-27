import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  restaurant_name: string;
  slug: string;
  email: string;
  password: string;
  inhaber_vollname: string;
  adresse?: string;
  stadt?: string;
  plz?: string;
  telefon?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 });

  const {
    restaurant_name, slug, email, password, inhaber_vollname,
    adresse, stadt, plz, telefon,
  } = body;

  if (!restaurant_name || !slug || !email || !password || !inhaber_vollname) {
    return NextResponse.json({ error: 'Pflichtfelder fehlen' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Passwort zu kurz (mind. 8 Zeichen)' }, { status: 400 });
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'Slug darf nur a-z, 0-9 und - enthalten' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 1) Auth-User anlegen (auto-confirm, weil Dev-Flow)
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: inhaber_vollname, tenant_slug: slug },
  });
  if (authErr || !authData.user) {
    return NextResponse.json(
      { error: authErr?.message ?? 'Auth-User konnte nicht angelegt werden' },
      { status: 400 },
    );
  }

  // 2) Tenant + Location + Employee atomar anlegen
  const { data: result, error: rpcErr } = await supabase.rpc('create_tenant_with_admin', {
    p_name: restaurant_name,
    p_slug: slug,
    p_email: email,
    p_auth_user_id: authData.user.id,
    p_stadt: stadt ?? null,
    p_plz: plz ?? null,
    p_adresse: adresse ?? null,
    p_telefon: telefon ?? null,
    p_inhaber_vollname: inhaber_vollname,
  });

  if (rpcErr) {
    // Cleanup: Auth-User wieder löschen
    await supabase.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }

  const r = result as { ok: boolean; error?: string; tenant_id?: string; location_id?: string };
  if (!r.ok) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: r.error ?? 'Tenant-Erstellung fehlgeschlagen' }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    tenant_id: r.tenant_id,
    location_id: r.location_id,
    email,
    next: '/login?welcome=1',
  });
}
