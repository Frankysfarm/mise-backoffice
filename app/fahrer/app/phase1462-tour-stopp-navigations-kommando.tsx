'use client';

import { useEffect, useState } from 'react';
import { MapPin, Navigation, CheckCircle2, Clock, Phone, ChevronRight, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TourStoppNavigationsStop = {
  id: string;
  sequence: number;
  status: 'pending' | 'active' | 'completed';
  address: string;
  customerName?: string;
  customerPhone?: string;
  etaMin?: number | null;
  notes?: string | null;
  lat?: number | null;
  lng?: number | null;
  orderId?: string;
  orderTotal?: number;
};

export function FahrerPhase1462TourStoppNavigationsKommando({
  stops,
  onStopComplete,
  onNavigate,
}: {
  stops: TourStoppNavigationsStop[];
  onStopComplete?: (stopId: string) => void;
  onNavigate?: (stop: TourStoppNavigationsStop) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const activeStop = stops.find((s) => s.status === 'active');
  const pendingStops = stops.filter((s) => s.status === 'pending').sort((a, b) => a.sequence - b.sequence);
  const completedCount = stops.filter((s) => s.status === 'completed').length;

  useEffect(() => {
    if (activeStop) setExpandedId(activeStop.id);
  }, [activeStop?.id]);

  async function handleComplete(stop: TourStoppNavigationsStop) {
    setCompletingId(stop.id);
    try {
      await new Promise((r) => setTimeout(r, 600));
      onStopComplete?.(stop.id);
    } finally {
      setCompletingId(null);
    }
  }

  function handleNavigate(stop: TourStoppNavigationsStop) {
    if (onNavigate) {
      onNavigate(stop);
      return;
    }
    if (stop.lat && stop.lng) {
      window.open(`https://maps.google.com/?q=${stop.lat},${stop.lng}`, '_blank');
    } else {
      window.open(`https://maps.google.com/?q=${encodeURIComponent(stop.address)}`, '_blank');
    }
  }

  if (stops.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Progress strip */}
      <div className="rounded-xl border bg-card px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-matcha-600" />
            <span className="text-sm font-bold">Tour-Stopps</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {completedCount}/{stops.length} erledigt
          </span>
        </div>
        <div className="flex gap-1">
          {stops.map((s) => (
            <div
              key={s.id}
              className={cn(
                'flex-1 h-2 rounded-sm transition-colors',
                s.status === 'completed' ? 'bg-matcha-500' :
                s.status === 'active' ? 'bg-amber-400 animate-pulse' : 'bg-muted'
              )}
            />
          ))}
        </div>
      </div>

      {/* Active stop — always visible, expanded */}
      {activeStop && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 overflow-hidden">
          <div className="px-4 py-3 bg-amber-400 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <MapPin className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Aktueller Stopp #{activeStop.sequence}</span>
            </div>
            {activeStop.etaMin != null && (
              <div className="flex items-center gap-1 text-white text-xs font-bold">
                <Clock className="h-3.5 w-3.5" />
                {activeStop.etaMin} Min ETA
              </div>
            )}
          </div>
          <div className="px-4 py-3 space-y-3">
            <div>
              <div className="text-base font-bold leading-tight">{activeStop.address}</div>
              {activeStop.customerName && (
                <div className="text-sm text-muted-foreground mt-0.5">{activeStop.customerName}</div>
              )}
              {activeStop.notes && (
                <div className="mt-1 text-xs text-amber-700 bg-amber-100 rounded px-2 py-1">
                  {activeStop.notes}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleNavigate(activeStop)}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-matcha-600 text-white px-3 py-2.5 text-sm font-bold hover:bg-matcha-700 transition"
              >
                <Navigation className="h-4 w-4" />
                Navigation starten
              </button>
              {activeStop.customerPhone && (
                <a
                  href={`tel:${activeStop.customerPhone}`}
                  className="flex items-center justify-center gap-1 rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-bold hover:bg-muted transition"
                >
                  <Phone className="h-4 w-4" />
                </a>
              )}
            </div>

            <button
              onClick={() => handleComplete(activeStop)}
              disabled={!!completingId}
              className={cn(
                'w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold transition',
                completingId === activeStop.id
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-matcha-50 border border-matcha-300 text-matcha-700 hover:bg-matcha-100'
              )}
            >
              <CheckCircle2 className="h-4 w-4" />
              {completingId === activeStop.id ? 'Bestätigen…' : 'Lieferung bestätigen'}
            </button>
          </div>
        </div>
      )}

      {/* Next stops preview */}
      {pendingStops.slice(0, 3).map((stop) => (
        <div
          key={stop.id}
          className="rounded-xl border bg-card overflow-hidden"
        >
          <button
            onClick={() => setExpandedId(expandedId === stop.id ? null : stop.id)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-black text-muted-foreground">
              {stop.sequence}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-sm font-semibold truncate">{stop.address}</div>
              {stop.etaMin != null && (
                <div className="text-[10px] text-muted-foreground">ETA: {stop.etaMin} Min</div>
              )}
            </div>
            <ChevronRight className={cn('h-4 w-4 text-muted-foreground shrink-0 transition-transform', expandedId === stop.id && 'rotate-90')} />
          </button>

          {expandedId === stop.id && (
            <div className="border-t px-4 py-3 space-y-2 bg-muted/20">
              {stop.customerName && (
                <div className="text-sm text-muted-foreground">{stop.customerName}</div>
              )}
              {stop.notes && (
                <div className="text-xs text-amber-700 bg-amber-100 rounded px-2 py-1">{stop.notes}</div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => handleNavigate(stop)}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-matcha-300 text-matcha-700 text-xs font-bold px-3 py-1.5 hover:bg-matcha-50 transition"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Route zeigen
                </button>
                {stop.customerPhone && (
                  <a
                    href={`tel:${stop.customerPhone}`}
                    className="flex items-center gap-1 rounded-lg border border-border text-xs font-bold px-3 py-1.5 hover:bg-muted transition"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Anrufen
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {pendingStops.length > 3 && (
        <div className="text-center text-xs text-muted-foreground py-1">
          + {pendingStops.length - 3} weitere Stopps
        </div>
      )}
    </div>
  );
}
