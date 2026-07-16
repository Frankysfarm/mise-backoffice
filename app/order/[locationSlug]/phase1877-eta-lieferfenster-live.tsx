'use client';

/**
 * Phase 1877 — ETA Lieferfenster Live
 * Dynamische Lieferzeit-Fenster-Karte für Kunden: zeigt ein 10-Minuten-Fenster
 * (z.B. "12:30 – 12:40 Uhr") mit Live-Countdown und Konfidenz-Indikator.
 * Polling alle 45 Sekunden gegen /api/delivery/eta/live.
 * Kein Benutzerkonto erforderlich.
 */

import { useEffect, useState } from 'react';
import { Clock, MapPin, CheckCircle2, Truck, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type EtaData = {
  eta_min: number;
  load: 'quiet' | 'normal' | 'busy';
  queue_signal?: string | null;
  confidence?: number | null;
  eta_min_low?: number | null;
  eta_min_high?: number | null;
};

type Props = {
  locationId: string;
  orderedAt: string;
  initialEtaMin?: number | null;
  status?: string;
};

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatCountdown(remainMs: number): string {
  if (remainMs <= 0) return '0 Min';
  const mins = Math.floor(remainMs / 60_000);
  const secs = Math.floor((remainMs % 60_000) / 1000);
  if (mins >= 2) return `${mins} Min`;
  return `${mins}:${String(secs).padStart(2, '0')} Min`;
}

const LOAD_LABEL: Record<string, string> = {
  quiet: 'Küche frei',
  normal: 'Normalbetrieb',
  busy: 'Stoßzeit',
};

export function Phase1877EtaLieferfensterLive({ locationId, orderedAt, initialEtaMin, status }: Props) {
  const [eta, setEta] = useState<EtaData | null>(
    initialEtaMin ? { eta_min: initialEtaMin, load: 'normal' } : null,
  );
  const [now, setNow] = useState(Date.now());
  const [delivered, setDelivered] = useState(status === 'geliefert' || status === 'delivered');

  // Tick every second for the countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);

  // Poll ETA every 45s
  useEffect(() => {
    if (delivered) return;
    const load = () => {
      fetch(`/api/delivery/eta/live?location_id=${locationId}`, { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (d?.eta_min) setEta(d);
          if (d?.status === 'geliefert' || d?.status === 'delivered') setDelivered(true);
        })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 45_000);
    return () => clearInterval(iv);
  }, [locationId, delivered]);

  if (delivered) {
    return (
      <div className="rounded-2xl border-2 border-matcha-400 bg-matcha-50 dark:bg-matcha-950/30 px-5 py-5 text-center">
        <CheckCircle2 className="h-10 w-10 text-matcha-500 mx-auto mb-2" />
        <p className="text-lg font-black text-matcha-700 dark:text-matcha-300">Geliefert!</p>
        <p className="text-sm text-muted-foreground mt-0.5">Guten Appetit!</p>
      </div>
    );
  }

  if (!eta) {
    return (
      <div className="rounded-2xl border border-border bg-card flex items-center gap-3 px-4 py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Lieferzeit wird berechnet…</span>
      </div>
    );
  }

  const orderedMs = new Date(orderedAt).getTime();
  const etaMs = orderedMs + eta.eta_min * 60_000;
  const windowLowMs = orderedMs + ((eta.eta_min_low ?? eta.eta_min - 5)) * 60_000;
  const windowHighMs = orderedMs + ((eta.eta_min_high ?? eta.eta_min + 5)) * 60_000;
  const remainMs = Math.max(0, etaMs - now);
  const progressPct = Math.min(100, ((now - orderedMs) / (etaMs - orderedMs)) * 100);

  const confidence = eta.confidence ?? null;
  const confColor =
    confidence === null
      ? 'text-muted-foreground'
      : confidence >= 0.8
        ? 'text-matcha-600'
        : confidence >= 0.6
          ? 'text-amber-600'
          : 'text-red-500';

  return (
    <div className="rounded-2xl border-2 border-matcha-400 bg-white dark:bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <Truck className="h-5 w-5 text-matcha-500 shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Lieferfenster
          </p>
          <p className="text-xl font-black text-foreground tabular-nums">
            {formatTime(windowLowMs)} – {formatTime(windowHighMs)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground">verbleibend</p>
          <p
            className={cn(
              'text-lg font-black tabular-nums',
              remainMs < 5 * 60_000 ? 'text-matcha-600' : 'text-foreground',
            )}
          >
            {formatCountdown(remainMs)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-1">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-matcha-500 rounded-full transition-all duration-1000"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Footer meta */}
      <div className="flex items-center gap-3 px-4 pt-1.5 pb-3">
        <div
          className={cn(
            'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border',
            eta.load === 'busy'
              ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
              : 'bg-matcha-50 border-matcha-200 text-matcha-700 dark:bg-matcha-950/30 dark:text-matcha-300',
          )}
        >
          <Clock className="h-2.5 w-2.5" />
          {LOAD_LABEL[eta.load] ?? eta.load}
        </div>

        {confidence !== null && (
          <span className={cn('text-[10px] font-bold', confColor)}>
            {Math.round(confidence * 100)}% Konfidenz
          </span>
        )}

        <div className="flex items-center gap-1 ml-auto text-[10px] text-muted-foreground">
          <MapPin className="h-2.5 w-2.5" />
          Live aktualisiert
        </div>
      </div>
    </div>
  );
}
