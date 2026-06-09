/**
 * GET /api/delivery/admin/payouts/export
 *
 * CSV-Export aller Fahrer-Abrechnungen eines Zeitraums.
 * Geeignet für Buchhaltung / Lohnbuchhaltung.
 *
 * Query-Parameter:
 *   location_id  — Pflicht
 *   since        — ISO-Datum (default: Montag dieser Woche)
 *   until        — ISO-Datum (default: heute)
 *   status       — draft | approved | paid | all (default: approved,paid)
 *   granularity  — periods | records (default: periods)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function esc(v: string | number | null | undefined): string {
  const s = String(v ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function euroFmt(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

function dateFmt(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE');
}

function getMondayOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  // Auth: Employee → location_id
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (!emp || emp.location_id !== locationId) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });
  }

  const now = new Date();
  const defaultSince = getMondayOfWeek(now);
  const sinceStr = searchParams.get('since') ?? defaultSince.toISOString();
  const untilStr = searchParams.get('until') ?? now.toISOString();
  const statusParam = searchParams.get('status') ?? 'all';
  const granularity = searchParams.get('granularity') ?? 'periods';

  const svc = createServiceClient();

  if (granularity === 'records') {
    // Einzelne Lieferdatensätze exportieren
    let q = svc
      .from('driver_payout_records')
      .select(`
        id, driver_id, order_id, completed_at, base_amount, km_bonus,
        peak_bonus, rating_bonus, milestone_bonus, total_amount,
        delivery_km, was_peak_time, driver_rating_at_time,
        deliveries_today_at_time, paid_out,
        mise_drivers(name)
      `)
      .eq('location_id', locationId)
      .gte('completed_at', sinceStr)
      .lte('completed_at', untilStr)
      .order('completed_at', { ascending: true })
      .limit(10000);

    if (statusParam === 'paid') q = q.eq('paid_out', true);
    if (statusParam === 'unpaid') q = q.eq('paid_out', false);

    const { data: records } = await q;
    const rows = records ?? [];

    const header = [
      'Datum', 'Fahrer', 'Bestell-ID', 'Basis (€)', 'km-Bonus (€)',
      'Peak-Bonus (€)', 'Rating-Bonus (€)', 'Meilenstein-Bonus (€)',
      'Gesamt (€)', 'km', 'Peak', 'Fahrer-Rating', 'Ausgezahlt',
    ];
    const lines: string[] = [header.map(esc).join(',')];

    for (const r of rows) {
      const driver = r.mise_drivers as { name: string } | null;
      lines.push([
        dateFmt(r.completed_at as string),
        driver?.name ?? r.driver_id,
        r.order_id ?? '',
        euroFmt(Number(r.base_amount)),
        euroFmt(Number(r.km_bonus)),
        euroFmt(Number(r.peak_bonus)),
        euroFmt(Number(r.rating_bonus)),
        euroFmt(Number(r.milestone_bonus)),
        euroFmt(Number(r.total_amount)),
        r.delivery_km != null ? String(Number(r.delivery_km).toFixed(1)) : '',
        r.was_peak_time ? 'Ja' : 'Nein',
        r.driver_rating_at_time != null ? String(Number(r.driver_rating_at_time).toFixed(2)) : '',
        r.paid_out ? 'Ja' : 'Nein',
      ].map(esc).join(','));
    }

    const filename = `fahrer-abrechnungen-einzeln-${new Date(sinceStr).toISOString().slice(0, 10)}.csv`;
    return new NextResponse('﻿' + lines.join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  // Standard: Perioden exportieren
  let q = svc
    .from('driver_payout_periods')
    .select(`
      id, driver_id, period_type, period_start, period_end,
      deliveries_count, total_km, total_base, total_km_bonus,
      total_peak_bonus, total_rating_bonus, total_milestone_bonus,
      total_payout, avg_rating, on_time_rate_pct, status,
      approved_at, paid_at, notes,
      mise_drivers(name)
    `)
    .eq('location_id', locationId)
    .gte('period_start', sinceStr)
    .lte('period_end', untilStr)
    .order('period_start', { ascending: true })
    .limit(5000);

  if (statusParam === 'draft') q = q.eq('status', 'draft');
  else if (statusParam === 'approved') q = q.eq('status', 'approved');
  else if (statusParam === 'paid') q = q.eq('status', 'paid');

  const { data: periods } = await q;
  const rows = periods ?? [];

  const header = [
    'Fahrer', 'Perioden-Typ', 'Von', 'Bis',
    'Lieferungen', 'km Gesamt',
    'Basis (€)', 'km-Bonus (€)', 'Peak-Bonus (€)',
    'Rating-Bonus (€)', 'Meilenstein-Bonus (€)', 'Gesamt (€)',
    'Ø Rating', 'Pünktlichkeit %', 'Status',
    'Freigegeben am', 'Ausgezahlt am', 'Notizen',
  ];
  const lines: string[] = [header.map(esc).join(',')];

  for (const p of rows) {
    const driver = p.mise_drivers as { name: string } | null;
    const periodTypeLabel: Record<string, string> = {
      daily: 'Täglich', weekly: 'Wöchentlich',
      monthly: 'Monatlich', custom: 'Benutzerdefiniert',
    };
    const statusLabel: Record<string, string> = {
      draft: 'Entwurf', approved: 'Freigegeben', paid: 'Ausgezahlt',
    };
    lines.push([
      driver?.name ?? p.driver_id,
      periodTypeLabel[p.period_type as string] ?? p.period_type,
      dateFmt(p.period_start as string),
      dateFmt(p.period_end as string),
      String(p.deliveries_count),
      String(Number(p.total_km).toFixed(1)),
      euroFmt(Number(p.total_base)),
      euroFmt(Number(p.total_km_bonus)),
      euroFmt(Number(p.total_peak_bonus)),
      euroFmt(Number(p.total_rating_bonus)),
      euroFmt(Number(p.total_milestone_bonus)),
      euroFmt(Number(p.total_payout)),
      p.avg_rating != null ? String(Number(p.avg_rating).toFixed(2)) : '',
      p.on_time_rate_pct != null ? String(Number(p.on_time_rate_pct).toFixed(0)) : '',
      statusLabel[p.status as string] ?? p.status,
      p.approved_at ? dateFmt(p.approved_at as string) : '',
      p.paid_at ? dateFmt(p.paid_at as string) : '',
      p.notes ?? '',
    ].map(esc).join(','));
  }

  const filename = `fahrer-perioden-${new Date(sinceStr).toISOString().slice(0, 10)}.csv`;
  return new NextResponse('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
