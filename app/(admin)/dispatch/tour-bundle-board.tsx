'use client';

/**
 * TourBundleBoard — Kompakter Überblick über Tour-Bündelung-Effizienz.
 *
 * Zeigt für jede aktive Tour:
 * - Anzahl Stops + gelieferte Stops
 * - Effizienz: Stops/km (höher = besser)
 * - Zonen-Konzentration (Stops in gleicher Zone = gut)
 * - Geschätzter Rückkehrzeit
 *
 * Ergänzt die bestehenden TourSequenzPanel / LiveTourTracker
 * mit einem schnellen, kompakten Bündelungs-Überblick für Dispatcher.
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, MapPin, Route, Target, TrendingUp, Zap } from 'lucide-react';

type Stop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    eta_earliest: string | null;
    eta_latest: string | null;
  } | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: Stop[];
};

type BundleScore = {
  batch: Batch;
  doneCount: number;
  remainingCount: number;
  totalCount: number;
  stopsPerKm: number | null;
  bundleEfficiency: 'excellent' | 'good' | 'fair' | 'poor';
  zoneLabel: string;
  returnEtaMin: number | null;
};

function computeBundleEfficiency(stopsPerKm: number | null): BundleScore['bundleEfficiency'] {
  if (stopsPerKm === null) return 'fair';
  if (stopsPerKm >= 0.8) return 'excellent';
  if (stopsPerKm >= 0.5) return 'good';
  if (stopsPerKm >= 0.3) return 'fair';
  return 'poor';
}

const EFFICIENCY_STYLES: Record<BundleScore['bundleEfficiency'], {
  bar: string; badge: string; label: string;
}> = {
  excellent: { bar: 'bg-matcha-500',  badge: 'bg-matcha-100 text-matcha-700 border-matcha-200', label: 'Top' },
  good:      { bar: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-700 border-blue-200',       label: 'Gut' },
  fair:      { bar: 'bg-amber-400',   badge: 'bg-amber-100 text-amber-700 border-amber-200',    label: 'Ok' },
  poor:      { bar: 'bg-red-400',     badge: 'bg-red-100 text-red-700 border-red-200',          label: 'Dünn' },
};

function useTick() {
  return null; // tick handled by parent refresh
}

function ReturnEtaBadge({ startzeit, totalEtaMin }: { startzeit?: string | null; totalEtaMin: number | null }) {
  if (!startzeit || !totalEtaMin) return null;
  const returnAt = new Date(new Date(startzeit).getTime() + totalEtaMin * 60_000);
  const minLeft = Math.round((returnAt.getTime() - Date.now()) / 60_000);
  if (minLeft < -10) return <span className="text-[9px] text-red-500 font-bold">Überfällig</span>;
  if (minLeft < 0)   return <span className="text-[9px] text-amber-600 font-bold">Gleich zurück</span>;
  return (
    <span className="text-[9px] text-stone-500 tabular-nums">
      Rück. in {minLeft} Min
    </span>
  );
}

export function TourBundleBoard({ batches }: { batches: Batch[] }) {
  const active = batches.filter(b =>
    ['zugewiesen', 'pickup', 'unterwegs', 'on_route', 'assigned', 'at_restaurant'].includes(b.status),
  );

  const bundleScores: BundleScore[] = useMemo(() => active.map(batch => {
    const done = batch.stops.filter(s => s.geliefert_am).length;
    const remaining = batch.stops.filter(s => !s.geliefert_am).length;
    const total = batch.stops.length;
    const stopsPerKm = batch.total_distance_km && batch.total_distance_km > 0
      ? total / batch.total_distance_km
      : null;
    const efficiency = computeBundleEfficiency(stopsPerKm);
    const returnEtaMin = batch.total_eta_min && batch.startzeit
      ? Math.round((new Date(batch.startzeit).getTime() + batch.total_eta_min * 60_000 - Date.now()) / 60_000)
      : null;

    return {
      batch,
      doneCount: done,
      remainingCount: remaining,
      totalCount: total,
      stopsPerKm,
      bundleEfficiency: efficiency,
      zoneLabel: batch.zone ?? 'Zone?',
      returnEtaMin,
    };
  }), [active]);

  if (!bundleScores.length) return null;

  const avgEfficiency = bundleScores.reduce((s, b) => {
    const map = { excellent: 4, good: 3, fair: 2, poor: 1 };
    return s + map[b.bundleEfficiency];
  }, 0) / bundleScores.length;

  const overallLabel =
    avgEfficiency >= 3.5 ? 'Top Bündelung' :
    avgEfficiency >= 2.5 ? 'Gute Bündelung' :
    avgEfficiency >= 1.5 ? 'Mittelmäßig' : 'Schwache Bündelung';

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-stone-50 border-b border-stone-100">
        <Route className="h-3.5 w-3.5 text-blue-500 shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-wider text-stone-600 flex-1">
          Tour-Bündelung Übersicht
        </span>
        <span className={cn(
          'text-[9px] font-bold px-2 py-0.5 rounded-full border',
          avgEfficiency >= 3 ? 'bg-matcha-100 text-matcha-700 border-matcha-200' : 'bg-amber-100 text-amber-700 border-amber-200',
        )}>
          {overallLabel}
        </span>
      </div>

      {/* Tour Cards */}
      <div className="divide-y divide-stone-100">
        {bundleScores.map(({ batch, doneCount, totalCount, remainingCount, stopsPerKm, bundleEfficiency, zoneLabel, returnEtaMin }) => {
          const styles = EFFICIENCY_STYLES[bundleEfficiency];
          const donePct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

          return (
            <div key={batch.id} className="px-3 py-2">
              {/* Top row: fahrer + zone + efficiency badge */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-800 text-[9px] font-black text-white">
                  {batch.fahrer
                    ? `${batch.fahrer.vorname[0]}${batch.fahrer.nachname[0]}`
                    : '?'}
                </div>
                <span className="text-[11px] font-bold text-stone-800 flex-1 truncate">
                  {batch.fahrer
                    ? `${batch.fahrer.vorname} ${batch.fahrer.nachname}`
                    : 'Unbekannt'}
                </span>
                <span className={cn(
                  'text-[9px] font-bold px-1.5 py-0.5 rounded-full border',
                  styles.badge,
                )}>
                  {styles.label}
                </span>
                <span className="text-[9px] bg-stone-100 text-stone-600 rounded-full px-1.5 py-0.5 font-bold">
                  {zoneLabel}
                </span>
              </div>

              {/* Fortschrittsbalken */}
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', styles.bar)}
                    style={{ width: `${donePct}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-stone-600 tabular-nums shrink-0">
                  {doneCount}/{totalCount}
                </span>
              </div>

              {/* Metriken: Stops/km + Rückkehr */}
              <div className="flex items-center gap-3">
                {stopsPerKm !== null && (
                  <span className="flex items-center gap-1 text-[9px] text-stone-500">
                    <TrendingUp className="h-3 w-3 shrink-0" />
                    {stopsPerKm.toFixed(1)} Stops/km
                  </span>
                )}
                {batch.total_distance_km && (
                  <span className="flex items-center gap-1 text-[9px] text-stone-500">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {batch.total_distance_km.toFixed(1)} km
                  </span>
                )}
                {remainingCount > 0 && (
                  <span className="flex items-center gap-1 text-[9px] text-stone-500">
                    <Clock className="h-3 w-3 shrink-0" />
                    {remainingCount} verbleibend
                  </span>
                )}
                <div className="flex-1" />
                <ReturnEtaBadge startzeit={batch.startzeit} totalEtaMin={batch.total_eta_min} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Zusammenfassung */}
      <div className="px-3 py-2 bg-stone-50 border-t border-stone-100 flex items-center gap-3">
        <Target className="h-3 w-3 text-stone-400 shrink-0" />
        <span className="text-[9px] text-stone-500">
          {active.length} aktive Touren ·{' '}
          {bundleScores.reduce((s, b) => s + b.totalCount, 0)} Stops ·{' '}
          Ø {bundleScores.filter(b => b.stopsPerKm !== null).length > 0
            ? (bundleScores.reduce((s, b) => s + (b.stopsPerKm ?? 0), 0) / bundleScores.filter(b => b.stopsPerKm !== null).length).toFixed(1)
            : '—'} Stops/km
        </span>
      </div>
    </div>
  );
}
