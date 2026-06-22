'use client';

/**
 * DispatchTourKarteGrid — Phase 405
 * Raster-Ansicht aller aktiven Touren mit Score, Fortschrittsbalken und ETA-Ampel.
 * Schlechteste Touren zuerst — damit Dispatcher sofort weiß, wo Handlungsbedarf besteht.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Bike, Car, CheckCircle2, Clock, MapPin, Package, Route, AlertTriangle, TrendingUp, User,
} from 'lucide-react';

type BatchStop = {
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
  fahrzeug?: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: BatchStop[];
};

interface Props {
  batches: Batch[];
}

function useTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

function elapsedMin(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

function calcScore(batch: Batch): number {
  const stops = batch.stops ?? [];
  const total = stops.length;
  if (total === 0) return 50;
  const done = stops.filter((s) => !!s.geliefert_am).length;
  const completionFactor = done / total;

  const elapsed = elapsedMin(batch.startzeit);
  const etaTotal = batch.total_eta_min ?? 0;
  const timeFactor = etaTotal > 0
    ? Math.max(0, Math.min(1, 1 - (elapsed - etaTotal) / Math.max(etaTotal, 1)))
    : 0.75;

  return Math.min(100, Math.round(timeFactor * 55 + completionFactor * 45));
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Gut';
  if (score >= 55) return 'OK';
  return 'Kritisch';
}

function scoreColors(score: number) {
  if (score >= 80) return { bg: 'bg-matcha-100', text: 'text-matcha-700', bar: 'bg-matcha-500', ring: 'ring-matcha-200' };
  if (score >= 55) return { bg: 'bg-amber-100', text: 'text-amber-700', bar: 'bg-amber-400', ring: 'ring-amber-200' };
  return { bg: 'bg-red-100', text: 'text-red-700', bar: 'bg-red-500', ring: 'ring-red-200' };
}

function formatEtaMin(startzeit: string | null | undefined, totalEtaMin: number | null): string {
  if (!startzeit || !totalEtaMin) return '—';
  const endMs = new Date(startzeit).getTime() + totalEtaMin * 60_000;
  const remainMin = Math.round((endMs - Date.now()) / 60_000);
  if (remainMin < 0) return `${Math.abs(remainMin)} Min über ETA`;
  return `${remainMin} Min`;
}

function DriverName({ fahrer }: { fahrer: { vorname: string; nachname: string } | null }) {
  if (!fahrer) return <span className="text-gray-400 italic">Unbekannt</span>;
  return <span>{fahrer.vorname} {fahrer.nachname.charAt(0)}.</span>;
}

export function DispatchTourKarteGrid({ batches }: Props) {
  useTick();
  const [collapsed, setCollapsed] = useState(false);

  const activeBatches = batches.filter(
    (b) => ['pickup', 'unterwegs', 'assigned', 'at_restaurant', 'on_route'].includes(b.status),
  );

  if (activeBatches.length === 0) return null;

  // Score pro Batch berechnen + sortieren (schlechteste zuerst)
  const scored = activeBatches
    .map((b) => ({ batch: b, score: calcScore(b) }))
    .sort((a, b) => a.score - b.score);

  const criticalCount = scored.filter((s) => s.score < 55).length;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-white border-b border-gray-100"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
            <Route size={16} className="text-blue-700" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-gray-900">Tour-Karte Grid</div>
            <div className="text-[11px] text-gray-500">
              {activeBatches.length} aktive Tour{activeBatches.length !== 1 ? 'en' : ''}
              {criticalCount > 0 && (
                <span className="ml-1.5 text-red-600 font-bold">• {criticalCount} kritisch</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[11px] font-bold animate-pulse">
              <AlertTriangle size={10} />
              {criticalCount}
            </span>
          )}
          <span className="text-gray-400 text-xs">{collapsed ? '▼' : '▲'}</span>
        </div>
      </button>

      {!collapsed && (
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {scored.map(({ batch, score }) => {
            const colors = scoreColors(score);
            const stops = batch.stops ?? [];
            const totalStops = stops.length;
            const doneStops = stops.filter((s) => !!s.geliefert_am).length;
            const progressPct = totalStops > 0 ? (doneStops / totalStops) * 100 : 0;
            const currentStop = stops.find((s) => !s.geliefert_am);
            const elapsed = elapsedMin(batch.startzeit);
            const remainEta = formatEtaMin(batch.startzeit, batch.total_eta_min);
            const isLate = batch.total_eta_min && elapsed > batch.total_eta_min;

            return (
              <div
                key={batch.id}
                className={cn(
                  'rounded-xl border p-3 ring-1',
                  colors.bg,
                  colors.ring,
                  'border-transparent',
                )}
              >
                {/* Header Row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    {batch.fahrzeug === 'car' ? (
                      <Car size={13} className="text-gray-500" />
                    ) : (
                      <Bike size={13} className="text-gray-500" />
                    )}
                    <span className="text-xs font-bold text-gray-900">
                      <DriverName fahrer={batch.fahrer} />
                    </span>
                    {batch.zone && (
                      <span className="text-[10px] bg-white/70 rounded-full px-1.5 py-0.5 text-gray-500 border border-gray-200">
                        {batch.zone}
                      </span>
                    )}
                  </div>
                  {/* Score Badge */}
                  <div className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full', colors.text, 'bg-white/80')}>
                    {score} – {scoreLabel(score)}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-1.5">
                  <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                    <span>{doneStops}/{totalStops} Stopps</span>
                    <span className={cn(isLate ? 'text-red-500 font-semibold' : '')}>
                      {isLate ? `+${elapsed - (batch.total_eta_min ?? 0)} Min verspätet` : `noch ${remainEta}`}
                    </span>
                  </div>
                  <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', colors.bar)}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Current Stop */}
                {currentStop?.order && (
                  <div className="flex items-start gap-1.5 mt-1.5">
                    <MapPin size={11} className="text-gray-400 mt-0.5 shrink-0" />
                    <div className="text-[11px] text-gray-600 leading-tight truncate">
                      <span className="font-medium">#{currentStop.order.bestellnummer}</span>
                      {' · '}
                      {currentStop.order.kunde_adresse ?? currentStop.order.kunde_name}
                    </div>
                  </div>
                )}
                {doneStops === totalStops && totalStops > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <CheckCircle2 size={12} className="text-matcha-500" />
                    <span className="text-[11px] text-matcha-600 font-semibold">Alle Stopps erledigt</span>
                  </div>
                )}

                {/* Distance + Time */}
                <div className="flex gap-2 mt-1.5 text-[10px] text-gray-500">
                  {batch.total_distance_km && (
                    <span className="flex items-center gap-0.5">
                      <Route size={9} />
                      {batch.total_distance_km.toFixed(1)} km
                    </span>
                  )}
                  <span className="flex items-center gap-0.5">
                    <Clock size={9} />
                    {elapsed} Min unterwegs
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
