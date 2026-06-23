/**
 * GET  /api/delivery/admin/kitchen-capacity-config?location_id=...
 * PATCH /api/delivery/admin/kitchen-capacity-config
 *       Body: { location_id: string; value: number }
 *
 * CRUD für delivery_config key `kitchen_max_concurrent_orders`.
 * Steuert den Schwellwert des Küchen-Kapazitäts-Alerts (Phase 482).
 *
 * GET  → { value: number; isCustom: boolean; default: 8 }
 * PATCH → { ok: true; value: number }
 *
 * Multi-Tenant: alle Queries filtern location_id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONFIG_KEY = 'kitchen_max_concurrent_orders';
const DEFAULT_VALUE = 8;

async function authAndResolve(req: NextRequest, locationId: string | null) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: 'Nicht eingeloggt', status: 401, user: null, sb };

  if (locationId) {
    const { data: emp } = await sb
      .from('employees')
      .select('location_id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (!emp) return { error: 'Keine Berechtigung', status: 403, user: null, sb };
  }

  return { error: null, status: 200, user, sb };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const { error, status } = await authAndResolve(req, locationId);
  if (error) return NextResponse.json({ error }, { status });

  const ssb = createServiceClient();

  const { data: row } = await ssb
    .from('delivery_config')
    .select('value, updated_at')
    .eq('location_id', locationId)
    .eq('key', CONFIG_KEY)
    .maybeSingle();

  const value = row?.value != null ? Number(row.value) : DEFAULT_VALUE;

  return NextResponse.json({
    key:       CONFIG_KEY,
    value,
    isCustom:  !!row,
    default:   DEFAULT_VALUE,
    updatedAt: (row?.updated_at as string | null) ?? null,
  });
}

interface PatchBody {
  location_id: string;
  value: number;
}

export async function PATCH(req: NextRequest) {
  const { error, status } = await authAndResolve(req, null);
  if (error) return NextResponse.json({ error }, { status });

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });
  }

  const { location_id, value } = body;
  if (!location_id) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const numValue = Number(value);
  if (!Number.isFinite(numValue) || numValue < 1 || numValue > 100) {
    return NextResponse.json({ error: 'value muss 1–100 sein' }, { status: 400 });
  }

  const ssb = createServiceClient();

  const { error: upsertErr } = await ssb
    .from('delivery_config')
    .upsert(
      {
        location_id,
        key:        CONFIG_KEY,
        value:      String(numValue),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'location_id,key' },
    );

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, key: CONFIG_KEY, value: numValue });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const { error, status } = await authAndResolve(req, locationId);
  if (error) return NextResponse.json({ error }, { status });

  const ssb = createServiceClient();

  await ssb
    .from('delivery_config')
    .delete()
    .eq('location_id', locationId)
    .eq('key', CONFIG_KEY);

  return NextResponse.json({ ok: true, value: DEFAULT_VALUE, isCustom: false });
}
