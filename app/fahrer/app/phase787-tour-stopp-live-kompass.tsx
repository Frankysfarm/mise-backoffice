'use client';

import { useEffect, useState } from 'react';
import { Navigation, MapPin, CheckCircle2, Clock, ChevronRight, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourStop {
  id: string;
  stopp_nr: number;
  adresse: string;
  stadtteil?: string | null;
  kunde_name?: string | null;
  kunde_telefon?: string | null;
  geliefert_am?: string | null;
  eta_min?: number | null;
  distanz_km?: number | null;
  notiz?: string | null;
  order_id?: string | null;
  bestellnummer?: string | null;
}

interface Props {
  stops: TourStop[];
  currentStopIndex?: number;
  onNavigate?: (stop: TourStop) => void;
  onConfirmDelivery?: (stop: TourStop) => void;
}

function etaLabel(min: number | null | undefined): string {
  if (min == null) return '– Min';
  if (min < 1) return '< 1 Min';
  return `${Math.round(min)} Min`;
}

function etaColor(min: number | null | undefined): string {
  if (min == null) return 'text-stone-400';
  if (min <= 5) return 'text-matcha-600 dark:text-matcha-400';
  if (min <= 12) return 'text-amber-600 dark:text-amber-400';
  return 'text-stone-500 dark:text-stone-400';
}

export function FahrerPhase787TourStoppLiveKompass({
  stops,
  currentStopIndex = 0,
  onNavigate,
  onConfirmDelivery,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!stops || stops.length === 0) return null;

  const pending = stops.filter((s) => !s.geliefert_am);
  const done = stops.filter((s) => !!s.geliefert_am);
  const current = pending[0] ?? null;

  return (
    <div className="space-y-2">
      {/* Current stop — prominent */}
      {current && (
        <div className="rounded-2xl border-2 border-matcha-400 dark:border-matcha-600 bg-matcha-50 dark:bg-matcha-950/30 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-matcha-500/10 dark:bg-matcha-900/40 border-b border-matcha-200 dark:border-matcha-800/50">
            <Navigation className="h-3.5 w-3.5 text-matcha-600 dark:text-matcha-400 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-wide text-matcha-700 dark:text-matcha-300">
              Nächster Stopp · #{current.stopp_nr}
            </span>
            {current.eta_min != null && (
              <span className={cn(
                'ml-auto text-xs font-black tabular-nums',
                etaColor(current.eta_min),
              )}>
                {etaLabel(current.eta_min)}
              </span>
            )}
          </div>
          <div className="px-4 py-3 space-y-2">
            {/* Address */}
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-matcha-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-stone-800 dark:text-stone-100 leading-tight">
                  {current.adresse}
                </div>
                {current.stadtteil && (
                  <div className="text-xs text-stone-500 dark:text-stone-400">{current.stadtteil}</div>
                )}
                {current.kunde_name && (
                  <div className="text-xs text-stone-600 dark:text-stone-300 font-semibold mt-0.5">
                    {current.kunde_name}
                    {current.bestellnummer && (
                      <span className="ml-1 text-stone-400 font-normal">#{current.bestellnummer}</span>
                    )}
                  </div>
                )}
                {current.notiz && (
                  <div className="mt-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-400">
                    📝 {current.notiz}
                  </div>
                )}
              </div>
              {current.distanz_km != null && (
                <div className="text-right shrink-0">
                  <div className="text-sm font-black tabular-nums text-stone-700 dark:text-stone-200">
                    {current.distanz_km.toFixed(1)} km
                  </div>
                  <div className="text-[9px] text-stone-400">Entfernung</div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => onNavigate?.(current)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-matcha-500 hover:bg-matcha-600 active:scale-95 text-white text-xs font-bold py-2.5 transition-all"
              >
                <Navigation className="h-3.5 w-3.5" />
                Navigation starten
              </button>
              {current.kunde_telefon && (
                <a
                  href={`tel:${current.kunde_telefon}`}
                  className="flex items-center justify-center w-11 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 active:scale-95 transition-all"
                >
                  <Phone className="h-4 w-4 text-stone-600 dark:text-stone-300" />
                </a>
              )}
              <button
                onClick={() => onConfirmDelivery?.(current)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-stone-800 dark:bg-stone-700 hover:bg-stone-900 dark:hover:bg-stone-600 active:scale-95 text-white text-xs font-bold py-2.5 transition-all"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Zugestellt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remaining stops */}
      {pending.slice(1).length > 0 && (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-stone-100 dark:border-stone-800">
            <Clock className="h-3.5 w-3.5 text-stone-400 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-wide text-stone-500 dark:text-stone-400">
              Weitere Stopps · {pending.slice(1).length} verbleibend
            </span>
          </div>
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {pending.slice(1, 5).map((stop, idx) => (
              <div
                key={stop.id}
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
                onClick={() => setExpanded(expanded === stop.id ? null : stop.id)}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800 text-[10px] font-black text-stone-600 dark:text-stone-300 shrink-0">
                  {stop.stopp_nr}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-stone-700 dark:text-stone-200 truncate">
                    {stop.adresse}
                  </div>
                  {stop.kunde_name && (
                    <div className="text-[10px] text-stone-400 truncate">{stop.kunde_name}</div>
                  )}
                </div>
                {stop.eta_min != null && (
                  <span className={cn('text-[10px] font-bold tabular-nums shrink-0', etaColor(stop.eta_min))}>
                    {etaLabel(stop.eta_min)}
                  </span>
                )}
                <ChevronRight className={cn(
                  'h-3.5 w-3.5 text-stone-300 dark:text-stone-600 shrink-0 transition-transform',
                  expanded === stop.id ? 'rotate-90' : '',
                )} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed stops */}
      {done.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-matcha-500 shrink-0" />
          <span className="text-[11px] text-stone-400">
            {done.length} Stopp{done.length !== 1 ? 's' : ''} bereits zugestellt
          </span>
        </div>
      )}
    </div>
  );
}
