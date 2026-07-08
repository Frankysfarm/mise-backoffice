/**
 * GET /api/delivery/admin/schicht-bilanz-export?location_id=<uuid>&date=YYYY-MM-DD
 *
 * Phase 659 — Schicht-Bilanz-Export-API
 * CSV-Download der Tagesschicht-Zusammenfassung je Fahrer.
 * Gibt Content-Disposition: attachment; filename="schicht-bilanz-YYYY-MM-DD.csv"
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface ShiftRow {
  id: string;
  driver_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  status: string;
}

interface BatchRow {
  id: string;
  driver_id: string | null;
  delivered_at: string | null;
  total_km: number | null;
  total_tip_eur: number | null;
  order_count: number | null;
  revenue_eur: number | null;
}

interface DriverRow {
  id: string;
  full_name: string | null;
  vehicle_type: string | null;
}

function escapeCsv(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const dateParam = searchParams.get('date');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  const targetDate = dateParam ?? new Date().toISOString().slice(0, 10);
  const dayStart = `${targetDate}T00:00:00.000Z`;
  const dayEnd = `${targetDate}T23:59:59.999Z`;

  try {
    const supabase = await createClient();

    const [shiftsRes, batchesRes, driversRes] = await Promise.all([
      supabase
        .from('driver_shifts')
        .select('id, driver_id, started_at, ended_at, status')
        .eq('location_id', locationId)
        .gte('started_at', dayStart)
        .lte('started_at', dayEnd),

      supabase
        .from('delivery_batches')
        .select('id, driver_id, delivered_at, total_km, total_tip_eur, order_count, revenue_eur')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('delivered_at', dayStart)
        .lte('delivered_at', dayEnd),

      supabase
        .from('drivers')
        .select('id, full_name, vehicle_type')
        .eq('location_id', locationId),
    ]);

    const shifts = (shiftsRes.data ?? []) as ShiftRow[];
    const batches = (batchesRes.data ?? []) as BatchRow[];
    const drivers = (driversRes.data ?? []) as DriverRow[];

    const driverMap = new Map<string, DriverRow>();
    for (const d of drivers) driverMap.set(d.id, d);

    const batchByDriver = new Map<string, BatchRow[]>();
    for (const b of batches) {
      if (!b.driver_id) continue;
      const list = batchByDriver.get(b.driver_id) ?? [];
      list.push(b);
      batchByDriver.set(b.driver_id, list);
    }

    const rows: string[] = [
      ['Fahrer', 'Fahrzeug', 'Schicht-Start', 'Schicht-Ende', 'Dauer (Min)', 'Touren', 'Bestellungen', 'km', 'Umsatz (€)', 'Trinkgeld (€)', 'Status'].join(','),
    ];

    for (const shift of shifts) {
      const dId = shift.driver_id ?? '';
      const driver = driverMap.get(dId);
      const driverBatches = batchByDriver.get(dId) ?? [];

      const startedAt = shift.started_at ? new Date(shift.started_at) : null;
      const endedAt = shift.ended_at ? new Date(shift.ended_at) : null;
      const durationMin = startedAt && endedAt
        ? Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000)
        : null;

      const totalKm = driverBatches.reduce((s, b) => s + (b.total_km ?? 0), 0);
      const totalTip = driverBatches.reduce((s, b) => s + (b.total_tip_eur ?? 0), 0);
      const totalRevenue = driverBatches.reduce((s, b) => s + (b.revenue_eur ?? 0), 0);
      const totalOrders = driverBatches.reduce((s, b) => s + (b.order_count ?? 0), 0);

      rows.push([
        escapeCsv(driver?.full_name ?? dId),
        escapeCsv(driver?.vehicle_type ?? ''),
        escapeCsv(shift.started_at ? new Date(shift.started_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : ''),
        escapeCsv(shift.ended_at ? new Date(shift.ended_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : 'laufend'),
        escapeCsv(durationMin),
        escapeCsv(driverBatches.length),
        escapeCsv(totalOrders),
        escapeCsv(totalKm.toFixed(1)),
        escapeCsv(totalRevenue.toFixed(2)),
        escapeCsv(totalTip.toFixed(2)),
        escapeCsv(shift.status),
      ].join(','));
    }

    const csv = rows.join('\n');
    const filename = `schicht-bilanz-${targetDate}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[Phase659] schicht-bilanz-export error:', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
