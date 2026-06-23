/**
 * lib/delivery/kundenbindung.ts — Phase 437
 *
 * Kundenbindungs-Score: Automatische Kundenbewertung je Location.
 *
 * Score-Komponenten (0–100):
 *   Recency      (30%): Tage seit letzter Bestellung — ≤7d=100, ≥90d=0
 *   Frequenz     (30%): Bestellungen/Monat — ≥8=100, <0.5=0
 *   Bestellwert  (25%): Ø EUR je Bestellung — ≥50=100, <5=0
 *   Storno-Güte  (15%): invers Stornoquote — 0%=100, ≥20%=0
 *
 * Segmentierung:
 *   champion  — score ≥ 75
 *   loyal     — score ≥ 50
 *   at_risk   — score ≥ 25
 *   lost      — score  < 25
 *
 * Public API:
 *   computeForLocation(locationId)      — Alle Kunden einer Location
 *   computeAllLocations()               — Cron-Batch
 *   getScores(locationId, limit?)       — Top-Kunden lesen
 *   getSegmentStats(locationId)         — Aggregat je Segment
 *   pruneOldScores(daysOld?)            — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export type Segmentierung = 'champion' | 'loyal' | 'at_risk' | 'lost';

export interface KundenScore {
  id:                 string;
  locationId:         string;
  kundeTelefon:       string;
  kundeName:          string | null;
  score:              number;
  segmentierung:      Segmentierung;
  bestellfrequenz:    number | null;
  avgBestellwert:     number | null;
  letzteBestellung:   string | null;
  stornorate:         number | null;
  bestellungenTotal:  number;
  berechnetAm:        string;
}

export interface SegmentStats {
  segmentierung:  Segmentierung;
  count:          number;
  avgScore:       number;
  avgBestellwert: number;
  avgFrequenz:    number;
}

export interface KundenbindungsDashboard {
  totalKunden:    number;
  avgScore:       number | null;
  segmentStats:   SegmentStats[];
  topKunden:      KundenScore[];
  atRiskKunden:   KundenScore[];
  berechnetAm:    string | null;
}

export interface ComputeResult {
  locationId:  string;
  analyzed:    number;
  upserted:    number;
  errors:      number;
}

// ── Score-Berechnung ───────────────────────────────────────────────────────────

function recencyScore(daysSinceLast: number): number {
  if (daysSinceLast <= 7)  return 100;
  if (daysSinceLast >= 90) return 0;
  return Math.round((1 - (daysSinceLast - 7) / 83) * 100 * 10) / 10;
}

function frequenzScore(ordersPerMonth: number): number {
  if (ordersPerMonth >= 8)   return 100;
  if (ordersPerMonth < 0.5)  return 0;
  return Math.round((ordersPerMonth / 8) * 100 * 10) / 10;
}

function bestellwertScore(avgEur: number): number {
  if (avgEur >= 50)  return 100;
  if (avgEur < 5)    return 0;
  return Math.round(((avgEur - 5) / 45) * 100 * 10) / 10;
}

function stornoScore(stornorate: number): number {
  if (stornorate <= 0)    return 100;
  if (stornorate >= 0.20) return 0;
  return Math.round((1 - stornorate / 0.20) * 100 * 10) / 10;
}

function calcScore(r: number, f: number, b: number, s: number): number {
  return Math.round((r * 0.30 + f * 0.30 + b * 0.25 + s * 0.15) * 10) / 10;
}

function segmentFromScore(score: number): Segmentierung {
  if (score >= 75) return 'champion';
  if (score >= 50) return 'loyal';
  if (score >= 25) return 'at_risk';
  return 'lost';
}

// ── Berechnung ────────────────────────────────────────────────────────────────

export async function computeForLocation(locationId: string): Promise<ComputeResult> {
  const sb      = createServiceClient();
  const cutoff  = new Date(Date.now() - 365 * 86_400_000).toISOString();
  const now     = Date.now();

  const { data: orders } = await sb
    .from('customer_orders')
    .select('kunde_telefon, kunde_name, gesamtbetrag, status, created_at')
    .eq('location_id', locationId)
    .not('kunde_telefon', 'is', null)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(20000);

  if (!orders?.length) {
    return { locationId, analyzed: 0, upserted: 0, errors: 0 };
  }

  // Aggregiere je Telefonnummer
  interface Raw {
    name:         string | null;
    totalOrders:  number;
    stornoOrders: number;
    totalEur:     number;
    lastOrderAt:  string;
    firstOrderAt: string;
  }

  const byPhone = new Map<string, Raw>();

  for (const row of orders) {
    const phone = (row.kunde_telefon as string | null)?.trim();
    if (!phone) continue;

    const isStorno = row.status === 'storniert';
    const amount   = isStorno ? 0 : ((row.gesamtbetrag as number | null) ?? 0);
    const at       = row.created_at as string;

    const ex = byPhone.get(phone);
    if (!ex) {
      byPhone.set(phone, {
        name:         (row.kunde_name as string | null) ?? null,
        totalOrders:  1,
        stornoOrders: isStorno ? 1 : 0,
        totalEur:     amount,
        lastOrderAt:  at,
        firstOrderAt: at,
      });
    } else {
      ex.totalOrders++;
      if (isStorno) ex.stornoOrders++;
      ex.totalEur += amount;
      if (at > ex.lastOrderAt)  ex.lastOrderAt  = at;
      if (at < ex.firstOrderAt) ex.firstOrderAt = at;
    }
  }

  // Scores berechnen und upserten
  const rows: Record<string, unknown>[] = [];

  for (const [phone, raw] of byPhone.entries()) {
    const daysSinceLast = Math.floor((now - new Date(raw.lastOrderAt).getTime()) / 86_400_000);
    const spanDays      = Math.max(1, Math.floor((now - new Date(raw.firstOrderAt).getTime()) / 86_400_000));
    const validOrders   = raw.totalOrders - raw.stornoOrders;
    const ordersPerMonth = (validOrders / spanDays) * 30;
    const avgWert       = validOrders > 0 ? raw.totalEur / validOrders : 0;
    const stornorate    = raw.totalOrders > 0 ? raw.stornoOrders / raw.totalOrders : 0;

    const rS    = recencyScore(daysSinceLast);
    const fS    = frequenzScore(ordersPerMonth);
    const bS    = bestellwertScore(avgWert);
    const sS    = stornoScore(stornorate);
    const score = calcScore(rS, fS, bS, sS);

    rows.push({
      location_id:        locationId,
      kunde_telefon:      phone,
      kunde_name:         raw.name,
      score,
      segmentierung:      segmentFromScore(score),
      bestellfrequenz:    Math.round(ordersPerMonth * 100) / 100,
      avg_bestellwert:    Math.round(avgWert * 100) / 100,
      letzte_bestellung:  raw.lastOrderAt,
      stornorate:         Math.round(stornorate * 10000) / 10000,
      bestellungen_total: raw.totalOrders,
      berechnet_am:       new Date().toISOString(),
    });
  }

  let upserted = 0;
  let errors   = 0;

  // Chunk-weise upserten (max 500 pro Request)
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await sb
      .from('kunden_scores')
      .upsert(chunk, { onConflict: 'location_id,kunde_telefon' });
    if (error) {
      errors += chunk.length;
    } else {
      upserted += chunk.length;
    }
  }

  return { locationId, analyzed: rows.length, upserted, errors };
}

export async function computeAllLocations(): Promise<ComputeResult[]> {
  const sb = createServiceClient();
  const { data: locs } = await sb.from('locations').select('id').eq('is_active', true);

  const results: ComputeResult[] = [];
  for (const loc of locs ?? []) {
    try {
      results.push(await computeForLocation(loc.id));
    } catch {
      results.push({ locationId: loc.id, analyzed: 0, upserted: 0, errors: 1 });
    }
  }
  return results;
}

// ── Lesen ─────────────────────────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): KundenScore {
  return {
    id:                r.id as string,
    locationId:        r.location_id as string,
    kundeTelefon:      r.kunde_telefon as string,
    kundeName:         (r.kunde_name as string | null) ?? null,
    score:             Number(r.score),
    segmentierung:     r.segmentierung as Segmentierung,
    bestellfrequenz:   r.bestellfrequenz != null ? Number(r.bestellfrequenz) : null,
    avgBestellwert:    r.avg_bestellwert != null ? Number(r.avg_bestellwert) : null,
    letzteBestellung:  (r.letzte_bestellung as string | null) ?? null,
    stornorate:        r.stornorate != null ? Number(r.stornorate) : null,
    bestellungenTotal: Number(r.bestellungen_total),
    berechnetAm:       r.berechnet_am as string,
  };
}

export async function getScores(
  locationId: string,
  limit = 100,
  segmentierung?: Segmentierung,
): Promise<KundenScore[]> {
  const sb = createServiceClient();

  let query = sb
    .from('kunden_scores')
    .select('id,location_id,kunde_telefon,kunde_name,score,segmentierung,bestellfrequenz,avg_bestellwert,letzte_bestellung,stornorate,bestellungen_total,berechnet_am')
    .eq('location_id', locationId)
    .order('score', { ascending: false })
    .limit(limit);

  if (segmentierung) {
    query = query.eq('segmentierung', segmentierung);
  }

  const { data } = await query;
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function getSegmentStats(locationId: string): Promise<SegmentStats[]> {
  const sb = createServiceClient();

  const { data } = await sb
    .from('kunden_scores')
    .select('segmentierung, score, bestellfrequenz, avg_bestellwert')
    .eq('location_id', locationId);

  const statsMap = new Map<Segmentierung, { scores: number[]; frequenz: number[]; werte: number[] }>();

  for (const row of (data ?? []) as Array<{ segmentierung: string; score: number; bestellfrequenz: number | null; avg_bestellwert: number | null }>) {
    const seg = row.segmentierung as Segmentierung;
    if (!statsMap.has(seg)) statsMap.set(seg, { scores: [], frequenz: [], werte: [] });
    const s = statsMap.get(seg)!;
    s.scores.push(Number(row.score));
    if (row.bestellfrequenz != null) s.frequenz.push(Number(row.bestellfrequenz));
    if (row.avg_bestellwert != null) s.werte.push(Number(row.avg_bestellwert));
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round((arr.reduce((s, n) => s + n, 0) / arr.length) * 10) / 10 : 0;

  return (['champion', 'loyal', 'at_risk', 'lost'] as Segmentierung[]).map((seg) => {
    const s = statsMap.get(seg) ?? { scores: [], frequenz: [], werte: [] };
    return {
      segmentierung:  seg,
      count:          s.scores.length,
      avgScore:       avg(s.scores),
      avgBestellwert: avg(s.werte),
      avgFrequenz:    avg(s.frequenz),
    };
  });
}

export async function getDashboard(locationId: string): Promise<KundenbindungsDashboard> {
  const [segmentStats, topKunden, atRiskKunden, allScores] = await Promise.all([
    getSegmentStats(locationId),
    getScores(locationId, 10),
    getScores(locationId, 20, 'at_risk'),
    getScores(locationId, 1000),
  ]);

  const avgScore =
    allScores.length > 0
      ? Math.round((allScores.reduce((s, k) => s + k.score, 0) / allScores.length) * 10) / 10
      : null;

  const latestAt = allScores[0]?.berechnetAm ?? null;

  return {
    totalKunden:  allScores.length,
    avgScore,
    segmentStats,
    topKunden,
    atRiskKunden,
    berechnetAm:  latestAt,
  };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export async function pruneOldScores(daysOld = 90): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_kunden_scores', { days_old: daysOld });
  return (data as number | null) ?? 0;
}
