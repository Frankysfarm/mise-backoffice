/**
 * GET /api/delivery/admin/kitchen-countdown?location_id=...
 *
 * Phase 2720 — Smart Kochstart Countdown Cockpit
 * Liefert alle aktiven Bestellungen "in_zubereitung" und "fertig_wartend"
 * mit Kochstart-Zeitpunkt und Soll-Prep-Zeit für den Echtzeit-Countdown.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface OrderEntry {
  order_id: string;
  bestellnummer: string;
  kunde: string;
  items_count: number;
  kochstart_am: string | null;
  prep_time_min: number;
  status: 'in_zubereitung' | 'fertig' | 'fertig_wartend';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const svc = createServiceClient();

    const { data: emp } = await svc
      .from('employees')
      .select('tenant_id, location_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!emp?.tenant_id) return NextResponse.json({ ok: false, error: 'No tenant' }, { status: 403 });

    let query = svc
      .from('customer_orders')
      .select(`
        id,
        bestellnummer,
        kunde_name,
        status,
        location_id,
        in_zubereitung_am,
        prep_time_min,
        items:order_items(id)
      `)
      .eq('tenant_id', emp.tenant_id)
      .in('status', ['in_zubereitung', 'fertig'])
      .order('in_zubereitung_am', { ascending: true });

    if (locationId && locationId !== 'all') {
      query = query.eq('location_id', locationId);
    } else if (emp.location_id) {
      query = query.eq('location_id', emp.location_id);
    }

    const { data: orders, error } = await query;
    if (error) throw error;

    const mappedOrders: OrderEntry[] = (orders ?? []).map(o => {
      const itemsArr = Array.isArray(o.items) ? o.items : [];
      const kochstartAm = (o as Record<string, unknown>)['in_zubereitung_am'] as string | null;
      const prepMin: number = typeof (o as Record<string, unknown>)['prep_time_min'] === 'number'
        ? (o as Record<string, unknown>)['prep_time_min'] as number
        : 12;

      const isFertigWartend = o.status === 'fertig' && kochstartAm !== null;

      return {
        order_id: o.id,
        bestellnummer: `#${(o as Record<string, unknown>)['bestellnummer'] ?? o.id.slice(0, 6).toUpperCase()}`,
        kunde: (o.kunde_name as string | null) ?? 'Unbekannt',
        items_count: itemsArr.length,
        kochstart_am: kochstartAm,
        prep_time_min: prepMin,
        status: isFertigWartend ? 'fertig_wartend' : 'in_zubereitung',
      };
    });

    // Ø Prep-Zeit und Pünktlichkeitsrate berechnen
    const inZubOrders = mappedOrders.filter(o => o.status === 'in_zubereitung' && o.kochstart_am);
    const avgPrepMin = inZubOrders.length > 0
      ? inZubOrders.reduce((s, o) => s + o.prep_time_min, 0) / inZubOrders.length
      : 12;

    const onTimeCount = inZubOrders.filter(o => {
      if (!o.kochstart_am) return false;
      const secsLeft = (new Date(o.kochstart_am).getTime() + o.prep_time_min * 60_000 - Date.now()) / 1000;
      return secsLeft >= 0;
    }).length;
    const onTimeRate = inZubOrders.length > 0
      ? Math.round((onTimeCount / inZubOrders.length) * 100)
      : 100;

    return NextResponse.json({
      ok: true,
      orders: mappedOrders,
      avg_prep_min: Math.round(avgPrepMin * 10) / 10,
      on_time_rate: onTimeRate,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[kitchen-countdown]', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
