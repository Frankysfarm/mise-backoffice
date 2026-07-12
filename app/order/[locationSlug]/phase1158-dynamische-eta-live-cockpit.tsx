'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bike, CheckCircle2, ChefHat, Clock, MapPin, Package, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1158 — Dynamische-ETA-Live-Cockpit (Storefront)
// Echtzeit-ETA-Anzeige nach Bestellabgabe: Zubereitungs- + Lieferphase, Fahrer-Annäherung, Countdown

interface Props {
  orderId?: string | null;
  orderStatus?: string | null;
  etaEarliest?: string | null;
  etaLatest?: string | null;
  bestelltAt?: string | null;
  driverLat?: number | null;
  driverLng?: number | null;
  restaurantLat?: number | null;
  restaurantLng?: number | null;
  customerLat?: number | null;
  customerLng?: number | null;
}

type DeliveryPhase = 'warten' | 'zubereitung' | 'abholung' | 'unterwegs' | 'angekommen' | 'geliefert';

const STATUS_TO_PHASE: Record<string, DeliveryPhase> = {
  neu: 'warten',
  new: 'warten',
  pending: 'warten',
  angenommen: 'zubereitung',
  confirmed: 'zubereitung',
  accepted: 'zubereitung',
  cooking: 'zubereitung',
  in_preparation: 'zubereitung',
  in_zubereitung: 'zubereitung',
  fertig: 'abholung',
  ready: 'abholung',
  pickup: 'abholung',
  unterwegs: 'unterwegs',
  on_route: 'unterwegs',
  delivering: 'unterwegs',
  angekommen: 'angekommen',
  arrived: 'angekommen',
  geliefert: 'geliefert',
  delivered: 'geliefert',
};

const PHASE_CONFIG: Record<DeliveryPhase, { label: string; sublabel: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  warten:      { label: 'Bestellung eingegangen',    sublabel: 'Wird von der Küche angenommen…',      icon: Clock,        color: 'text-gray-600',    bg: 'bg-gray-50',    border: 'border-gray-200'   },
  zubereitung: { label: 'In Zubereitung',             sublabel: 'Dein Essen wird frisch zubereitet',   icon: ChefHat,      color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200'  },
  abholung:    { label: 'Bereit zur Abholung',        sublabel: 'Fahrer ist auf dem Weg zum Restaurant',icon: Package,      color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200'   },
  unterwegs:   { label: 'Unterwegs zu dir',           sublabel: 'Deine Lieferung ist unterwegs',       icon: Bike,         color: 'text-matcha-600',  bg: 'bg-matcha-50',  border: 'border-matcha-200' },
  angekommen:  { label: 'Fahrer ist da!',             sublabel: 'Deine Bestellung wird übergeben',     icon: MapPin,       color: 'text-matcha-700',  bg: 'bg-matcha-50',  border: 'border-matcha-300' },
  geliefert:   { label: 'Erfolgreich geliefert!',     sublabel: 'Guten Appetit!',                      icon: CheckCircle2, color: 'text-matcha-700',  bg: 'bg-matcha-50',  border: 'border-matcha-300' },
};

const PHASES_ORDER: DeliveryPhase[] = ['warten', 'zubereitung', 'abholung', 'unterwegs', 'angekommen', 'geliefert'];

function fmtCountdown(ms: number): string {
  if (ms <= 0) return 'Jeden Moment';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 60) return `>${Math.floor(m / 60)} Std`;
  if (m > 0) return `${m} Min ${String(s).padStart(2, '0')} Sek`;
  return `${s} Sek`;
}

export function Phase1158DynamischeEtaLiveCockpit({
  orderId,
  orderStatus,
  etaEarliest,
  etaLatest,
  bestelltAt,
  driverLat,
  driverLng,
  restaurantLat,
  restaurantLng,
  customerLat,
  customerLng,
}: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const phase: DeliveryPhase = useMemo(
    () => STATUS_TO_PHASE[orderStatus ?? ''] ?? 'warten',
    [orderStatus],
  );

  const phaseIdx = PHASES_ORDER.indexOf(phase);

  const etaMs = useMemo(() => {
    const target = etaLatest ?? etaEarliest;
    if (!target) return null;
    return new Date(target).getTime() - Date.now();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etaLatest, etaEarliest, tick]);

  const elapsedMin = useMemo(() => {
    if (!bestelltAt) return null;
    return Math.floor((Date.now() - new Date(bestelltAt).getTime()) / 60_000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bestelltAt, tick]);

  if (!orderStatus || phase === 'warten' && !orderId) return null;

  const cfg = PHASE_CONFIG[phase];
  const Icon = cfg.icon;

  return (
    <div className={cn('rounded-2xl border-2 overflow-hidden shadow-sm', cfg.border, cfg.bg)}>
      {/* Header */}
      <div className={cn('px-4 py-3 flex items-center gap-3', cfg.bg)}>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm', cfg.border, 'border')}>
          <Icon className={cn('h-5 w-5', cfg.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm font-black', cfg.color)}>{cfg.label}</div>
          <div className="text-[11px] text-muted-foreground">{cfg.sublabel}</div>
        </div>
        {phase === 'unterwegs' && (
          <div className="shrink-0 flex items-center gap-1">
            <Zap className="h-3 w-3 text-matcha-500 animate-pulse" />
            <span className="text-[10px] font-bold text-matcha-600">Live</span>
          </div>
        )}
      </div>

      {/* Fortschrittsleiste */}
      <div className="px-4 py-2">
        <div className="flex items-center gap-1">
          {PHASES_ORDER.filter(p => p !== 'angekommen').map((p, i) => {
            const done = PHASES_ORDER.indexOf(p) < phaseIdx;
            const active = p === phase;
            return (
              <div key={p} className="flex-1 flex items-center gap-1">
                <div className={cn(
                  'h-1.5 flex-1 rounded-full transition-all duration-700',
                  done ? 'bg-matcha-500' : active ? 'bg-matcha-400' : 'bg-gray-200',
                  active && 'animate-pulse',
                )} />
                {i < PHASES_ORDER.filter(p => p !== 'angekommen').length - 1 && (
                  <div className={cn('h-2 w-2 rounded-full shrink-0 transition-all duration-700',
                    done ? 'bg-matcha-500' : active ? 'bg-matcha-400 ring-2 ring-matcha-200' : 'bg-gray-200',
                  )} />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[8px] text-muted-foreground">Bestellt</span>
          <span className="text-[8px] text-muted-foreground">Küche</span>
          <span className="text-[8px] text-muted-foreground">Abholung</span>
          <span className="text-[8px] text-muted-foreground">Unterwegs</span>
          <span className="text-[8px] text-matcha-600 font-bold">Geliefert</span>
        </div>
      </div>

      {/* ETA + Infos */}
      <div className="px-4 pb-4 space-y-2">
        {etaMs !== null && phase !== 'geliefert' && (
          <div className={cn('rounded-xl border bg-white/70 px-4 py-3 text-center', cfg.border)}>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
              Voraussichtliche Lieferung in
            </div>
            <div className={cn('text-2xl font-black tabular-nums', cfg.color)}>
              {fmtCountdown(etaMs)}
            </div>
            {etaLatest && (
              <div className="text-[10px] text-muted-foreground mt-0.5">
                bis {new Date(etaLatest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
              </div>
            )}
          </div>
        )}

        {phase === 'geliefert' && (
          <div className="rounded-xl border border-matcha-300 bg-matcha-100 px-4 py-3 text-center">
            <CheckCircle2 className="h-8 w-8 text-matcha-600 mx-auto mb-1" />
            <div className="text-sm font-black text-matcha-800">Danke für deine Bestellung!</div>
            {elapsedMin !== null && (
              <div className="text-[11px] text-matcha-600">Geliefert in {elapsedMin} Minuten</div>
            )}
          </div>
        )}

        {elapsedMin !== null && phase !== 'geliefert' && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            Bestellung vor {elapsedMin} Minuten aufgegeben
          </div>
        )}
      </div>
    </div>
  );
}
