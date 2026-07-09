'use client';

import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Navigation2, CheckCircle2, Clock, ChevronRight, AlertCircle, Phone } from 'lucide-react';

/**
 * Phase 915 — Tour Stopp Navigator Pro (Fahrer-App)
 *
 * Kompakter Tour-Stopp-Navigator für die Fahrer-App:
 * - Aktuelle Tour-Stops als Karte
 * - Aktueller Stop hervorgehoben mit ETA
 * - Schnellzugriff Navigation + Anruf
 * - Fortschrittsbalken
 */

interface Stop {
  id: string;
  order_number: string;
  address: string;
  customer_name?: string;
  customer_phone?: string;
  eta_min: number;
  status: 'pending' | 'current' | 'completed';
  position: number;
  notes?: string;
}

interface Props {
  stops?: Stop[];
  onNavigate?: (stop: Stop) => void;
  onCall?: (phone: string) => void;
  onComplete?: (stopId: string) => void;
}

const MOCK_STOPS: Stop[] = [
  {
    id: '1',
    order_number: '#2041',
    address: 'Hauptstraße 12, München',
    customer_name: 'M. Schmidt',
    customer_phone: '+49 89 1234567',
    eta_min: 4,
    status: 'current',
    position: 1,
    notes: 'Klingel 2. OG',
  },
  {
    id: '2',
    order_number: '#2042',
    address: 'Bahnhofstr. 45, München',
    customer_name: 'A. Müller',
    customer_phone: '+49 89 7654321',
    eta_min: 12,
    status: 'pending',
    position: 2,
  },
  {
    id: '3',
    order_number: '#2043',
    address: 'Marienplatz 8, München',
    customer_name: 'T. Weber',
    eta_min: 22,
    status: 'pending',
    position: 3,
  },
];

export function FahrerPhase915TourStoppNavigatorPro({
  stops = MOCK_STOPS,
  onNavigate,
  onCall,
  onComplete,
}: Props) {
  const [localStops, setLocalStops] = useState<Stop[]>(stops);
  const [completingId, setCompletingId] = useState<string | null>(null);

  useEffect(() => {
    setLocalStops(stops.length > 0 ? stops : MOCK_STOPS);
  }, [stops]);

  const currentStop = localStops.find((s) => s.status === 'current');
  const pendingStops = localStops.filter((s) => s.status === 'pending');
  const completedCount = localStops.filter((s) => s.status === 'completed').length;
  const totalCount = localStops.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleComplete = async (stopId: string) => {
    setCompletingId(stopId);
    try {
      await onComplete?.(stopId);
      setLocalStops((prev) =>
        prev.map((s) =>
          s.id === stopId
            ? { ...s, status: 'completed' }
            : s.status === 'pending' && s.position === (prev.find((x) => x.id === stopId)?.position ?? 0) + 1
            ? { ...s, status: 'current' }
            : s,
        ),
      );
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Progress Header */}
      <div className="rounded-xl border border-border bg-background overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Navigation2 className="h-4 w-4 text-matcha-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-foreground">
              Tour Navigator Pro
            </div>
            <div className="text-[10px] text-muted-foreground">
              {completedCount}/{totalCount} Stops abgeschlossen
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-black tabular-nums text-matcha-700 dark:text-matcha-300">
              {progressPct}%
            </div>
          </div>
        </div>
        {/* Progress Bar */}
        <div className="h-1.5 bg-muted">
          <div
            className="h-full bg-matcha-500 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Current Stop */}
      {currentStop && (
        <div className="rounded-xl border-2 border-matcha-400 bg-matcha-50 dark:bg-matcha-950/30 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-matcha-500 text-white">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="text-xs font-bold flex-1">JETZT LIEFERN · {currentStop.order_number}</span>
            <span className="text-xs font-black tabular-nums">~{currentStop.eta_min} Min</span>
          </div>

          <div className="p-4 space-y-3">
            {/* Address */}
            <div>
              <div className="font-bold text-foreground">{currentStop.address}</div>
              {currentStop.customer_name && (
                <div className="text-sm text-muted-foreground">{currentStop.customer_name}</div>
              )}
              {currentStop.notes && (
                <div className="flex items-center gap-1 mt-1 text-xs text-amber-700 dark:text-amber-300">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {currentStop.notes}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => onNavigate?.(currentStop)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-matcha-500 text-white py-2.5 text-sm font-bold hover:bg-matcha-600 transition active:scale-95"
              >
                <Navigation2 className="h-4 w-4" />
                Navigation starten
              </button>
              {currentStop.customer_phone && (
                <button
                  onClick={() => onCall?.(currentStop.customer_phone!)}
                  className="flex items-center justify-center rounded-lg border border-matcha-400 bg-white dark:bg-matcha-950/40 text-matcha-700 dark:text-matcha-300 px-3 py-2.5 hover:bg-matcha-50 transition active:scale-95"
                >
                  <Phone className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Complete button */}
            <button
              onClick={() => handleComplete(currentStop.id)}
              disabled={completingId === currentStop.id}
              className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-matcha-400 bg-white dark:bg-matcha-950/40 text-matcha-700 dark:text-matcha-300 py-2 text-sm font-bold hover:bg-matcha-50 transition active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              Abgeliefert ✓
            </button>
          </div>
        </div>
      )}

      {/* Upcoming Stops */}
      {pendingStops.length > 0 && (
        <div className="rounded-xl border border-border bg-background overflow-hidden">
          <div className="px-4 py-2 border-b">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Nächste Stops ({pendingStops.length})
            </span>
          </div>
          <div className="divide-y divide-border">
            {pendingStops.map((stop, idx) => (
              <div key={stop.id} className="flex items-center gap-3 px-4 py-3">
                <div className="h-6 w-6 rounded-full border-2 border-border flex items-center justify-center text-xs font-black text-muted-foreground shrink-0">
                  {stop.position}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{stop.address}</div>
                  {stop.customer_name && (
                    <div className="text-[10px] text-muted-foreground">{stop.customer_name}</div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-bold tabular-nums text-muted-foreground">
                    ~{stop.eta_min} Min
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All completed */}
      {completedCount === totalCount && totalCount > 0 && (
        <div className="rounded-xl border border-matcha-300 bg-matcha-50 dark:bg-matcha-950/30 p-4 flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-matcha-500 shrink-0" />
          <div>
            <div className="font-bold text-matcha-700 dark:text-matcha-300">Tour abgeschlossen!</div>
            <div className="text-sm text-matcha-600 dark:text-matcha-400">
              Alle {totalCount} Stops erfolgreich geliefert.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
