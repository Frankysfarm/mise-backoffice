import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SignupBody {
  restaurantName: string;
  city?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
}

const TRIAL_DAYS = 14;

/**
 * POST /api/auth/signup
 *
 * Erstellt einen kompletten Tenant + Owner-Account in einem Schritt:
 *   1. Auth-User in Supabase anlegen
 *   2. Tenant-Row erstellen (mit slug aus restaurantName)
 *   3. Default-Location anlegen
 *   4. Employee mit Rolle 'admin' erstellen, an Auth-User koppeln
 *   5. Alle ready-Module 14 Tage Trial aktivieren
 *
 * Idempotent für E-Mail: Wenn User bereits existiert → 409.
 * Race-Conditions ignoriert für MVP.
 */
export async function POST(req: NextRequest) {
  let body: SignupBody;
  try {
    body = (await req.json()) as SignupBody;
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const restaurantName = body.restaurantName?.trim();
  const firstName = body.firstName?.trim();
  const lastName = body.lastName?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!restaurantName || !firstName || !lastName || !email || !password) {
    return NextResponse.json({ error: 'Bitte alle Pflichtfelder ausfüllen.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Passwort: mindestens 8 Zeichen.' }, { status: 400 });
  }

  const svc = createServiceClient();

  // Check if email already exists
  const { data: existing } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (existing?.users.some((u) => u.email?.toLowerCase() === email)) {
    return NextResponse.json(
      { error: 'Diese E-Mail ist bereits registriert. Versuch Login oder Passwort-Reset.' },
      { status: 409 },
    );
  }

  // 1. Create Auth user (auto-confirm email so user can log in immediately)
  const { data: authRes, error: authErr } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      signup_source: 'mise-trial',
    },
  });
  if (authErr || !authRes?.user) {
    return NextResponse.json(
      { error: authErr?.message ?? 'Auth-User konnte nicht angelegt werden.' },
      { status: 500 },
    );
  }
  const userId = authRes.user.id;

  // 2. Create tenant
  const slug = await uniqueSlug(svc, slugify(restaurantName));
  const { data: tenant, error: tErr } = await svc
    .from('tenants')
    .insert({
      name: restaurantName,
      slug,
      stadt: body.city ?? null,
      email,
      telefon: body.phone ?? null,
      inhaber_vollname: `${firstName} ${lastName}`,
      inhaber_name: firstName,
      aktiv: true,
      plan: 'trial',
      onboarding_step: 0,
      onboarding_abgeschlossen: false,
    })
    .select('id, slug')
    .single();

  if (tErr || !tenant) {
    // Rollback auth user
    await svc.auth.admin.deleteUser(userId).catch(() => {});
    return NextResponse.json(
      { error: tErr?.message ?? 'Tenant konnte nicht angelegt werden.' },
      { status: 500 },
    );
  }

  // 3. Default location
  const { data: location } = await svc
    .from('locations')
    .insert({
      tenant_id: tenant.id,
      name: restaurantName,
      stadt: body.city ?? null,
      aktiv: true,
    })
    .select('id')
    .single();

  // 4. Employee
  const { error: empErr } = await svc.from('employees').insert({
    id: userId,
    tenant_id: tenant.id,
    location_id: location?.id ?? null,
    vorname: firstName,
    nachname: lastName,
    email,
    telefon: body.phone ?? null,
    rolle: 'admin',
    aktiv: true,
    eingestellt_am: new Date().toISOString().slice(0, 10),
  });
  if (empErr) {
    // Best effort: leave tenant orphaned but flag the error
    return NextResponse.json(
      { error: empErr.message, partial: true, tenantId: tenant.id },
      { status: 500 },
    );
  }

  // 5. Activate ready modules in trial
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

  const { data: readyModules } = await svc
    .from('platform_modules')
    .select('id')
    .eq('aktiv', true)
    .in('launch_status', ['ready', 'beta']);

  if (readyModules && readyModules.length > 0) {
    const rows = readyModules.map((m: { id: string }) => ({
      tenant_id: tenant.id,
      module_id: m.id,
      status: 'trial',
      aktiv: true,
      test_gestartet_am: new Date().toISOString(),
      ablauf_am: trialEnd.toISOString(),
    }));
    await svc.from('tenant_modules').insert(rows);
  }

  return NextResponse.json({
    ok: true,
    tenantSlug: tenant.slug,
    trialEndsAt: trialEnd.toISOString(),
    modulesActivated: readyModules?.length ?? 0,
  });
}

// ─── Helpers ─────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function uniqueSlug(svc: any, base: string): Promise<string> {
  let candidate = base || `restaurant-${Math.random().toString(36).slice(2, 8)}`;
  for (let i = 0; i < 10; i++) {
    const suffix = i === 0 ? '' : `-${i + 1}`;
    const slug = `${candidate}${suffix}`;
    const { data } = await svc.from('tenants').select('id').eq('slug', slug).maybeSingle();
    if (!data) return slug;
  }
  return `${candidate}-${Math.random().toString(36).slice(2, 6)}`;
}
