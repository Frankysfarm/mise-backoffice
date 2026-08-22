/**
 * GET    /api/delivery/admin/config?location_id=...
 * GET    /api/delivery/admin/config?location_id=...&key=dispatch_escalation_min
 * PATCH  /api/delivery/admin/config
 * POST   /api/delivery/admin/config   (action: 'reset' | 'clone')
 *
 * Dynamic Delivery Configuration — per-location settings management.
 *
 * GET (all)
 *   Returns all settings merged with defaults, grouped by category.
 *   Response: { settings: SettingRow[]; categories: string[]; _fallback?: true }
 *
 * GET (single)
 *   Returns one setting with metadata.
 *   Response: { key, effective_value, default_value, is_customised, ... }
 *
 * PATCH
 *   Upserts a single setting for a location.
 *   Body: { location_id, key, value: number }
 *   Response: { ok: true; key; effective_value }
 *
 * POST action=reset
 *   Resets all custom settings for a location to system defaults.
 *   Body: { location_id, action: 'reset' }
 *   Response: { ok: true; deleted: number }
 *
 * POST action=clone
 *   Copies settings from one location to another (same tenant only).
 *   Body: { location_id, action: 'clone', source_location_id }
 *   Response: { ok: true; copied: number }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  listSettings,
  upsertSetting,
  resetToDefaults,
  cloneSettings,
  getHardcodedDefaults,
  type DeliverySettingKey,
} from '@/lib/delivery/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  // Verify the user belongs to this location
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!emp) return NextResponse.json({ error: 'Keine Berechtigung für diese Location' }, { status: 403 });

  const singleKey = searchParams.get('key') as DeliverySettingKey | null;

  try {
    const rows = await listSettings(locationId);

    if (singleKey) {
      const row = rows.find((r) => r.key === singleKey);
      if (!row) return NextResponse.json({ error: `Unbekannter Schlüssel: ${singleKey}` }, { status: 404 });
      return NextResponse.json(row);
    }

    const categories = [...new Set(rows.map((r) => r.category))].sort();

    const grouped = Object.fromEntries(
      categories.map((cat) => [cat, rows.filter((r) => r.category === cat)]),
    );

    const customisedCount = rows.filter((r) => r.is_customised).length;

    return NextResponse.json({
      settings:         rows,
      grouped,
      categories,
      total:            rows.length,
      customised_count: customisedCount,
    });
  } catch (err) {
    // Migration 027 not yet applied — return hard-coded defaults
    const defaults = getHardcodedDefaults();
    const fallbackRows = (Object.keys(defaults) as DeliverySettingKey[]).map((key) => ({
      key,
      effective_value: defaults[key],
      default_value:   defaults[key],
      custom_value:    null,
      is_customised:   false,
      description:     '',
      category:        'general',
      min_value:       null,
      max_value:       null,
      updated_at:      null,
    }));
    return NextResponse.json({
      settings:         fallbackRows,
      categories:       ['general'],
      total:            fallbackRows.length,
      customised_count: 0,
      _fallback:        true,
      _hint:            'Migration 027 noch nicht ausgeführt. Standardwerte werden angezeigt.',
    });
  }
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: { location_id?: string; key?: string; value?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Ungültiges JSON' }, { status: 400 }); }

  const { location_id: locationId, key, value } = body;
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  if (!key)        return NextResponse.json({ error: 'key fehlt' }, { status: 400 });
  if (value === undefined || value === null) return NextResponse.json({ error: 'value fehlt' }, { status: 400 });

  const numValue = Number(value);
  if (isNaN(numValue)) return NextResponse.json({ error: `value muss eine Zahl sein, erhalten: ${value}` }, { status: 400 });

  // Verify user belongs to this location
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!emp) return NextResponse.json({ error: 'Keine Berechtigung für diese Location' }, { status: 403 });

  const result = await upsertSetting(locationId, key as DeliverySettingKey, numValue, user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });

  return NextResponse.json({ ok: true, key, effective_value: numValue });
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: { location_id?: string; action?: string; source_location_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Ungültiges JSON' }, { status: 400 }); }

  const { location_id: locationId, action } = body;
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  // Verify user belongs to this location
  const { data: emp } = await sb
    .from('employees')
    .select('location_id, tenant_id')
    .eq('auth_user_id', user.id)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!emp) return NextResponse.json({ error: 'Keine Berechtigung für diese Location' }, { status: 403 });

  if (action === 'reset') {
    const result = await resetToDefaults(locationId);
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  }

  if (action === 'clone') {
    const { source_location_id } = body;
    if (!source_location_id) return NextResponse.json({ error: 'source_location_id fehlt' }, { status: 400 });

    // Verify source location belongs to same tenant
    const { data: sourceEmp } = await sb
      .from('employees')
      .select('location_id')
      .eq('auth_user_id', user.id)
      .eq('location_id', source_location_id)
      .maybeSingle();

    if (!sourceEmp) {
      return NextResponse.json({ error: 'Keine Berechtigung für source_location_id' }, { status: 403 });
    }

    const result = await cloneSettings(source_location_id, locationId);
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  }

  return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
}
