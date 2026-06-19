/**
 * GET /api/delivery/admin/tours?location_id=...&action=assignment_activity
 *
 * action=assignment_activity: Letzte Fahrer-Zuweisungen mit Annahmequote
 *   für DispatchZuweisungsAktivitaet.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const action = searchParams.get('action');

  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  if (action === 'assignment_activity') {
    const shiftStart = new Date();
    shiftStart.setHours(shiftStart.getHours() - 8, 0, 0, 0);

    const { data: batches } = await sb
      .from('mise_delivery_batches')
      .select(`
        id,
        state,
        zone,
        stop_count,
        created_at,
        assigned_driver_id,
        driver:employees!assigned_driver_id(vorname, nachname)
      `)
      .eq('location_id', locationId)
      .gte('created_at', shiftStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(30);

    const rows = batches ?? [];

    const events = rows.map((b: Record<string, unknown>) => {
      const driver = b.driver as Record<string, unknown> | null;
      const driverName = driver
        ? `${driver.vorname ?? ''} ${driver.nachname ?? ''}`.trim()
        : 'Unbekannt';
      const accepted = b.state !== 'abgelehnt' && b.state !== 'abgebrochen';
      const createdAt = b.created_at as string;
      const elapsed_sec = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
      return {
        id: b.id as string,
        batch_id: b.id as string,
        driver_name: driverName,
        order_count: (b.stop_count as number) ?? 0,
        zone: b.zone as string | null,
        accepted,
        assigned_at: createdAt,
        elapsed_sec: Math.min(elapsed_sec, 3600),
      };
    });

    const total = events.length;
    const accepted = events.filter((e) => e.accepted).length;
    const rejected = total - accepted;
    const acceptancePct = total > 0 ? (accepted / total) * 100 : 0;
    const avgResponseSec = total > 0
      ? events.reduce((s, e) => s + e.elapsed_sec, 0) / total
      : 0;

    return NextResponse.json({
      events,
      stats: { total, accepted, rejected, acceptancePct, avgResponseSec },
    });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}
