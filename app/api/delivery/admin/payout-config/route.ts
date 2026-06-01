/**
 * GET  /api/delivery/admin/payout-config?location_id=...
 * POST /api/delivery/admin/payout-config
 *
 * Fahrer-Abrechnungs-Konfiguration laden und speichern.
 *
 * GET-Parameter:
 *   location_id — Pflicht
 *
 * POST-Body:
 *   {
 *     location_id:           string (uuid)
 *     base_per_delivery:     number  (€)
 *     km_rate:               number  (€/km)
 *     peak_multiplier:       number  (z.B. 1.2)
 *     bonus_per_rating_point: number (€ je 0.1 über 4.0)
 *     min_rating_for_bonus:  number  (default 4.0)
 *     milestone_bonuses:     { "10": 2.00, "25": 5.00, "50": 10.00 }
 *     peak_windows:          [{ weekday: 1–7, start: "HH:MM", end: "HH:MM" }]
 *   }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPayoutConfig, upsertPayoutConfig } from '@/lib/delivery/payout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = new URL(req.url).searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  try {
    const config = await getPayoutConfig(locationId);
    return NextResponse.json({ config });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const locationId = body.location_id as string | undefined;
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  try {
    const config = await upsertPayoutConfig({
      locationId,
      basePerDelivery: Number(body.base_per_delivery ?? 3.00),
      kmRate: Number(body.km_rate ?? 0.25),
      peakMultiplier: Number(body.peak_multiplier ?? 1.20),
      bonusPerRatingPoint: Number(body.bonus_per_rating_point ?? 0.10),
      minRatingForBonus: Number(body.min_rating_for_bonus ?? 4.0),
      milestoneBonuses: (body.milestone_bonuses as Record<string, number>) ?? { '10': 2.00, '25': 5.00, '50': 10.00 },
      peakWindows: (body.peak_windows as Array<{ weekday: number; start: string; end: string }>) ?? [],
      currency: (body.currency as string) ?? 'EUR',
      isActive: body.is_active !== false,
    });
    return NextResponse.json({ config });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
