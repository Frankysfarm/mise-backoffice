/**
 * GET  /api/delivery/admin/alert-rules?location_id=...
 *
 * Lädt Alert-Regeln einer Location.
 * Erstellt Default-Regeln wenn noch keine vorhanden (Seed).
 *
 * Response: { rules: AlertRule[] }
 *
 * POST /api/delivery/admin/alert-rules
 * Body: {
 *   location_id,
 *   alert_type: 'dispatch_queue_high' | 'no_drivers_online' | 'kitchen_overload' | 'stale_orders_critical' | 'eta_accuracy_low',
 *   threshold_value: number,
 *   window_minutes?: number,
 *   severity?: 'info' | 'warning' | 'critical',
 *   enabled?: boolean
 * }
 *
 * Legt neue Regel an oder überschreibt bestehende (UPSERT via location_id+alert_type).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAlertRules, upsertAlertRule, type AlertType, type AlertSeverity } from '@/lib/delivery/alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_TYPES: AlertType[] = [
  'dispatch_queue_high',
  'no_drivers_online',
  'kitchen_overload',
  'stale_orders_critical',
  'eta_accuracy_low',
];

const VALID_SEVERITIES: AlertSeverity[] = ['info', 'warning', 'critical'];

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  try {
    const rules = await getAlertRules(locationId);
    return NextResponse.json({ rules });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json() as {
    location_id?:     string;
    alert_type?:      string;
    threshold_value?: unknown;
    window_minutes?:  unknown;
    severity?:        string;
    enabled?:         unknown;
  };

  const { location_id, alert_type, threshold_value, window_minutes, severity, enabled } = body;

  if (!location_id)     return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  if (!alert_type)      return NextResponse.json({ error: 'alert_type fehlt' }, { status: 400 });
  if (threshold_value === undefined) return NextResponse.json({ error: 'threshold_value fehlt' }, { status: 400 });

  if (!VALID_TYPES.includes(alert_type as AlertType)) {
    return NextResponse.json({ error: `Ungültiger alert_type: ${alert_type}` }, { status: 400 });
  }

  const sev = (severity ?? 'warning') as AlertSeverity;
  if (!VALID_SEVERITIES.includes(sev)) {
    return NextResponse.json({ error: `Ungültige severity: ${severity}` }, { status: 400 });
  }

  const thresholdNum = Number(threshold_value);
  const windowNum    = Number(window_minutes ?? 5);
  const enabledBool  = enabled !== false;

  if (isNaN(thresholdNum) || thresholdNum < 0) {
    return NextResponse.json({ error: 'threshold_value muss eine nicht-negative Zahl sein' }, { status: 400 });
  }

  try {
    const rule = await upsertAlertRule({
      location_id,
      alert_type:      alert_type as AlertType,
      threshold_value: thresholdNum,
      window_minutes:  windowNum,
      severity:        sev,
      enabled:         enabledBool,
    });
    return NextResponse.json({ ok: true, rule });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
