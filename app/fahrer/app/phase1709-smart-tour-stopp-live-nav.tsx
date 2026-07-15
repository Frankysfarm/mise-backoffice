'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, CheckCircle2, Clock, Navigation2, Package } from 'lucide-react';

interface Stop {
  id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  distanz_zum_vorgaenger_m?: number | null;
  order: {
    id: string;
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    kunde_lat: number | null;
    kunde_lng: number | null;
    gesamtbetrag: number;
    kunde_notiz?: string | null;
    kunde_telefon?: string | null;
  };
}

interface Props {
  stops: Stop[];
  batchId?: string;
  totalEtaMin?: number | null;
  startedAt?: string | null;
  isOnline?: boolean;
}

function openNavi(lat: number | null, lng: number | null, address: string | null) {
  if (!lat || !lng) {
    if (address) window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, '_blank');
    return;
  }
  const ua = navigator.userAgent;
  if (/iPhone|iPad/i.test(ua)) {
    window.open(`maps://maps.apple.com/?daddr=${lat},${lng}`, '_blank');
  } else {
    window.open(`https://maps.google.com/?daddr=${lat},${lng}`, '_blank');
  }
}

export function FahrerPhase1709SmartTourStoppLiveNav({
  stops,
  totalEtaMin,
  startedAt,
  isOnline = true,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const enriched = useMemo(() => {
    const now = Date.now();
    const startMs = startedAt ? new Date(startedAt).getTime() : now;
    const elapsedMin = (now - startMs) / 60_000;
    const perStop = totalEtaMin ? totalEtaMin / Math.max(stops.length, 1) : 10;

    return stops.map((stop, i) => {
      const done = !!stop.geliefert_am;
      const isCurrent = !done && stops.slice(0, i).every((s) => !!s.geliefert_am);
      const doneCount = stops.filter((s, j) => j < i && !!s.geliefert_am).length;
      const estimatedEtaMin = Math.max(0, (i - doneCount + 1) * perStop - (isCurrent ? elapsedMin % perStop : 0));
      const distKm = stop.distanz_zum_vorgaenger_m ? (stop.distanz_zum_vorgaenger_m / 1000).toFixed(1) : null;
      return { ...stop, done, isCurrent, estimatedEtaMin: Math.round(estimatedEtaMin), distKm };
    });
  }, [stops, totalEtaMin, startedAt]);

  if (!isOnline || stops.length === 0) return null;

  const doneCount = enriched.filter((s) => s.done).length;
  const progressPct = stops.length > 0 ? (doneCount / stops.length) * 100 : 0;

  return (
    <div className="rounded-2xl bg-slate-900 text-white overflow-hidden mx-4 mb-3 shadow-lg">
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-bold">Tour-Stopps</span>
          </div>
          <span className="text-[11px] text-slate-400">
            {doneCount}/{stops.length} geliefert
          </span>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 rounded-full bg-slate-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Stop list */}
      <div className="divide-y divide-slate-800">
        {enriched.map((stop, idx) => {
          const isExpanded = expanded === stop.id;
          return (
            <div key={stop.id}>
              <button
                onClick={() => setExpanded(isExpanded ? null : stop.id)}
                className={cn(
                  'w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors',
                  stop.isCurrent
                    ? 'bg-blue-900/50'
                    : stop.done
                    ? 'opacity-50'
                    : '',
                )}
              >
                {/* Number or check */}
                <div
                  className={cn(
                    'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black',
                    stop.done
                      ? 'bg-matcha-600 text-white'
                      : stop.isCurrent
                      ? 'bg-blue-500 text-white animate-pulse'
                      : 'bg-slate-700 text-slate-300',
                  )}
                >
                  {stop.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold truncate">
                      {stop.order.kunde_name}
                    </span>
                    {stop.isCurrent && (
                      <span className="rounded-full bg-blue-500 px-1.5 py-0.5 text-[9px] font-black text-white shrink-0">
                        JETZT
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    #{stop.order.bestellnummer}
                    {stop.distKm ? ` · ${stop.distKm} km` : ''}
                  </div>
                </div>

                {!stop.done && (
                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-1 text-[11px] text-blue-300">
                      <Clock className="h-3 w-3" />
                      <span className="font-mono font-bold tabular-nums">
                        ~{stop.estimatedEtaMin}m
                      </span>
                    </div>
                  </div>
                )}
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-4 pb-3 bg-slate-800/60 space-y-2">
                  {stop.order.kunde_adresse && (
                    <div className="flex items-start gap-2 text-[11px] text-slate-300">
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-slate-400" />
                      <span>{stop.order.kunde_adresse}</span>
                    </div>
                  )}
                  {stop.order.kunde_notiz && (
                    <div className="rounded-lg bg-amber-900/40 border border-amber-700/40 px-2.5 py-1.5 text-[11px] text-amber-200">
                      📝 {stop.order.kunde_notiz}
                    </div>
                  )}
                  {!stop.done && (
                    <button
                      onClick={() =>
                        openNavi(stop.order.kunde_lat, stop.order.kunde_lng, stop.order.kunde_adresse)
                      }
                      className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white transition flex items-center justify-center gap-1.5"
                    >
                      <Navigation2 className="h-3.5 w-3.5" />
                      Navigieren
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
