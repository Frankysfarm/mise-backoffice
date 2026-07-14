'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlarmClock, Bike, CheckCircle2, ChevronDown, ChevronRight, ChevronUp,
  MapPin, Navigation, Phone, Package, X,
} from 'lucide-react';

// Phase 1505 — Smart-Tour-Cockpit (Fahrer)
// Kompaktes Tour-Cockpit mit:
// • Fortschrittsring + Stopp-Übersicht
// • Nächster Stopp: Adresse, ETA-Countdown, 1-Tap-Navigation
// • Abschließen-Button je Stopp
// • Ampelfarbige ETA-Dringlichkeit

export interface Phase1505TourStop {
  id: string;
  reihenfolge: number;
  angekommen_am?: string | null;
  geliefert_am?: string | null;
  kunde_name?: string | null;
  kunde_adresse?: string | null;
  kunde_plz?: string | null;
  kunde_stadt?: string | null;
  kunde_telefon?: string | null;
  bestellnummer?: string | null;
  eta_min?: number | null;
  notiz?: string | null;
  lat?: number | null;
  lng?: number | null;
}

interface Props {
  stops: Phase1505TourStop[];
  onStoppAbschliessen?: (stopId: string) => void;
  onNavigate?: (stop: Phase1505TourStop) => void;
}

function etaColor(min: number | null | undefined): string {
  if (min == null)    return 'text-stone-500';
  if (min < 0)       return 'text-red-600';
  if (min <= 3)      return 'text-orange-600';
  if (min <= 8)      return 'text-yellow-600';
  return              'text-emerald-600';
}

function formatEta(min: number | null | undefined): string {
  if (min == null)   return '– Min';
  if (min < 0)       return `+${Math.abs(min)} Min`;
  if (min < 1)       return '< 1 Min';
  return `~${Math.round(min)} Min`;
}

function navigate(stop: Phase1505TourStop, cb?: (s: Phase1505TourStop) => void) {
  if (cb) { cb(stop); return; }
  if (stop.lat && stop.lng) {
    window.open(`https://maps.google.com/?q=${stop.lat},${stop.lng}&travelmode=driving`, '_blank');
  } else {
    const addr = [stop.kunde_adresse, stop.kunde_plz, stop.kunde_stadt].filter(Boolean).join(' ');
    window.open(`https://maps.google.com/?q=${encodeURIComponent(addr)}&travelmode=driving`, '_blank');
  }
}

export function FahrerPhase1505SmartTourCockpit({ stops, onStoppAbschliessen, onNavigate }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const sorted  = useMemo(() => [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge), [stops]);
  const done    = sorted.filter((s) => s.geliefert_am);
  const pending = sorted.filter((s) => !s.geliefert_am);
  const next    = pending[0] ?? null;

  useEffect(() => {
    if (next) setExpandedId(next.id);
  }, [next?.id]);

  async function handleComplete(stop: Phase1505TourStop) {
    setCompleting(stop.id);
    try {
      await new Promise((r) => setTimeout(r, 400));
      onStoppAbschliessen?.(stop.id);
    } finally {
      setCompleting(null);
    }
  }

  if (sorted.length === 0) return null;

  const pct = sorted.length > 0 ? Math.round((done.length / sorted.length) * 100) : 0;

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-matcha-700 text-white">
        <Bike className="w-4 h-4 shrink-0" />
        <span className="text-[11px] font-black uppercase tracking-widest">
          Smart Tour · {done.length}/{sorted.length} Stopps
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {pending.length > 0 && (
            <span className="rounded-full bg-white/25 px-2 py-0.5 text-[9px] font-bold">
              {pending.length} offen
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-matcha-100">
        <div
          className="h-full bg-matcha-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Next stop highlight (if pending) */}
      {next && (
        <div className="m-3 rounded-xl bg-matcha-50 border-2 border-matcha-300 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-matcha-600 flex items-center justify-center text-white text-[10px] font-black shrink-0">
              {next.reihenfolge}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold truncate">{next.kunde_name ?? 'Kunde'}</div>
              <div className="text-[10px] text-stone-500 truncate">
                {[next.kunde_adresse, next.kunde_plz, next.kunde_stadt].filter(Boolean).join(', ')}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className={cn('text-sm font-black tabular-nums', etaColor(next.eta_min))}>
                {formatEta(next.eta_min)}
              </div>
              <div className="text-[8px] text-stone-400">ETA</div>
            </div>
          </div>

          {/* Note */}
          {next.notiz && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[10px] text-amber-800 mb-2">
              {next.notiz}
            </div>
          )}

          {/* CTA buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => navigate(next, onNavigate)}
              className="flex flex-col items-center gap-1 rounded-xl bg-matcha-600 text-white py-2.5 text-[10px] font-bold active:opacity-80 transition-opacity"
            >
              <Navigation className="w-4 h-4" />
              Navigieren
            </button>
            {next.kunde_telefon ? (
              <button
                onClick={() => { if (next.kunde_telefon) window.open(`tel:${next.kunde_telefon}`, '_self'); }}
                className="flex flex-col items-center gap-1 rounded-xl bg-blue-600 text-white py-2.5 text-[10px] font-bold active:opacity-80 transition-opacity"
              >
                <Phone className="w-4 h-4" />
                Anrufen
              </button>
            ) : (
              <div />
            )}
            <button
              onClick={() => handleComplete(next)}
              disabled={completing === next.id}
              className="flex flex-col items-center gap-1 rounded-xl bg-emerald-600 text-white py-2.5 text-[10px] font-bold active:opacity-80 disabled:opacity-50 transition-opacity"
            >
              {completing === next.id ? (
                <AlarmClock className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Geliefert
            </button>
          </div>
        </div>
      )}

      {/* All stops list */}
      <div className="divide-y border-t">
        {sorted.map((stop) => {
          const isDone    = !!stop.geliefert_am;
          const isNext    = stop.id === next?.id;
          const isExpanded = expandedId === stop.id && !isNext;

          return (
            <div
              key={stop.id}
              className={cn(
                'transition-colors',
                isDone ? 'opacity-50 bg-stone-50' : isNext ? 'hidden' : 'bg-white',
              )}
            >
              <button
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
                onClick={() => setExpandedId(isExpanded ? null : stop.id)}
              >
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0',
                  isDone ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-600',
                )}>
                  {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : stop.reihenfolge}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{stop.kunde_name ?? 'Kunde'}</div>
                  <div className="text-[9px] text-stone-400 truncate">
                    {stop.kunde_adresse}{stop.kunde_plz ? `, ${stop.kunde_plz}` : ''}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  {!isDone && stop.eta_min !== undefined && stop.eta_min !== null && (
                    <span className={cn('text-[10px] font-bold tabular-nums', etaColor(stop.eta_min))}>
                      {formatEta(stop.eta_min)}
                    </span>
                  )}
                  {isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-stone-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-stone-300" />
                  )}
                </div>
              </button>

              {isExpanded && !isDone && (
                <div className="px-4 pb-3 flex gap-2">
                  <button
                    onClick={() => navigate(stop, onNavigate)}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-matcha-600 text-white py-2 text-[10px] font-bold"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Navigation
                  </button>
                  <button
                    onClick={() => handleComplete(stop)}
                    disabled={completing === stop.id}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-white py-2 text-[10px] font-bold disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Geliefert
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {pending.length > 0 && (
        <div className="flex items-center gap-2 border-t px-4 py-2 bg-stone-50 text-[10px] text-stone-500">
          <Package className="w-3 h-3 shrink-0" />
          <span>{pending.length} Stopp{pending.length !== 1 ? 's' : ''} ausstehend</span>
          <span className="ml-auto font-bold text-matcha-700">{pct}% erledigt</span>
        </div>
      )}
    </div>
  );
}
