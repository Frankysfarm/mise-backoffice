'use client';

// Phase 1315 — Dynamische ETA Live Ultra (Storefront)
// Countdown + Phasen-Timeline + Konfidenz-Badge · 30-Sek-Polling · Fahrer-Animation

import { useEffect, useState, useCallback } from 'react';
import { Clock, Truck, ChefHat, MapPin, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string;
  orderId?: string | null;
  deliveryZone?: string;
}

type DeliveryPhase = 'küche' | 'fahrer' | 'unterwegs' | 'lieferung';
type Confidence = 'hoch' | 'mittel' | 'niedrig';

interface TrackingData {
  eta_min: number;
  phase: DeliveryPhase;
  confidence: Confidence;
  seconds_remaining?: number;
}

interface PrognoseData {
  gesamt_eta_min: number;
  gesamt_engpass: 'ok' | 'warnung' | 'kritisch';
  zonen?: { zone: string; eta_min: number }[];
}

const MOCK: TrackingData = {
  eta_min: 25,
  phase: 'küche',
  confidence: 'mittel',
  seconds_remaining: 25 * 60,
};

const POLL_MS = 30_000;

const PHASES: { id: DeliveryPhase; label: string; icon: typeof ChefHat }[] = [
  { id: 'küche',    label: 'Küche',    icon: ChefHat },
  { id: 'fahrer',   label: 'Fahrer',   icon: Truck },
  { id: 'unterwegs',label: 'Unterwegs',icon: Truck },
  { id: 'lieferung',label: 'Lieferung',icon: MapPin },
];

const PHASE_ORDER: DeliveryPhase[] = ['küche', 'fahrer', 'unterwegs', 'lieferung'];

const CONFIDENCE_CFG: Record<Confidence, { label: string; bg: string; text: string }> = {
  hoch:    { label: 'hoch',    bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300' },
  mittel:  { label: 'mittel',  bg: 'bg-amber-100 dark:bg-amber-900/40',     text: 'text-amber-700 dark:text-amber-300' },
  niedrig: { label: 'niedrig', bg: 'bg-red-100 dark:bg-red-900/40',          text: 'text-red-700 dark:text-red-300' },
};

function etaColor(eta: number): string {
  if (eta <= 30) return 'text-emerald-600 dark:text-emerald-400';
  if (eta <= 45) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function borderColor(eta: number): string {
  if (eta <= 30) return 'border-emerald-200 dark:border-emerald-700';
  if (eta <= 45) return 'border-amber-200 dark:border-amber-700';
  return 'border-red-200 dark:border-red-700';
}

function bgColor(eta: number): string {
  if (eta <= 30) return 'bg-emerald-50 dark:bg-emerald-900/20';
  if (eta <= 45) return 'bg-amber-50 dark:bg-amber-900/20';
  return 'bg-red-50 dark:bg-red-900/20';
}

function formatCountdown(secondsRemaining: number): string {
  if (secondsRemaining < 0) return '00:00';
  const m = Math.floor(secondsRemaining / 60);
  const s = secondsRemaining % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function StorefrontPhase1315DynamischeEtaLiveUltra({ locationId, orderId, deliveryZone }: Props) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [secsLeft, setSecsLeft] = useState<number | null>(null);

  const loadWithOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/customer-tracking?order_id=${orderId}&location_id=${locationId}`);
      const json: TrackingData = res.ok ? await res.json() : MOCK;
      setData(json);
      setSecsLeft(json.seconds_remaining ?? json.eta_min * 60);
    } catch {
      setData(MOCK);
      setSecsLeft(MOCK.seconds_remaining ?? MOCK.eta_min * 60);
    }
  }, [orderId, locationId]);

  const loadZoneEta = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/admin/liefer-prognose?location_id=${locationId}`);
      const json: PrognoseData = res.ok ? await res.json() : { gesamt_eta_min: 25, gesamt_engpass: 'ok' };
      const zoneEntry = deliveryZone
        ? json.zonen?.find((z) => z.zone.toLowerCase() === deliveryZone.toLowerCase())
        : null;
      const etaMin = zoneEntry?.eta_min ?? json.gesamt_eta_min;
      const confidence: Confidence =
        json.gesamt_engpass === 'ok' ? 'hoch' : json.gesamt_engpass === 'warnung' ? 'mittel' : 'niedrig';
      setData({ eta_min: etaMin, phase: 'küche', confidence, seconds_remaining: etaMin * 60 });
      setSecsLeft(etaMin * 60);
    } catch {
      setData(MOCK);
      setSecsLeft(MOCK.seconds_remaining ?? MOCK.eta_min * 60);
    }
  }, [locationId, deliveryZone]);

  useEffect(() => {
    const load = orderId ? loadWithOrder : loadZoneEta;
    load();
    const poll = setInterval(load, POLL_MS);
    return () => clearInterval(poll);
  }, [loadWithOrder, loadZoneEta, orderId]);

  // Per-second countdown tick
  useEffect(() => {
    if (secsLeft === null) return;
    const tick = setInterval(() => setSecsLeft((s) => (s !== null && s > 0 ? s - 1 : 0)), 1_000);
    return () => clearInterval(tick);
  }, [secsLeft !== null]);

  if (!data) {
    return (
      <div className="flex items-center justify-center py-4 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm">ETA wird geladen…</span>
      </div>
    );
  }

  const phaseIdx = PHASE_ORDER.indexOf(data.phase);
  const confCfg = CONFIDENCE_CFG[data.confidence];
  const isDriverEnRoute = data.phase === 'unterwegs';
  const etaMin = data.eta_min;
  const showCountdown = secsLeft !== null && secsLeft < 30 * 60;

  return (
    <div
      className={cn(
        'rounded-2xl border-2 overflow-hidden',
        borderColor(etaMin),
        bgColor(etaMin),
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Clock className={cn('h-5 w-5', etaColor(etaMin))} />
          <span className="text-sm font-semibold text-foreground">Dynamische ETA Live Ultra</span>
        </div>
        {/* Confidence badge */}
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', confCfg.bg, confCfg.text)}>
          Konfidenz: {confCfg.label}
        </span>
      </div>

      {/* Big ETA display */}
      <div className="px-4 pb-3 flex flex-col items-center text-center">
        <p className={cn('text-6xl font-black tabular-nums leading-none mt-1', etaColor(etaMin))}>
          {showCountdown ? formatCountdown(secsLeft!) : `${etaMin}`}
        </p>
        <p className={cn('text-sm font-medium mt-0.5', etaColor(etaMin))}>
          {showCountdown ? 'MM:SS' : 'Min'}
        </p>
        <p className="mt-2 text-sm text-foreground font-medium">
          {isDriverEnRoute
            ? `Dein Fahrer ist unterwegs – gleich da! 🛵`
            : `Dein Essen ist in ${etaMin} Minuten bei dir!`}
        </p>
      </div>

      {/* Fahrer-unterwegs animation strip */}
      {isDriverEnRoute && (
        <div className="mx-4 mb-3 rounded-lg bg-amber-100 dark:bg-amber-900/30 px-3 py-2 flex items-center gap-2 overflow-hidden relative">
          <Truck className="h-4 w-4 text-amber-600 dark:text-amber-400 animate-bounce shrink-0" />
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap">
            Fahrer unterwegs — ETA wird live aktualisiert
          </span>
          {/* sliding shimmer */}
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />
        </div>
      )}

      {/* Phases timeline */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-0">
          {PHASES.map((ph, idx) => {
            const Icon = ph.icon;
            const isDone = idx < phaseIdx;
            const isActive = idx === phaseIdx;
            const isPending = idx > phaseIdx;

            return (
              <div key={ph.id} className="flex items-center flex-1 min-w-0">
                {/* Node */}
                <div className="flex flex-col items-center shrink-0">
                  <div
                    className={cn(
                      'rounded-full flex items-center justify-center w-9 h-9 transition-all',
                      isDone
                        ? 'bg-emerald-500 text-white'
                        : isActive
                          ? cn('text-white ring-2 ring-offset-2 ring-current', etaColor(etaMin).replace('text-', 'bg-').replace(' dark:text-', ' dark:bg-'))
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : isActive && isDriverEnRoute ? (
                      <Truck className="h-4 w-4 animate-pulse" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-[10px] font-medium mt-0.5 text-center leading-tight',
                      isDone ? 'text-emerald-600 dark:text-emerald-400' : isActive ? etaColor(etaMin) : 'text-muted-foreground',
                    )}
                  >
                    {ph.label}
                  </span>
                </div>

                {/* Connector (not after last) */}
                {idx < PHASES.length - 1 && (
                  <div
                    className={cn(
                      'h-0.5 flex-1 mx-1 rounded-full transition-all',
                      idx < phaseIdx ? 'bg-emerald-400 dark:bg-emerald-600' : 'bg-muted',
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
