'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, CheckCircle2, Navigation, Phone, ChevronRight, Clock, Package, AlertCircle } from 'lucide-react';

interface Stop {
  id: string;
  address?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  status?: string | null;
  scheduled_for?: string | null;
  notes?: string | null;
  lat?: number | null;
  lng?: number | null;
  order_id?: string | null;
  items?: { name?: string; quantity?: number }[];
}

interface Props {
  stops?: Stop[];
  currentStopId?: string | null;
  onConfirmStop?: (stopId: string) => void;
  onCallCustomer?: (phone: string) => void;
}

function formatEta(scheduledFor: string | null | undefined): string {
  if (!scheduledFor) return '—';
  const diff = Math.round((new Date(scheduledFor).getTime() - Date.now()) / 60000);
  if (diff < 0) return `${Math.abs(diff)} Min überfällig`;
  if (diff === 0) return 'Jetzt';
  return `in ${diff} Min`;
}

function etaColor(scheduledFor: string | null | undefined): string {
  if (!scheduledFor) return 'text-muted-foreground';
  const diff = Math.round((new Date(scheduledFor).getTime() - Date.now()) / 60000);
  if (diff < 0) return 'text-red-500';
  if (diff < 5) return 'text-orange-500';
  return 'text-matcha-600';
}

function openNavigation(lat: number | null | undefined, lng: number | null | undefined, address: string | null | undefined) {
  if (lat && lng) {
    window.open(`https://maps.google.com/maps?daddr=${lat},${lng}`, '_blank');
  } else if (address) {
    window.open(`https://maps.google.com/maps?q=${encodeURIComponent(address)}`, '_blank');
  }
}

export function FahrerPhase2028SmartTourStoppAbschlussNavigator({
  stops = [],
  currentStopId,
  onConfirmStop,
  onCallCustomer,
}: Props) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const activeStops = stops.filter(s =>
    s.status !== 'delivered' && s.status !== 'completed' && !confirmed.has(s.id),
  );

  const currentStop = currentStopId
    ? activeStops.find(s => s.id === currentStopId) ?? activeStops[0]
    : activeStops[0];

  const nextStops = activeStops.filter(s => s.id !== currentStop?.id).slice(0, 3);

  const handleConfirm = async (stop: Stop) => {
    setConfirming(stop.id);
    try {
      if (onConfirmStop) {
        await onConfirmStop(stop.id);
      } else {
        await fetch('/api/delivery/driver/stop-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stop_id: stop.id, order_id: stop.order_id }),
        }).catch(() => {});
      }
      setConfirmed(prev => new Set([...prev, stop.id]));
    } finally {
      setConfirming(null);
    }
  };

  if (activeStops.length === 0) {
    return (
      <section className="rounded-2xl border border-matcha-200 bg-matcha-50 dark:bg-matcha-900/20 dark:border-matcha-700 p-5 text-center space-y-2">
        <CheckCircle2 className="h-10 w-10 text-matcha-600 mx-auto" />
        <div className="text-sm font-bold text-matcha-800 dark:text-matcha-300">Alle Stopps abgeschlossen!</div>
        <div className="text-xs text-matcha-600 dark:text-matcha-400">Tour fertig · Fahrt zurück zum Depot</div>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      {/* Current stop — big card */}
      {currentStop && (
        <section className="rounded-2xl border-2 border-matcha-400 bg-card overflow-hidden shadow-md">
          <div className="flex items-center gap-2 px-4 py-2 bg-matcha-600 text-white">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="text-xs font-black uppercase tracking-wider flex-1">Aktueller Stopp</span>
            <span className={cn('text-xs font-bold tabular-nums', etaColor(currentStop.scheduled_for))}>
              {formatEta(currentStop.scheduled_for)}
            </span>
          </div>

          <div className="p-4 space-y-3">
            {/* Customer + address */}
            <div>
              <div className="font-bold text-sm">{currentStop.customer_name ?? 'Kunde'}</div>
              <div className="text-xs text-muted-foreground">{currentStop.address ?? 'Adresse nicht verfügbar'}</div>
              {currentStop.notes && (
                <div className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {currentStop.notes}
                </div>
              )}
            </div>

            {/* Items */}
            {currentStop.items && currentStop.items.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {currentStop.items.map((item, i) => (
                  <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">
                    {item.quantity ?? 1}× {item.name}
                  </span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => openNavigation(currentStop.lat, currentStop.lng, currentStop.address)}
                className="flex items-center gap-1.5 rounded-xl bg-blue-500 hover:bg-blue-400 active:bg-blue-600 text-white text-xs font-bold px-3 py-2.5 transition-colors flex-1 justify-center"
              >
                <Navigation className="h-4 w-4" />
                Navigieren
              </button>

              {currentStop.customer_phone && (
                <button
                  onClick={() => onCallCustomer ? onCallCustomer(currentStop.customer_phone!) : (window.location.href = `tel:${currentStop.customer_phone}`)}
                  className="flex items-center gap-1.5 rounded-xl bg-muted hover:bg-muted/70 text-foreground text-xs font-bold px-3 py-2.5 transition-colors"
                >
                  <Phone className="h-4 w-4" />
                </button>
              )}

              <button
                onClick={() => handleConfirm(currentStop)}
                disabled={confirming === currentStop.id}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl text-white text-xs font-black px-4 py-2.5 transition-all flex-1 justify-center',
                  confirming === currentStop.id
                    ? 'bg-matcha-400 opacity-70'
                    : 'bg-matcha-600 hover:bg-matcha-500 active:scale-95',
                )}
              >
                <CheckCircle2 className="h-4 w-4" />
                {confirming === currentStop.id ? 'Bestätigen…' : 'Abgeliefert'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Next stops preview */}
      {nextStops.length > 0 && (
        <section className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/20">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex-1">
              Nächste Stopps ({nextStops.length})
            </span>
            <span className="text-[10px] text-muted-foreground">
              {activeStops.length} gesamt verbleibend
            </span>
          </div>

          <div className="divide-y divide-border">
            {nextStops.map((stop, idx) => (
              <div key={stop.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-black text-muted-foreground">{idx + 2}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{stop.customer_name ?? 'Kunde'}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{stop.address ?? '—'}</div>
                </div>
                <div className="shrink-0 flex items-center gap-1 text-[10px]">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className={etaColor(stop.scheduled_for)}>{formatEta(stop.scheduled_for)}</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
