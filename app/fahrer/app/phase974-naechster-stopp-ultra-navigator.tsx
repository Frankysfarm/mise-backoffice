'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, Phone, Clock, CheckCircle2, ChevronRight, AlertCircle, Package } from 'lucide-react';

type Stop = {
  id: string;
  order_id?: string | null;
  adresse?: string | null;
  kundenname?: string | null;
  telefon?: string | null;
  status?: string;
  sequence?: number | null;
  eta_at?: string | null;
  notizen?: string | null;
};

type Props = {
  stops: Stop[];
  currentStopIndex: number;
  driverLat?: number | null;
  driverLng?: number | null;
  onConfirmStop?: (stopId: string) => void;
  onNavigate?: (address: string) => void;
};

function fmtEta(etaAt: string | null | undefined, nowMs: number): { label: string; late: boolean } {
  if (!etaAt) return { label: '—', late: false };
  const etaMs = new Date(etaAt).getTime();
  const diffMin = Math.round((etaMs - nowMs) / 60_000);
  if (diffMin < 0) return { label: `${Math.abs(diffMin)} Min überfällig`, late: true };
  if (diffMin === 0) return { label: 'Jetzt', late: false };
  return { label: `~${diffMin} Min`, late: false };
}

export function FahrerPhase974NaechsterStoppUltraNavigator({
  stops,
  currentStopIndex,
  driverLat: _driverLat,
  driverLng: _driverLng,
  onConfirmStop,
  onNavigate,
}: Props) {
  const [tick, setTick] = useState(0);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const nowMs = Date.now();

  const pendingStops = stops.filter(s => !['geliefert', 'abgeholt', 'abgeschlossen'].includes(s.status ?? ''));
  const current = pendingStops[0] ?? null;
  const next    = pendingStops[1] ?? null;
  const done    = stops.filter(s => ['geliefert', 'abgeholt', 'abgeschlossen'].includes(s.status ?? '')).length;
  const total   = stops.length;

  if (!current) {
    return (
      <div className="rounded-xl border bg-matcha-50 dark:bg-matcha-950/30 p-4 flex items-center gap-3">
        <CheckCircle2 className="h-6 w-6 text-matcha-600 shrink-0" />
        <div>
          <div className="font-bold text-sm text-matcha-900 dark:text-matcha-100">Alle Stopps abgeschlossen!</div>
          <div className="text-xs text-matcha-700 dark:text-matcha-300">Tour erfolgreich beendet.</div>
        </div>
      </div>
    );
  }

  const { label: etaLabel, late: etaLate } = fmtEta(current.eta_at, nowMs);

  async function handleConfirm() {
    if (!onConfirmStop || confirming) return;
    setConfirming(true);
    try {
      await onConfirmStop(current.id);
    } finally {
      setTimeout(() => setConfirming(false), 1500);
    }
  }

  function handleNavigate() {
    if (!current.adresse) return;
    onNavigate?.(current.adresse);
    // Fallback: open maps
    const addr = encodeURIComponent(current.adresse);
    window.open(`https://maps.google.com/maps?q=${addr}`, '_blank');
  }

  return (
    <div className="flex flex-col gap-2" data-fahrer-phase="974">
      {/* Progress strip */}
      <div className="rounded-xl border bg-card px-4 py-2.5 flex items-center gap-3">
        <Package className="h-4 w-4 text-matcha-600 shrink-0" />
        <div className="flex-1">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span className="font-bold">{done} von {total} Stopps</span>
            <span>{total - done} verbleibend</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-matcha-500 rounded-full transition-all duration-700"
              style={{ width: total > 0 ? `${(done / total) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      {/* Current stop — main card */}
      <div className={cn(
        'rounded-xl border-2 bg-card overflow-hidden',
        etaLate ? 'border-red-400' : 'border-matcha-400',
      )}>
        {/* Title bar */}
        <div className={cn(
          'flex items-center gap-2 px-4 py-2 text-white text-xs font-bold',
          etaLate ? 'bg-red-500' : 'bg-matcha-600',
        )}>
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span>Aktueller Stopp — #{(current.sequence ?? (currentStopIndex + 1))}</span>
          <div className={cn(
            'ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black',
            etaLate ? 'bg-red-900/40' : 'bg-matcha-900/30',
          )}>
            <Clock className="h-2.5 w-2.5" />
            {etaLabel}
          </div>
        </div>

        {/* Stop details */}
        <div className="px-4 py-3 space-y-2">
          {/* Customer & address */}
          <div>
            {current.kundenname && (
              <div className="font-bold text-sm leading-tight">{current.kundenname}</div>
            )}
            <div className={cn(
              'text-sm mt-0.5 leading-snug',
              current.adresse ? 'text-foreground' : 'text-muted-foreground italic',
            )}>
              {current.adresse ?? 'Keine Adresse'}
            </div>
            {current.notizen && (
              <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-2 py-1 flex items-start gap-1.5">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                {current.notizen}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-3">
            {/* Navigate */}
            <button
              onClick={handleNavigate}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-bold transition-all"
            >
              <Navigation className="h-4 w-4" />
              Navigation
            </button>

            {/* Call */}
            {current.telefon && (
              <a
                href={`tel:${current.telefon}`}
                className="flex items-center justify-center gap-1 rounded-xl px-3 py-3 bg-muted hover:bg-muted/80 active:scale-95 text-sm font-bold transition-all"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}

            {/* Confirm delivery */}
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-white text-sm font-bold transition-all active:scale-95',
                confirming
                  ? 'bg-matcha-400 cursor-not-allowed'
                  : 'bg-matcha-600 hover:bg-matcha-700',
              )}
            >
              {confirming ? (
                <span className="animate-spin">◌</span>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Abgeliefert
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Next stop preview */}
      {next && (
        <div className="rounded-xl border bg-muted/30 px-4 py-2.5 flex items-center gap-3">
          <div className="shrink-0 rounded-full w-6 h-6 bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground">
            {next.sequence ?? 2}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Nächster Stopp</div>
            <div className="text-xs font-medium truncate">{next.kundenname ?? next.adresse ?? '—'}</div>
            {next.adresse && next.kundenname && (
              <div className="text-[10px] text-muted-foreground truncate">{next.adresse}</div>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      )}
    </div>
  );
}
