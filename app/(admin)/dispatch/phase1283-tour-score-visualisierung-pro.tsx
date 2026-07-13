'use client';

// Phase 1283 — Tour-Score-Visualisierung Pro (Dispatch)
// Kombination: Dispatch-Score-Balken + Tour-Fortschritt + ETA-Countdown je aktivem Fahrer
// Props: batches · drivers

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Clock, Star, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type Driver = {
  employee_id: string; ist_online: boolean; fahrzeug: string;
  aktueller_batch_id: string | null; last_lat: number | null; last_lng: number | null;
  last_update: string | null; online_seit: string | null;
  employee: { id: string; vorname: string; nachname: string; avatar_url: string | null; telefon: string | null } | null;
};

type Batch = {
  id: string; status: string; fahrer_id: string | null; startzeit?: string | null;
  total_distance_km: number | null; total_eta_min: number | null; zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: {
    id: string; order_id: string; reihenfolge: number; geliefert_am: string | null;
    order: { bestellnummer: string; kunde_name: string; kunde_adresse: string | null; eta_earliest: string | null; eta_latest: string | null } | null;
  }[];
};

interface Props {
  batches: Batch[];
  drivers: Driver[];
}

type ScoreBand = 'top' | 'gut' | 'ok' | 'schwach';

function scoreBand(score: number): ScoreBand {
  if (score >= 85) return 'top';
  if (score >= 70) return 'gut';
  if (score >= 55) return 'ok';
  return 'schwach';
}

const BAND_STYLE: Record<ScoreBand, { bar: string; badge: string; label: string }> = {
  top:    { bar: 'bg-matcha-500',  badge: 'bg-matcha-100 text-matcha-700',  label: 'Top' },
  gut:    { bar: 'bg-emerald-400', badge: 'bg-emerald-100 text-emerald-700', label: 'Gut' },
  ok:     { bar: 'bg-amber-400',   badge: 'bg-amber-100 text-amber-700',     label: 'OK' },
  schwach:{ bar: 'bg-red-400',     badge: 'bg-red-100 text-red-700',         label: 'Schwach' },
};

function fmtEtaRemain(startzeit: string | null | undefined, totalEtaMin: number | null): string {
  if (!startzeit || totalEtaMin === null) return '—';
  const endMs = new Date(startzeit).getTime() + totalEtaMin * 60_000;
  const remain = Math.floor((endMs - Date.now()) / 60_000);
  if (remain < 0) return `+${Math.abs(remain)} Min überfällig`;
  return `~${remain} Min`;
}

function vehicleIcon(fahrzeug: string | null | undefined): string {
  if (!fahrzeug) return '🚗';
  if (fahrzeug.includes('fahrrad') || fahrzeug.includes('rad')) return '🚲';
  if (fahrzeug.includes('motorrad') || fahrzeug.includes('moped')) return '🛵';
  if (fahrzeug.includes('cargo')) return '📦';
  return '🚗';
}

export function DispatchPhase1283TourScoreVisualisierungPro({ batches, drivers }: Props) {
  const [, setTick] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  // Aktive Touren (unterwegs / pickup)
  const activeBatches = batches.filter(b =>
    ['aktiv', 'unterwegs', 'pickup', 'assigned', 'on_route', 'at_restaurant'].includes(b.status)
  );

  if (activeBatches.length === 0) return null;

  // Mock-Scores (50-100) — in Produktion aus dispatch_score oder Driver-API
  const rows = activeBatches.map((b, i) => {
    const driver = drivers.find(d => d.employee_id === b.fahrer_id);
    const driverName = b.fahrer
      ? `${b.fahrer.vorname} ${b.fahrer.nachname}`
      : driver?.employee
        ? `${driver.employee.vorname} ${driver.employee.nachname}`
        : 'Fahrer';

    const totalStops = b.stops.length;
    const doneStops = b.stops.filter(s => s.geliefert_am != null).length;
    const progressPct = totalStops > 0 ? Math.round((doneStops / totalStops) * 100) : 0;

    // Pseudo-Score aus Effizienz-Metriken (Fortschritt + Pünktlichkeit)
    const baseScore = 60 + (progressPct * 0.3);
    const timeBonus = b.total_eta_min && b.startzeit
      ? Math.max(0, 15 - Math.max(0, (Date.now() - new Date(b.startzeit).getTime()) / 60_000 - b.total_eta_min))
      : 5;
    const score = Math.min(100, Math.round(baseScore + timeBonus + (i % 3) * 5));
    const band = scoreBand(score);
    const etaStr = fmtEtaRemain(b.startzeit, b.total_eta_min);

    const nextStop = b.stops.find(s => s.geliefert_am == null);
    const vehicle = vehicleIcon(driver?.fahrzeug ?? b.fahrer_id);

    return { b, driverName, score, band, progressPct, doneStops, totalStops, etaStr, nextStop, vehicle };
  });

  const avgScore = Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-matcha-100">
            <TrendingUp className="h-3.5 w-3.5 text-matcha-700" />
          </div>
          <span className="font-display text-sm font-bold uppercase tracking-wider text-char">
            Tour-Score Visualisierung Pro
          </span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">
            {activeBatches.length} Tour{activeBatches.length !== 1 ? 'en' : ''}
          </span>
          <span className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-black',
            BAND_STYLE[scoreBand(avgScore)].badge,
          )}>
            Ø {avgScore} Pkt
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {open && (
        <div className="border-t border-stone-100 divide-y divide-stone-100">
          {rows.map(({ b, driverName, score, band, progressPct, doneStops, totalStops, etaStr, nextStop, vehicle }) => {
            const bStyle = BAND_STYLE[band];
            return (
              <div key={b.id} className="px-4 py-3">
                {/* Row header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{vehicle}</span>
                    <span className="text-sm font-bold text-char">{driverName}</span>
                    {b.zone && (
                      <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[9px] font-bold text-stone-600">
                        Zone {b.zone}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black', bStyle.badge)}>
                      {bStyle.label}
                    </span>
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-saffron-DEFAULT" />
                      <span className="font-mono text-sm font-black text-char tabular-nums">{score}</span>
                    </div>
                  </div>
                </div>

                {/* Score bar */}
                <div className="relative h-2 rounded-full bg-stone-100 overflow-hidden mb-2">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', bStyle.bar)}
                    style={{ width: `${score}%` }}
                  />
                </div>

                {/* Stop progress */}
                <div className="flex items-center justify-between text-[11px] text-stone-500 mb-2">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span>
                      <strong className="text-char">{doneStops}</strong>/{totalStops} Stopps
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span className={cn(
                      'font-semibold',
                      etaStr.includes('überfällig') ? 'text-red-600' : 'text-stone-600',
                    )}>
                      {etaStr}
                    </span>
                  </div>
                </div>

                {/* Stop progress pills */}
                <div className="flex gap-1 flex-wrap">
                  {b.stops.map(stop => (
                    <div
                      key={stop.id}
                      className={cn(
                        'h-1.5 flex-1 min-w-[16px] rounded-full transition-all duration-500',
                        stop.geliefert_am
                          ? 'bg-matcha-500'
                          : stop.id === nextStop?.id
                            ? 'animate-pulse bg-amber-400'
                            : 'bg-stone-200',
                      )}
                    />
                  ))}
                </div>

                {/* Next stop */}
                {nextStop?.order && (
                  <div className="mt-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-1.5">
                    <div className="text-[9px] font-bold uppercase tracking-wide text-amber-600 mb-0.5">
                      Nächster Stopp #{nextStop.reihenfolge}
                    </div>
                    <div className="text-[11px] font-semibold text-stone-700 truncate">
                      {nextStop.order.kunde_name}
                    </div>
                    {nextStop.order.kunde_adresse && (
                      <div className="text-[10px] text-stone-500 truncate">
                        {nextStop.order.kunde_adresse}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
