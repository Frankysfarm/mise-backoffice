import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';

function generatePassword(length = 14): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

type ServiceClient = ReturnType<typeof createServiceClient>;

async function findKioskAccount(svc: ServiceClient, tenantId: string, locationId: string) {
  const { data } = await svc.from('employees')
    .select('id, email, auth_user_id, created_at')
    .eq('tenant_id', tenantId)
    .eq('location_id', locationId)
    .eq('position_typ', 'kiosk-lieferservice')
    .maybeSingle();
  return data as { id: string; email: string | null; auth_user_id: string | null; created_at: string } | null;
}

async function resolveScope() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const { data } = await sb.from('employees')
    .select('tenant_id, location_id')
    .eq('id', emp.id)
    .maybeSingle();
  return {
    tenantId: data?.tenant_id as string | undefined,
    locationId: data?.location_id as string | undefined,
  };
}

export async function GET() {
  const { tenantId, locationId } = await resolveScope();
  if (!tenantId || !locationId) {
    return NextResponse.json({ error: 'Tenant/Location nicht zugeordnet' }, { status: 400 });
  }
  const svc = createServiceClient();
  const kiosk = await findKioskAccount(svc, tenantId, locationId);
  if (!kiosk) return NextResponse.json({ exists: false });
  return NextResponse.json({
    exists: true,
    email: kiosk.email,
    createdAt: kiosk.created_at,
  });
}

export async function POST() {
  const { tenantId, locationId } = await resolveScope();
  if (!tenantId || !locationId) {
    return NextResponse.json({ error: 'Tenant/Location nicht zugeordnet' }, { status: 400 });
  }

  const svc = createServiceClient();
  const { data: tenant } = await svc.from('tenants')
    .select('slug, name')
    .eq('id', tenantId)
    .single();
  if (!tenant?.slug) {
    return NextResponse.json({ error: 'Tenant ohne Slug' }, { status: 500 });
  }

  const slugSafe = String(tenant.slug).toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const email = `lieferservice-${slugSafe}@kiosk.mise-gastro.de`;
  const password = generatePassword();
  const existing = await findKioskAccount(svc, tenantId, locationId);

  if (existing?.auth_user_id) {
    const { error: updErr } = await (svc as any).auth.admin.updateUserById(existing.auth_user_id, {
      password,
    });
    if (updErr) {
      return NextResponse.json({ error: `Passwort-Update: ${updErr.message}` }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      regenerated: true,
      email: existing.email ?? email,
      password,
    });
  }

  const { data: auth, error: authErr } = await (svc as any).auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      tenant_id: tenantId,
      location_id: locationId,
      kiosk_kind: 'lieferservice',
      tenant_name: tenant.name,
    },
  });

  if (authErr || !auth?.user) {
    if (authErr?.message?.toLowerCase().includes('already registered') ||
        authErr?.message?.toLowerCase().includes('already been registered')) {
      return NextResponse.json({
        error: `Auth-User ${email} existiert bereits ohne Verknüpfung. Bitte Support kontaktieren.`,
      }, { status: 409 });
    }
    return NextResponse.json({ error: authErr?.message ?? 'Auth-Fehler' }, { status: 500 });
  }

  const { error: insErr } = await svc.from('employees').insert({
    tenant_id: tenantId,
    location_id: locationId,
    auth_user_id: auth.user.id,
    email,
    vorname: 'Lieferservice',
    nachname: tenant.name ?? 'Kiosk',
    rolle: 'mitarbeiter',
    position_typ: 'kiosk-lieferservice',
  });
  if (insErr) {
    await (svc as any).auth.admin.deleteUser(auth.user.id).catch(() => {});
    return NextResponse.json({ error: `Employee-Anlage: ${insErr.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    regenerated: false,
    email,
    password,
  });
}
