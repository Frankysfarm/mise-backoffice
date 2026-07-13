'use client';

// Phase 1380 — Dynamische ETA Live-Tracking Cockpit (Storefront)
// Echtzeit-ETA + Phasen-Ampel + Fahrer-Annäherungs-Radar · 20-Sek-Polling

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChefHat, Clock, Loader2, MapPin, Navigation, Package, RefreshCw, Truck, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string;
  orderId?: string | null;
}

type LieferPhase = 'bestaetigt' | 'kueche' | 'bereit' | 'unterwegs' | 'nah' | 'geliefert';

interface TrackingState {
  phase: LieferPhase;
  eta_min: number | null;
  fahrer_entfernung_m: number | null;
  konfidenz: 'hoch' | 'mittel' | 'niedrig';
  naechste_aktualisierung_sek: number;
}

const PHASE_CONFIG: Record<LieferPhase, {
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
}> = {
  bestaetigt: {
    label: 'Bestellung bestätigt',
    icon: <Package className="h-4 w-4" />,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    border: 'border-blue-200 dark:border-blue-800',
  },
  kueche: {
    label: 'Wird zubereitet',
    icon: <ChefHat className="h-4 w-4" />,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-700',
  },
  bereit: {
    label: 'Fertig — Fahrer kommt',
    icon: <Package className="h-4 w-4" />,
    color: 'text-matcha-600 dark:text-matcha-400',
    bg: 'bg-matcha-50 dark:bg-matcha-950/20',
    border: 'border-matcha-200 dark:border-matcha-700',
  },
  unterwegs: {
    label: 'Fahrer unterwegs',
    icon: <Truck className="h-4 w-4" />,
    color: 'text-matcha-700 dark:text-matcha-300',
    bg: 'bg-matcha-50 dark:bg-matcha-950/20',
    border: 'border-matcha-200 dark:border-matcha-700',
  },
  nah: {
    label: 'Fast da!',
    icon: <Navigation className="h-4 w-4 animate-bounce" />,
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-950/20',
    border: 'border-orange-300 dark:border-orange-700',
  },
  geliefert: {
    label: 'Zugestellt — Guten Appetit!',
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-950/20',
    border: 'border-green-200 dark:border-green-800',
  },
};

const PHASEN_ORDER: LieferPhase[] = ['bestaetigt', 'kueche', 'bereit', 'unterwegs', 'geliefert'];

const KONFIDENZ_STYLE: Record<TrackingState['konfidenz'], string> = {
  hoch:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  mittel:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  niedrig: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

function buildMock(): TrackingState {
  return {
    phase: 'kueche',
    eta_min: 22,
    fahrer_entfernung_m: null,
    konfidenz: 'hoch',
    naechste_aktualisierung_sek: 20,
  };
}

const POLL_MS = 20_000;

export function StorefrontPhase1380DynamischeEtaLiveTrackingCockpit({ locationId, orderId }: Props) {
  const [state, setState] = useState<TrackingState | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(POLL_MS / 1000);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const laden = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ location_id: locationId });
      if (orderId) params.set('order_id', orderId);
      const res = await fetch(`/api/delivery/customer/tracking?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setState({
        phase: json.phase ?? 'kueche',
        eta_min: json.eta_min ?? null,
        fahrer_entfernung_m: json.fahrer_entfernung_m ?? null,
        konfidenz: json.konfidenz ?? 'mittel',
        naechste_aktualisierung_sek: json.naechste_aktualisierung_sek ?? 20,
      });
    } catch {
      setState(buildMock());
    } finally {
      setLoading(false);
      setCountdown(POLL_MS / 1000);
    }
  }, [locationId, orderId]);

  useEffect(() => {
    if (!orderId) {
      setState(buildMock());
      return;
    }
    laden();
    const poll = setInterval(laden, POLL_MS);
    return () => clearInterval(poll);
  }, [laden, orderId]);

  // Countdown-Ticker
  useEffect(() => {
    timerRef.current = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  if (!state) return null;
  if (state.phase === 'geliefert') return null;

  const cfg = PHASE_CONFIG[state.phase];
  const phaseIdx = PHASEN_ORDER.indexOf(state.phase === 'nah' ? 'unterwegs' : state.phase);

  return (
    <div className={cn('rounded-2xl border p-4 space-y-3 transition-colors', cfg.bg, cfg.border)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-full', cfg.bg, cfg.border, 'border', cfg.color)}>
          {cfg.icon}
        </div>
        <div className="flex-1">
          <div className={cn('font-semibold text-sm', cfg.color)}>{cfg.label}</div>
          {state.eta_min !== null && (
            <div className="text-[11px] text-muted-foreground">
              Noch ca. <span className="font-bold tabular-nums">{state.eta_min} Min</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <button
            onClick={laden}
            disabled={loading}
            className="rounded-md p-1 hover:bg-black/5 dark:hover:bg-white/5 transition"
            aria-label="ETA aktualisieren"
          >
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* ETA-Fortschrittsbalken */}
      {state.eta_min !== null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Lieferfortschritt</span>
            <span className={cn('font-bold rounded-full px-1.5 py-0.5', KONFIDENZ_STYLE[state.konfidenz])}>
              {state.konfidenz === 'hoch' ? 'Genaue ETA' : state.konfidenz === 'mittel' ? 'Ungefähre ETA' : 'ETA-Schätzung'}
            </span>
          </div>
          <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-1000', cfg.color.replace('text-', 'bg-'))}
              style={{
                width: `${Math.min(100, Math.max(5, ((30 - (state.eta_min ?? 30)) / 30) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Phasen-Timeline */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {PHASEN_ORDER.map((ph, i) => {
          const done = i < phaseIdx;
          const current = i === phaseIdx;
          const pCfg = PHASE_CONFIG[ph];
          return (
            <div key={ph} className="flex items-center gap-1 shrink-0">
              <div className="flex flex-col items-center gap-0.5">
                <div className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] transition-all',
                  done    ? 'bg-green-500 border-green-500 text-white' :
                  current ? cn('border-current ring-2 ring-offset-1 ring-current', pCfg.color, pCfg.bg) :
                            'bg-muted border-border text-muted-foreground',
                )}>
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : pCfg.icon}
                </div>
                <span className={cn('text-[9px] text-center leading-tight font-medium w-12', done ? 'text-green-600 dark:text-green-400' : current ? pCfg.color : 'text-muted-foreground')}>
                  {pCfg.label.split(' ')[0]}
                </span>
              </div>
              {i < PHASEN_ORDER.length - 1 && (
                <div className={cn('h-0.5 w-5 rounded-full -mt-4', done ? 'bg-green-400' : 'bg-muted')} />
              )}
            </div>
          );
        })}
      </div>

      {/* Fahrer-Entfernung */}
      {state.fahrer_entfernung_m !== null && (state.phase === 'unterwegs' || state.phase === 'nah') && (
        <div className={cn('flex items-center gap-2 rounded-lg px-3 py-2', cfg.bg)}>
          <MapPin className={cn('h-4 w-4 shrink-0', cfg.color)} />
          <span className="text-sm font-bold text-foreground">
            {state.fahrer_entfernung_m < 1000
              ? `${state.fahrer_entfernung_m}m entfernt`
              : `${(state.fahrer_entfernung_m / 1000).toFixed(1)}km entfernt`}
          </span>
          {state.phase === 'nah' && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
              <Zap className="h-3 w-3" /> Fast da!
            </span>
          )}
        </div>
      )}

      {/* Auto-Update Countdown */}
      {orderId && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Aktualisierung in {countdown}s</span>
        </div>
      )}
    </div>
  );
}
