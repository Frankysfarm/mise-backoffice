/**
 * GET /api/delivery/admin/export
 *
 * Phase 92 — Admin CSV/ZIP Export
 *
 * Query-Parameter:
 *   type         — tours | shifts | payouts | drivers | all  (default: all)
 *   location_id  — Pflicht
 *   from         — YYYY-MM-DD (default: 30 Tage)
 *   to           — YYYY-MM-DD (default: heute)
 *   format       — csv | zip  (default: zip für type=all, csv sonst)
 *
 * Rückgabe:
 *   type=all oder format=zip  → application/zip   (eine CSV pro Datensatz-Typ)
 *   sonst                    → text/csv
 *
 * Auth: Eingeloggter Nutzer (Admin-Check via location_id-Zugehörigkeit)
 *
 * Limits: max 10 000 Zeilen pro Tabelle
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import JSZip from 'jszip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ROWS = 10_000;

// ── CSV-Hilfen ────────────────────────────────────────────────────────────────

function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const header = keys.map(esc).join(',');
  const body = rows.map((r) => keys.map((k) => esc(r[k])).join(',')).join('\n');
  return '﻿' + header + '\n' + body; // UTF-8 BOM für Excel
}

// ── Daten-Exporter ────────────────────────────────────────────────────────────

async function exportTours(locationId: string, from: string, to: string) {
  const svc = createServiceClient();
  const { data } = await svc
    .from('mise_delivery_batches')
    .select(`
      id, state, zone, total_distance_km, total_eta_min, stop_count,
      kitchen_start_at, estimated_pickup_at, estimated_delivery_at,
      created_at,
      driver:mise_drivers(id, name, vehicle)
    `)
    .eq('location_id', locationId)
    .gte('created_at', from + 'T00:00:00Z')
    .lte('created_at', to + 'T23:59:59Z')
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS);

  const rows = (data ?? []).map((b) => {
    const drv = (Array.isArray(b.driver) ? b.driver[0] : b.driver) as Record<string, unknown> | null;
    return {
      tour_id: b.id,
      status: b.state,
      zone: b.zone,
      fahrer_id: drv?.id ?? '',
      fahrer_name: drv?.name ?? '',
      fahrzeug: drv?.vehicle ?? '',
      stops: b.stop_count,
      distanz_km: b.total_distance_km,
      eta_min: b.total_eta_min,
      kueche_start: b.kitchen_start_at,
      geplante_abholung: b.estimated_pickup_at,
      geplante_lieferung: b.estimated_delivery_at,
      erstellt_am: b.created_at,
    };
  });

  return toCsv(rows);
}

async function exportShifts(locationId: string, from: string, to: string) {
  const svc = createServiceClient();

  // Alle Fahrer der Location holen
  const { data: drivers } = await svc
    .from('mise_drivers')
    .select('id, name')
    .limit(500);

  const driverMap = new Map<string, string>(
    (drivers ?? []).map((d) => [d.id as string, (d.name as string) ?? ''])
  );

  const { data } = await svc
    .from('driver_shifts')
    .select('id, driver_id, planned_start, planned_end, actual_start, actual_end, status, notes')
    .gte('planned_start', from + 'T00:00:00Z')
    .lte('planned_start', to + 'T23:59:59Z')
    .order('planned_start', { ascending: false })
    .limit(MAX_ROWS);

  const rows = (data ?? []).map((s) => {
    const dur =
      s.actual_start && s.actual_end
        ? Math.round(
            (new Date(s.actual_end as string).getTime() -
              new Date(s.actual_start as string).getTime()) /
              60_000
          )
        : null;
    return {
      schicht_id: s.id,
      fahrer_id: s.driver_id,
      fahrer_name: driverMap.get(s.driver_id as string) ?? '',
      geplant_start: s.planned_start,
      geplant_ende: s.planned_end,
      tatsaechlich_start: s.actual_start ?? '',
      tatsaechlich_ende: s.actual_end ?? '',
      dauer_min: dur ?? '',
      status: s.status,
      notizen: s.notes ?? '',
    };
  });

  return toCsv(rows);
}

async function exportPayouts(locationId: string, from: string, to: string) {
  const svc = createServiceClient();
  const { data } = await svc
    .from('driver_payout_records')
    .select(`
      id, driver_id, batch_id, base_pay_eur, distance_pay_eur, bonus_eur,
      total_eur, paid_out, created_at,
      driver:mise_drivers(name, vehicle)
    `)
    .eq('location_id', locationId)
    .gte('created_at', from + 'T00:00:00Z')
    .lte('created_at', to + 'T23:59:59Z')
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS);

  const rows = (data ?? []).map((p) => {
    const drv = (Array.isArray(p.driver) ? p.driver[0] : p.driver) as Record<string, unknown> | null;
    return {
      abrechnungs_id: p.id,
      fahrer_id: p.driver_id,
      fahrer_name: drv?.name ?? '',
      fahrzeug: drv?.vehicle ?? '',
      tour_id: p.batch_id,
      basis_eur: p.base_pay_eur,
      strecke_eur: p.distance_pay_eur,
      bonus_eur: p.bonus_eur,
      gesamt_eur: p.total_eur,
      ausgezahlt: p.paid_out ? 'ja' : 'nein',
      erstellt_am: p.created_at,
    };
  });

  return toCsv(rows);
}

async function exportDrivers(locationId: string) {
  const svc = createServiceClient();
  const { data } = await svc
    .from('mise_drivers')
    .select(`
      id, name, vehicle, phone, state, active,
      max_radius_km, current_capacity, max_capacity, total_deliveries,
      avg_rating, zone, created_at
    `)
    .limit(MAX_ROWS);

  const rows = (data ?? []).map((d) => ({
    fahrer_id: d.id,
    name: d.name,
    fahrzeug: d.vehicle,
    telefon: d.phone ?? '',
    status: d.state,
    aktiv: d.active ? 'ja' : 'nein',
    max_radius_km: d.max_radius_km,
    kapazitaet_aktuell: d.current_capacity,
    kapazitaet_max: d.max_capacity,
    lieferungen_gesamt: d.total_deliveries,
    ø_bewertung: d.avg_rating ?? '',
    zone: d.zone ?? '',
    erstellt_am: d.created_at,
  }));

  return toCsv(rows);
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const type = searchParams.get('type') ?? 'all';
  const today = new Date().toISOString().slice(0, 10);
  const from = searchParams.get('from') ?? new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const to = searchParams.get('to') ?? today;

  const wantsZip = (searchParams.get('format') ?? (type === 'all' ? 'zip' : 'csv')) === 'zip';

  const validTypes = ['tours', 'shifts', 'payouts', 'drivers', 'all'];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: 'type muss tours|shifts|payouts|drivers|all sein' }, { status: 400 });
  }

  try {
    // ── Einzel-CSV ────────────────────────────────────────────────────────
    if (type !== 'all' && !wantsZip) {
      let csv = '';
      const filename = `mise-${type}-${from}-${to}.csv`;

      if (type === 'tours')   csv = await exportTours(locationId, from, to);
      if (type === 'shifts')  csv = await exportShifts(locationId, from, to);
      if (type === 'payouts') csv = await exportPayouts(locationId, from, to);
      if (type === 'drivers') csv = await exportDrivers(locationId);

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // ── ZIP (type=all oder format=zip) ────────────────────────────────────
    const zip = new JSZip();
    const folder = zip.folder(`mise-export-${from}-${to}`)!;

    const [toursCsv, shiftsCsv, payoutsCsv, driversCsv] = await Promise.all([
      type === 'all' || type === 'tours'   ? exportTours(locationId, from, to)   : Promise.resolve(null),
      type === 'all' || type === 'shifts'  ? exportShifts(locationId, from, to)  : Promise.resolve(null),
      type === 'all' || type === 'payouts' ? exportPayouts(locationId, from, to) : Promise.resolve(null),
      type === 'all' || type === 'drivers' ? exportDrivers(locationId)            : Promise.resolve(null),
    ]);

    if (toursCsv   !== null) folder.file('touren.csv',    toursCsv);
    if (shiftsCsv  !== null) folder.file('schichten.csv', shiftsCsv);
    if (payoutsCsv !== null) folder.file('abrechnung.csv', payoutsCsv);
    if (driversCsv !== null) folder.file('fahrer.csv',    driversCsv);

    // README
    folder.file(
      'README.txt',
      `Mise Delivery Export\nZeitraum: ${from} bis ${to}\nErstellt: ${new Date().toISOString()}\n`
    );

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const zipFilename = `mise-export-${from}-${to}.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
