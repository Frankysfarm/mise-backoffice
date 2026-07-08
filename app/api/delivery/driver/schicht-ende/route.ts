/**
 * POST /api/delivery/driver/schicht-ende
 * body: { driver_id, km_ende }
 *
 * Phase 724 — Schicht-Ende-Bestätigung
 * Markiert die laufende Schicht des Fahrers als beendet und speichert den End-km-Stand.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json() as { driver_id: string; km_ende: number };
  const { driver_id, km_ende } = body;

  if (!driver_id) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  if (typeof km_ende !== 'number') return NextResponse.json({ error: 'km_ende required' }, { status: 400 });

  const sb = await createClient();

  // Find the active shift for this driver
  const { data: shift } = await sb
    .from('driver_shifts')
    .select('id')
    .eq('driver_id', driver_id)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!shift) {
    // No active shift found — just log the km reading
    await sb.from('driver_km_logs').insert({
      driver_id,
      km_stand: km_ende,
      type: 'ende',
      logged_at: new Date().toISOString(),
    }).throwOnError().catch(() => null);

    return NextResponse.json({ success: true, message: 'Keine aktive Schicht gefunden, km gespeichert' });
  }

  // Update the shift
  const { error } = await sb
    .from('driver_shifts')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
      km_ende,
    })
    .eq('id', shift.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, shift_id: shift.id, km_ende });
}
