/**
 * GET  /api/admin/drivers        — Liste der eigenen Driver
 * POST /api/admin/drivers        — Neuen Driver anlegen + Login-Code generieren
 *
 * Liegt unter app/api/admin/drivers/route.ts auf dem Server.
 * Tenant-Isolation: Owner sieht/erstellt nur Driver für eigene tenant_id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAdminContext, isAdminContext } from '../_lib/tenant-from-session';
import {
  generate6DigitCode,
  hashCode,
  normalizePhone,
} from '../_lib/driver-code';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getAdminContext();
  if (!isAdminContext(ctx)) return ctx;

  const sb = createServiceClient();
  const { data: links, error } = await sb
    .from('mise_driver_tenants')
    .select(
      `id, status, joined_at,
       driver:driver_id(
         id, phone, email, auth_user_id, name, vehicle, max_radius_km, frank_mode, state, active,
         total_deliveries, total_earnings, last_position_at,
         initial_code_consumed_at, initial_code_expires_at
       )`,
    )
    .eq('tenant_id', ctx.tenant_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const drivers = (links ?? []).map((l: any) => ({
    link_id: l.id,
    link_status: l.status,
    joined_at: l.joined_at,
    ...l.driver,
    pending_first_login:
      l.driver?.initial_code_consumed_at == null &&
      l.driver?.initial_code_expires_at != null,
  }));

  return NextResponse.json({ ok: true, drivers });
}

interface CreateBody {
  name: string;
  phone: string;
  vehicle?: 'bike' | 'car';
  max_radius_km?: number;
}

export async function POST(req: NextRequest) {
  const ctx = await getAdminContext();
  if (!isAdminContext(ctx)) return ctx;

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: 'Ungültiges JSON' }, { status: 400 });
  }

  const name = (body.name ?? '').trim();
  const phone = normalizePhone(body.phone ?? '');
  const vehicle = body.vehicle ?? 'bike';
  const max_radius_km = Math.min(
    vehicle === 'car' ? 15 : 8,
    Math.max(1, body.max_radius_km ?? (vehicle === 'car' ? 10 : 4)),
  );

  if (name.length < 2 || phone.replace(/\D/g, '').length < 8) {
    return NextResponse.json(
      { error: 'Name und gültige Telefonnummer sind nötig' },
      { status: 400 },
    );
  }

  const sb = createServiceClient();

  // Driver evtl. schon vorhanden (anderer Tenant)?
  const { data: existing } = await sb
    .from('mise_drivers')
    .select('id, name, vehicle, max_radius_km')
    .eq('phone', phone)
    .maybeSingle();

  let driverId: string;
  let isNew = false;

  if (existing) {
    driverId = existing.id;
  } else {
    const { data: created, error: createErr } = await sb
      .from('mise_drivers')
      .insert({
        phone,
        name,
        vehicle,
        max_radius_km,
        frank_mode: 'confirm',
      })
      .select('id')
      .single();
    if (createErr || !created) {
      return NextResponse.json(
        { error: createErr?.message ?? 'Konnte Driver nicht anlegen' },
        { status: 500 },
      );
    }
    driverId = created.id;
    isNew = true;
  }

  // Tenant-Link anlegen (idempotent)
  const { error: linkErr } = await sb.from('mise_driver_tenants').upsert(
    {
      driver_id: driverId,
      tenant_id: ctx.tenant_id,
      status: 'active',
      invited_by: ctx.employee_id,
    },
    { onConflict: 'driver_id,tenant_id' },
  );
  if (linkErr) {
    return NextResponse.json({ error: linkErr.message }, { status: 500 });
  }

  // Initial-Login-Code generieren (immer beim Create — auch wenn Driver schon existiert,
  // weil Restaurant ihm einen Code geben muss).
  const code = generate6DigitCode();
  const code_hash = hashCode(code);

  await sb.rpc('fn_set_driver_initial_code', {
    p_driver_id: driverId,
    p_code_hash: code_hash,
    p_set_by: ctx.employee_id,
  });

  return NextResponse.json({
    ok: true,
    driver_id: driverId,
    is_new_driver: isNew,
    login_code: code, // ⚠️ wird einmalig zurückgegeben — Backoffice muss anzeigen
    expires_in_days: 14,
  });
}
