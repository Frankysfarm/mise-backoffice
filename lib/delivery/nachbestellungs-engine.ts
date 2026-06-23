/**
 * lib/delivery/nachbestellungs-engine.ts — Phase 436
 *
 * Automatische Nachbestellungs-Engine:
 * Scannt Lagerbestände (delivery_materials) und erstellt Bestellaufträge
 * wenn current_stock < min_stock_level.
 *
 * Public API:
 *   scanAndCreate(locationId)          — Neue Nachbestellungen für eine Location
 *   scanAndCreateAllLocations()        — Cron-Batch
 *   getNachbestellungen(locationId, status?) — Liste lesen
 *   updateStatus(id, status, locationId, notes?) — Status aktualisieren
 *   pruneOldNachbestellungen(daysOld?) — Cleanup gelieferter Einträge
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export type NachbestellungStatus = 'ausstehend' | 'bestellt' | 'geliefert';

export interface Nachbestellung {
  id:            string;
  locationId:    string;
  artikelId:     string;
  artikelName:   string | null;
  einheit:       string | null;
  menge:         number;
  currentStock:  number | null;
  minStock:      number | null;
  status:        NachbestellungStatus;
  ausgeloestAm:  string;
  bestelltAm:    string | null;
  geliefertAm:   string | null;
  notizen:       string | null;
}

export interface ScanResult {
  locationId:  string;
  scanned:     number;
  created:     number;
  skipped:     number;
  errors:      number;
}

export interface BatchScanResult {
  locations:  number;
  created:    number;
  errors:     number;
}

// ── Scan & Erstellen ──────────────────────────────────────────────────────────

export async function scanAndCreate(locationId: string): Promise<ScanResult> {
  const sb = createServiceClient();

  const { data: materials } = await sb
    .from('delivery_materials')
    .select('id, name, current_stock, min_stock_level, reorder_qty')
    .eq('location_id', locationId)
    .eq('is_active', true);

  if (!materials?.length) {
    return { locationId, scanned: 0, created: 0, skipped: 0, errors: 0 };
  }

  const unterMindest = materials.filter(
    (m) => (m.current_stock as number) < (m.min_stock_level as number),
  );

  let created = 0;
  let skipped = 0;
  let errors  = 0;

  for (const mat of unterMindest) {
    // Prüfen ob bereits eine offene Bestellung für diesen Artikel existiert
    const { data: existing } = await sb
      .from('nachbestellungen')
      .select('id')
      .eq('location_id', locationId)
      .eq('artikel_id', mat.id)
      .eq('status', 'ausstehend')
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const menge = (mat.reorder_qty as number | null) ?? (mat.min_stock_level as number) * 2;

    const { error } = await sb
      .from('nachbestellungen')
      .insert({
        location_id:   locationId,
        artikel_id:    mat.id,
        menge,
        status:        'ausstehend',
        ausgeloest_am: new Date().toISOString(),
      });

    if (error) {
      errors++;
    } else {
      created++;
    }
  }

  return { locationId, scanned: materials.length, created, skipped, errors };
}

export async function scanAndCreateAllLocations(): Promise<BatchScanResult> {
  const sb = createServiceClient();
  const { data: locs } = await sb.from('locations').select('id').eq('is_active', true);

  let totalCreated = 0;
  let totalErrors  = 0;

  for (const loc of locs ?? []) {
    try {
      const r = await scanAndCreate(loc.id);
      totalCreated += r.created;
      totalErrors  += r.errors;
    } catch {
      totalErrors++;
    }
  }

  return { locations: (locs ?? []).length, created: totalCreated, errors: totalErrors };
}

// ── Lesen ─────────────────────────────────────────────────────────────────────

export async function getNachbestellungen(
  locationId: string,
  status?: NachbestellungStatus,
): Promise<Nachbestellung[]> {
  const sb = createServiceClient();

  let query = sb
    .from('nachbestellungen')
    .select(`
      id, location_id, artikel_id, menge, status, ausgeloest_am, bestellt_am, geliefert_am, notizen,
      delivery_materials!artikel_id (name, unit, current_stock, min_stock_level)
    `)
    .eq('location_id', locationId)
    .order('ausgeloest_am', { ascending: false })
    .limit(200);

  if (status) {
    query = query.eq('status', status);
  }

  const { data } = await query;

  return (data ?? []).map((r) => {
    const mat = r.delivery_materials as {
      name?: string; unit?: string; current_stock?: number; min_stock_level?: number;
    } | null;
    return {
      id:            r.id,
      locationId:    r.location_id,
      artikelId:     r.artikel_id,
      artikelName:   mat?.name ?? null,
      einheit:       mat?.unit ?? null,
      menge:         Number(r.menge),
      currentStock:  mat?.current_stock ?? null,
      minStock:      mat?.min_stock_level ?? null,
      status:        r.status as NachbestellungStatus,
      ausgeloestAm:  r.ausgeloest_am,
      bestelltAm:    r.bestellt_am ?? null,
      geliefertAm:   r.geliefert_am ?? null,
      notizen:       r.notizen ?? null,
    };
  });
}

// ── Status aktualisieren ──────────────────────────────────────────────────────

export async function updateStatus(
  id: string,
  status: NachbestellungStatus,
  locationId: string,
  notizen?: string,
): Promise<boolean> {
  const sb = createServiceClient();

  const updates: Record<string, unknown> = { status };
  if (status === 'bestellt')   updates.bestellt_am   = new Date().toISOString();
  if (status === 'geliefert')  updates.geliefert_am  = new Date().toISOString();
  if (notizen !== undefined)   updates.notizen        = notizen;

  const { error } = await sb
    .from('nachbestellungen')
    .update(updates)
    .eq('id', id)
    .eq('location_id', locationId);

  return !error;
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export async function pruneOldNachbestellungen(daysOld = 180): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_nachbestellungen', { days_old: daysOld });
  return (data as number | null) ?? 0;
}
