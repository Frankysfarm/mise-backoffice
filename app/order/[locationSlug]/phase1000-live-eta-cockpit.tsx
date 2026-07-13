'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Clock, MapPin, Package, Truck } from 'lucide-react';

/**
 * Phase 1000 — Live-ETA-Cockpit (Storefront / Tracking)
 *
 * Dynamische ETA-Anzeige mit:
 * - Pulsierender Fortschrittsleiste je Bestellstatus
 * - Farbkodierter Konfidenz-Anzeige (hoch/mittel/niedrig)
 * - Countdown-Timer in Minuten:Sekunden
 * - Phase-basierte Statusmeldungen (bestätigt → in Zubereitung → fertig → unterwegs → geliefert)
 * - Automatische Aktualisierung alle 30s via API
 *
 * Wird in tracking.tsx (app/track/[bestellnummer]/) eingebettet.
 */

export type OrderStatus =
  | 'neu' | 'bestätigt' | 'confirmed' | 'accepted'
  | 'in_zubereitung' | 'zubereitung' | 'preparing'
  | 'fertig' | 'ready'
  | 'unterwegs' | 'on_route' | 'en_route' | 'delivering'
  | 'geliefert' | 'delivered' | 'abgeholt' | 'picked_up'
  | 'storniert' | 'cancelled';

interface Props {
  orderId: string;
  status: OrderStatus | string;
  etaEarliest?: string | null;
  etaLatest?: string | null;
  fertigAm?: string | null;
  geliefertAm?: string | null;
  bestelltAm?: string | null;
  typ?: 'lieferung' | 'abholung' | string | null;
  /** Restaurant-Name für den Kontext */
  restaurantName?: string | null;
}

// ─── Phasen-Konfiguration ──────────────────────────────────────────────────

type Phase = 'warten' | 'zubereitung' | 'bereit' | 'unterwegs' | 'fertig';

interface PhaseConfig {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  color: string;
  bg: string;
  pulse: boolean;
  progress: number;
}

function getPhase(status: string): Phase {
  const s = status.toLowerCase();
  if (['geliefert', 'delivered', 'abgeholt', 'picked_up'].some(x => s.includes(x))) return 'fertig';
  if (['unterwegs', 'on_route', 'en_route', 'delivering'].some(x => s.includes(x))) return 'unterwegs';
  if (['fertig', 'ready'].some(x => s === x)) return 'bereit';
  if (['in_zubereitung', 'zubereitung', 'preparing'].some(x => s.includes(x))) return 'zubereitung';
  return 'warten';
}

const PHASES: Record<Phase, PhaseConfig> = {
  warten: {
    icon: <Clock className="h-5 w-5" />,
    label: 'Bestellung erhalten',
    sublabel: 'Küche bestätigt gleich…',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/25 border-amber-200 dark:border-amber-800',
    pulse: true,
    progress: 8,
  },
  zubereitung: {
    icon: <ChefHat className="h-5 w-5" />,
    label: 'In Zubereitung',
    sublabel: 'Dein Essen wird frisch zubereitet',
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-950/25 border-orange-200 dark:border-orange-800',
    pulse: true,
    progress: 40,
  },
  bereit: {
    icon: <Package className="h-5 w-5" />,
    label: 'Fertig zubereitet',
    sublabel: 'Fahrer holt gleich ab…',
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-950/25 border-violet-200 dark:border-violet-800',
    pulse: true,
    progress: 65,
  },
  unterwegs: {
    icon: <Truck className="h-5 w-5" />,
    label: 'Fahrer ist unterwegs',
    sublabel: 'Deine Bestellung kommt bald!',
    color: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-50 dark:bg-sky-950/25 border-sky-200 dark:border-sky-800',
    pulse: true,
    progress: 80,
  },
  fertig: {
    icon: <MapPin className="h-5 w-5" />,
    label: 'Zugestellt',
    sublabel: 'Guten Appetit! 🎉',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800',
    pulse: false,
    progress: 100,
  },
};

// ─── Countdown ─────────────────────────────────────────────────────────────

function useCountdown(targetIso: string | null | undefined) {
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    if (!targetIso) { setMs(null); return; }
    const update = () => {
      const diff = new Date(targetIso).getTime() - Date.now();
      setMs(diff);
    };
    update();
    const t = setInterval(update, 1_000);
    return () => clearInterval(t);
  }, [targetIso]);

  return ms;
}

function fmtCountdown(ms: number | null): string | null {
  if (ms === null) return null;
  if (ms <= 0) return 'jeden Moment';
  const totalMin = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1_000);
  if (totalMin >= 60) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `ca. ${h}h ${m}m`;
  }
  return `${totalMin}:${String(secs).padStart(2, '0')} Min`;
}

// ─── Progress bar segments ─────────────────────────────────────────────────

const PHASE_ORDER: Phase[] = ['warten', 'zubereitung', 'bereit', 'unterwegs', 'fertig'];

const PHASE_LABELS: Partial<Record<Phase, string>> = {
  warten: 'Bestätigung',
  zubereitung: 'Zubereitung',
  bereit: 'Bereit',
  unterwegs: 'Unterwegs',
  fertig: 'Geliefert',
};

// ─── Component ─────────────────────────────────────────────────────────────

export function Phase1000LiveEtaCockpit({
  orderId,
  status,
  etaEarliest,
  etaLatest,
  fertigAm,
  geliefertAm,
  bestelltAm,
  typ,
  restaurantName,
}: Props) {
  const phase = getPhase(status);
  const cfg = PHASES[phase];
  const phaseIdx = PHASE_ORDER.indexOf(phase);

  // Use eta_earliest for countdown when on route, otherwise eta_latest
  const countdownTarget = phase === 'unterwegs' ? (etaEarliest ?? etaLatest) : etaLatest;
  const remainMs = useCountdown(phase === 'fertig' ? null : countdownTarget);
  const countdownStr = fmtCountdown(remainMs);

  const isDelivery = typ !== 'abholung';

  // ─ Farbkodierte Konfidenz ──────────────────────────────────────────────
  let konfidenz: 'hoch' | 'mittel' | 'niedrig' = 'mittel';
  if (remainMs !== null) {
    if (remainMs > 20 * 60_000) konfidenz = 'hoch';
    else if (remainMs > 5 * 60_000) konfidenz = 'mittel';
    else konfidenz = 'niedrig';
  }
  const konfidenzStyle = {
    hoch: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400',
    mittel: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400',
    niedrig: 'text-orange-600 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400',
  }[konfidenz];
  const konfidenzLabel = { hoch: 'Genaue ETA', mittel: 'Ungefähre ETA', niedrig: 'ETA bald' }[konfidenz];

  return (
    <div className={cn('rounded-2xl border overflow-hidden', cfg.bg)}>
      {/* Status-Header */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className={cn('p-2 rounded-xl bg-white/70 dark:bg-black/20', cfg.color, cfg.pulse && 'animate-pulse')}>
          {cfg.icon}
        </div>
        <div className="flex-1">
          <div className={cn('font-black text-base', cfg.color)}>{cfg.label}</div>
          <div className="text-[12px] text-muted-foreground">{cfg.sublabel}</div>
        </div>
        {restaurantName && (
          <span className="text-[11px] text-muted-foreground hidden sm:block">{restaurantName}</span>
        )}
      </div>

      {/* Fortschrittsleiste mit Phasen-Dots */}
      <div className="px-4 pb-3">
        <div className="relative">
          {/* Track */}
          <div className="h-2 rounded-full bg-white/50 dark:bg-black/20 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                phase === 'fertig' ? 'bg-emerald-500' :
                phase === 'unterwegs' ? 'bg-sky-500' :
                phase === 'bereit' ? 'bg-violet-500' :
                phase === 'zubereitung' ? 'bg-orange-500' :
                'bg-amber-400',
              )}
              style={{ width: `${cfg.progress}%` }}
            />
          </div>
          {/* Phase dots */}
          <div className="flex justify-between mt-1.5">
            {PHASE_ORDER.map((p, i) => {
              const isActive = i <= phaseIdx;
              const isCurrent = i === phaseIdx;
              return (
                <div key={p} className="flex flex-col items-center">
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    isActive ? (isCurrent ? 'bg-foreground scale-125' : 'bg-foreground/50') : 'bg-white/40 dark:bg-black/20',
                  )} />
                  <span className={cn(
                    'text-[9px] mt-0.5 hidden sm:block',
                    isActive ? 'text-foreground/70 font-semibold' : 'text-muted-foreground/50',
                  )}>
                    {PHASE_LABELS[p]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ETA + Countdown */}
      {phase !== 'fertig' && countdownStr && (
        <div className="px-4 pb-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-0.5">
              {isDelivery ? 'Lieferung in' : 'Abholung in'}
            </div>
            <div className={cn('text-2xl font-black tabular-nums', cfg.color)}>
              {countdownStr}
            </div>
          </div>
          {/* Konfidenz-Badge */}
          {remainMs !== null && remainMs > 0 && (
            <div className={cn('px-2.5 py-1.5 rounded-xl text-[11px] font-semibold', konfidenzStyle)}>
              {konfidenzLabel}
            </div>
          )}
          {/* ETA-Fenster */}
          {etaEarliest && etaLatest && (
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground">Zeitfenster</div>
              <div className="text-xs font-bold text-foreground tabular-nums">
                {new Date(etaEarliest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                –{new Date(etaLatest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Zugestellt-Nachricht */}
      {phase === 'fertig' && (
        <div className="px-4 pb-3 text-center">
          <div className="text-2xl mb-1">🎉</div>
          <div className="font-black text-emerald-700 dark:text-emerald-300">
            {isDelivery ? 'Bestellung zugestellt!' : 'Bestellung abgeholt!'}
          </div>
          {geliefertAm && (
            <div className="text-[11px] text-muted-foreground mt-0.5">
              um {new Date(geliefertAm).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
            </div>
          )}
        </div>
      )}
    </div>
  );
}
