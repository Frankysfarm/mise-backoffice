'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, ChefHat, Clock, MapPin, Package, Star } from 'lucide-react';

/**
 * Phase 2200 — Smart ETA Tracking Hub (Storefront)
 *
 * Dynamische ETA + Live-Tracking-Banner für den Kunden nach der Bestellung.
 * Zeigt:
 *   1. Bestellstatus-Fortschrittsleiste (4 Phasen)
 *   2. Dynamische ETA mit Konfidenz-Ampel
 *   3. Fahrer-Nähe-Indikator (wenn unterwegs)
 *   4. Countdown bis Lieferung
 */

type OrderPhase = 'received' | 'preparing' | 'ready' | 'delivering' | 'delivered';

interface TrackingData {
  status: OrderPhase;
  etaMin: number | null;
  etaEarliest: string | null;
  etaLatest: string | null;
  driverName: string | null;
  driverLat: number | null;
  driverLng: number | null;
  customerLat: number | null;
  customerLng: number | null;
  prepStartedAt: string | null;
  estimatedPrepMin: number | null;
}

const PHASE_ORDER: OrderPhase[] = ['received', 'preparing', 'ready', 'delivering', 'delivered'];

const PHASE_CFG: Record<OrderPhase, { label: string; icon: React.ReactNode; sub: string }> = {
  received:   { label: 'Bestellt',     icon: <Package className="h-4 w-4" />,      sub: 'Deine Bestellung wurde empfangen' },
  preparing:  { label: 'Zubereitung',  icon: <ChefHat className="h-4 w-4" />,      sub: 'Die Küche arbeitet an deiner Bestellung' },
  ready:      { label: 'Bereit',       icon: <CheckCircle2 className="h-4 w-4" />, sub: 'Wird gleich abgeholt' },
  delivering: { label: 'Unterwegs',    icon: <Bike className="h-4 w-4" />,         sub: 'Fahrer ist auf dem Weg' },
  delivered:  { label: 'Geliefert',    icon: <Star className="h-4 w-4" />,         sub: 'Guten Appetit! 🎉' },
};

function statusToPhase(status: string): OrderPhase {
  const map: Record<string, OrderPhase> = {
    neu: 'received', bestätigt: 'received', confirmed: 'received', accepted: 'received',
    in_zubereitung: 'preparing', preparing: 'preparing',
    fertig: 'ready', ready: 'ready',
    unterwegs: 'delivering', in_delivery: 'delivering',
    geliefert: 'delivered', delivered: 'delivered',
  };
  return map[status] ?? 'received';
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface Props {
  orderId?: string;
  initialStatus?: string;
  initialEtaMin?: number | null;
  driverName?: string | null;
  driverLat?: number | null;
  driverLng?: number | null;
  customerLat?: number | null;
  customerLng?: number | null;
  estimatedPrepMin?: number | null;
  prepStartedAt?: string | null;
  etaEarliest?: string | null;
  etaLatest?: string | null;
}

export function Phase2200SmartEtaTrackingHub({
  orderId,
  initialStatus = 'neu',
  initialEtaMin,
  driverName,
  driverLat,
  driverLng,
  customerLat,
  customerLng,
  estimatedPrepMin,
  prepStartedAt,
  etaEarliest,
  etaLatest,
}: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  const phase = statusToPhase(initialStatus);
  const phaseIndex = PHASE_ORDER.indexOf(phase);
  const cfg = PHASE_CFG[phase];

  // Compute distance to driver
  const distKm = driverLat && driverLng && customerLat && customerLng
    ? haversineKm(driverLat, driverLng, customerLat, customerLng)
    : null;

  // Compute remaining prep time
  let remainPrepSec: number | null = null;
  if (prepStartedAt && estimatedPrepMin && phase === 'preparing') {
    const endMs = new Date(prepStartedAt).getTime() + estimatedPrepMin * 60_000;
    remainPrepSec = Math.round((endMs - Date.now()) / 1000);
  }

  // ETA from etaEarliest/etaLatest
  let etaMinDynamic: number | null = initialEtaMin ?? null;
  if (etaEarliest && phase !== 'delivered') {
    const etaMs = new Date(etaEarliest).getTime();
    etaMinDynamic = Math.max(0, Math.round((etaMs - Date.now()) / 60_000));
  }

  const etaConfidence: 'high' | 'mid' | 'low' = etaMinDynamic !== null
    ? (etaMinDynamic <= 5 ? 'high' : etaMinDynamic <= 20 ? 'mid' : 'low')
    : 'low';

  const confidenceCls = {
    high: 'text-emerald-600 dark:text-emerald-400',
    mid: 'text-amber-600 dark:text-amber-400',
    low: 'text-muted-foreground',
  }[etaConfidence];

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Status phase strip */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between gap-1">
          {PHASE_ORDER.filter(p => p !== 'delivered').map((p, i) => {
            const isCompleted = i < phaseIndex;
            const isActive = i === phaseIndex;
            const pCfg = PHASE_CFG[p];

            return (
              <div key={p} className="flex-1 flex flex-col items-center gap-1">
                <div className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center transition-all',
                  isCompleted ? 'bg-matcha-500 text-white' : isActive ? 'bg-accent/20 text-accent ring-2 ring-accent' : 'bg-muted text-muted-foreground',
                )}>
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : pCfg.icon}
                </div>
                <span className={cn(
                  'text-[9px] font-bold text-center leading-tight',
                  isActive ? 'text-accent' : isCompleted ? 'text-matcha-600' : 'text-muted-foreground',
                )}>
                  {pCfg.label}
                </span>
              </div>
            );
          })}
        </div>
        {/* Progress connector */}
        <div className="mt-2 relative">
          <div className="h-1 rounded-full bg-muted" />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-matcha-500 transition-all duration-700"
            style={{ width: `${Math.min(100, (phaseIndex / (PHASE_ORDER.length - 2)) * 100)}%` }}
          />
        </div>
      </div>

      {/* Current status info */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
            {cfg.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm">{cfg.label}</div>
            <div className="text-xs text-muted-foreground">{cfg.sub}</div>
          </div>
          {phase !== 'delivered' && etaMinDynamic !== null && (
            <div className="shrink-0 text-right">
              <div className={cn('font-mono text-2xl font-black tabular-nums leading-none', confidenceCls)}>
                {etaMinDynamic}
              </div>
              <div className="text-[9px] text-muted-foreground">Min</div>
            </div>
          )}
          {phase === 'delivered' && (
            <div className="shrink-0">
              <CheckCircle2 className="h-8 w-8 text-matcha-500" />
            </div>
          )}
        </div>
      </div>

      {/* Driver proximity (when delivering) */}
      {phase === 'delivering' && (
        <div className="border-t border-border px-4 py-3 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-matcha-100 dark:bg-matcha-900 flex items-center justify-center shrink-0">
              <Bike className="h-4 w-4 text-matcha-600" />
            </div>
            <div className="flex-1 min-w-0">
              {driverName && (
                <div className="text-sm font-bold">{driverName}</div>
              )}
              {distKm !== null && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {distKm < 1 ? `${Math.round(distKm * 1000)} m entfernt` : `${distKm.toFixed(1)} km entfernt`}
                </div>
              )}
              {distKm === null && driverName && (
                <div className="text-xs text-muted-foreground">Ist auf dem Weg</div>
              )}
            </div>
            {etaMinDynamic !== null && etaMinDynamic <= 5 && (
              <span className="shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold animate-pulse">
                Fast da!
              </span>
            )}
          </div>
        </div>
      )}

      {/* Kitchen countdown (when preparing) */}
      {phase === 'preparing' && remainPrepSec !== null && (
        <div className="border-t border-border px-4 py-3 bg-muted/20">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-matcha-500 transition-all duration-1000"
                  style={{
                    width: estimatedPrepMin
                      ? `${Math.min(100, Math.max(0, ((estimatedPrepMin * 60 - Math.max(0, remainPrepSec)) / (estimatedPrepMin * 60)) * 100))}%`
                      : '50%',
                  }}
                />
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                Wird zubereitet · noch ca. {Math.max(0, Math.ceil(remainPrepSec / 60))} Min
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
