'use client';

/**
 * Phase 2175 – Tour-Stopp Echtzeit-Navigator
 * Kompakter Navigator mit aktuellem Stopp-Fokus, Fortschritts-Ring,
 * Navigations-CTA und Vorschau der nächsten 2 Stopps.
 */

import { cn } from '@/lib/utils';
import {
  Navigation2, Phone, CheckCircle2, MapPin, Clock, ChevronRight, Package,
} from 'lucide-react';

interface Stop {
  id: string;
  order_id: string | null;
  address: string | null;
  kunde_name: string | null;
  telefon: string | null;
  status: string;
  sort_order: number;
  eta_min?: number | null;
}

interface Props {
  stops: Stop[];
  currentStopIndex: number;
  onNavigate?: (address: string) => void;
  onCall?: (phone: string) => void;
  onConfirmStop?: (stopId: string) => void;
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const fill = total > 0 ? (done / total) * circ : 0;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 56, height: 56 }}>
      <svg width={56} height={56} className="-rotate-90 absolute inset-0">
        <circle cx={28} cy={28} r={r} fill="none" stroke="#e5e7eb" strokeWidth={4} />
        <circle
          cx={28} cy={28} r={r}
          fill="none" stroke="#22c55e" strokeWidth={4}
          strokeDasharray={`${fill} ${circ - fill}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="flex flex-col items-center justify-center">
        <span className="text-sm font-bold text-matcha-800 tabular-nums leading-none">{done}</span>
        <span className="text-xs text-matcha-400 leading-none">/{total}</span>
      </div>
    </div>
  );
}

export function FahrerPhase2175TourStoppEchtzeitNavigator({
  stops,
  currentStopIndex,
  onNavigate,
  onCall,
  onConfirmStop,
}: Props) {
  if (!stops || stops.length === 0) return null;

  const currentStop = stops[currentStopIndex] ?? stops[0];
  const nextStops = stops.slice(currentStopIndex + 1, currentStopIndex + 3);
  const doneCount = stops.filter(s => ['geliefert', 'delivered', 'completed'].includes(s.status)).length;
  const totalCount = stops.length;

  return (
    <div className="rounded-2xl border border-matcha-100 bg-white shadow-sm overflow-hidden">
      {/* Header with progress */}
      <div className="flex items-center gap-3 px-4 py-3 bg-matcha-900 text-white">
        <ProgressRing done={doneCount} total={totalCount} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-matcha-300 mb-0.5">Aktiver Stopp</p>
          <p className="text-base font-semibold leading-tight truncate">
            {currentStop.kunde_name ?? 'Kunde'}
          </p>
          <p className="text-xs text-matcha-400 truncate mt-0.5">
            {currentStop.address ?? 'Adresse nicht verfügbar'}
          </p>
        </div>
        {currentStop.eta_min != null && (
          <div className="flex-shrink-0 text-right">
            <p className="text-2xl font-bold tabular-nums text-emerald-400">{currentStop.eta_min}</p>
            <p className="text-xs text-matcha-400">min</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-3 divide-x divide-matcha-100 border-b border-matcha-100">
        <button
          onClick={() => currentStop.address && onNavigate?.(currentStop.address)}
          className="flex flex-col items-center gap-1.5 py-3 hover:bg-matcha-50 transition-colors"
        >
          <Navigation2 className="h-5 w-5 text-matcha-600" />
          <span className="text-xs font-medium text-matcha-700">Navi</span>
        </button>
        <button
          onClick={() => currentStop.telefon && onCall?.(currentStop.telefon)}
          disabled={!currentStop.telefon}
          className={cn(
            'flex flex-col items-center gap-1.5 py-3 transition-colors',
            currentStop.telefon
              ? 'hover:bg-matcha-50 text-matcha-700'
              : 'opacity-40 cursor-not-allowed text-matcha-400',
          )}
        >
          <Phone className="h-5 w-5" />
          <span className="text-xs font-medium">Anruf</span>
        </button>
        <button
          onClick={() => onConfirmStop?.(currentStop.id)}
          className="flex flex-col items-center gap-1.5 py-3 bg-emerald-50 hover:bg-emerald-100 transition-colors text-emerald-700"
        >
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-xs font-medium">Abliefern</span>
        </button>
      </div>

      {/* Current stop address detail */}
      <div className="px-4 py-3 border-b border-matcha-50">
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-matcha-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-matcha-700 leading-snug">
            {currentStop.address ?? 'Adresse nicht verfügbar'}
          </p>
        </div>
      </div>

      {/* Next stops preview */}
      {nextStops.length > 0 && (
        <div className="px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-matcha-500 uppercase tracking-wide">Nächste Stopps</p>
          {nextStops.map((stop, idx) => (
            <div key={stop.id} className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-matcha-100 flex-shrink-0">
                <span className="text-[10px] font-bold text-matcha-600">{currentStopIndex + idx + 2}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-matcha-700 truncate">
                  {stop.kunde_name ?? 'Kunde'}
                </p>
                <p className="text-xs text-matcha-400 truncate">{stop.address}</p>
              </div>
              <ChevronRight className="h-3 w-3 text-matcha-300 flex-shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* All done state */}
      {doneCount === totalCount && totalCount > 0 && (
        <div className="px-4 py-4 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-matcha-800">Tour abgeschlossen!</p>
          <p className="text-xs text-matcha-500 mt-0.5">Alle {totalCount} Stopps erledigt</p>
        </div>
      )}
    </div>
  );
}
