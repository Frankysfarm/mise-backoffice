'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, MapPin, Bike, CheckCircle2, Package, ChefHat } from 'lucide-react';

/**
 * LiveDeliveryCommand — Dynamische ETA + Live-Tracking für den Kunden
 *
 * Zeigt dem Kunden den aktuellen Lieferstatus mit:
 * - Phase-Anzeige (Küche → Fahrer → Unterwegs → Geliefert)
 * - Live ETA mit Countdown
 * - Fahrer-Annäherungs-Indikator (basierend auf SSE/Polling)
 *
 * Props: orderId, locationId (optional)
 */

type DeliveryPhase =
  | 'preparing'    // Küche bereitet zu
  | 'ready'        // Fertig, warte auf Fahrer
  | 'picked_up'    // Fahrer hat abgeholt
  | 'near'         // Fahrer ist in der Nähe (<5 Min)
  | 'delivered';   // Geliefert

interface PhaseConfig {
  label: string;
  sub: string;
  icon: React.ReactNode;
  color: string;
  border: string;
  bg: string;
  pulse: boolean;
}

const PHASE_CFG: Record<DeliveryPhase, PhaseConfig> = {
  preparing: {
    label: 'Wird zubereitet',
    sub: 'Die Küche arbeitet an deiner Bestellung',
    icon: <ChefHat className="w-6 h-6" />,
    color: 'text-amber-600',
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    pulse: true,
  },
  ready: {
    label: 'Bereit zur Abholung',
    sub: 'Dein Essen ist fertig — Fahrer kommt',
    icon: <Package className="w-6 h-6" />,
    color: 'text-blue-600',
    border: 'border-blue-200',
    bg: 'bg-blue-50',
    pulse: true,
  },
  picked_up: {
    label: 'Fahrer ist unterwegs',
    sub: 'Deine Bestellung ist auf dem Weg',
    icon: <Bike className="w-6 h-6" />,
    color: 'text-saffron',
    border: 'border-saffron/30',
    bg: 'bg-saffron/5',
    pulse: false,
  },
  near: {
    label: 'Fahrer ist in der Nähe!',
    sub: 'Noch wenige Minuten bis zur Lieferung',
    icon: <Bike className="w-6 h-6" />,
    color: 'text-matcha-700',
    border: 'border-matcha-300',
    bg: 'bg-matcha-50',
    pulse: true,
  },
  delivered: {
    label: 'Geliefert!',
    sub: 'Guten Appetit! 🎉',
    icon: <CheckCircle2 className="w-6 h-6" />,
    color: 'text-matcha-700',
    border: 'border-matcha-200',
    bg: 'bg-matcha-50',
    pulse: false,
  },
};

function mapStatus(status: string): DeliveryPhase {
  const s = status.toLowerCase();
  if (['geliefert', 'delivered', 'abgeschlossen'].includes(s)) return 'delivered';
  if (['unterwegs', 'on_route', 'picked_up'].includes(s)) return 'picked_up';
  if (['fertig', 'ready_for_pickup', 'waiting_pickup'].includes(s)) return 'ready';
  return 'preparing';
}

function Steps({ phase }: { phase: DeliveryPhase }) {
  const ORDER: DeliveryPhase[] = ['preparing', 'ready', 'picked_up', 'delivered'];
  const current = ORDER.indexOf(phase === 'near' ? 'picked_up' : phase);
  return (
    <div className="flex items-center gap-0 w-full mt-4">
      {ORDER.map((p, i) => {
        const done = i < current;
        const active = i === current;
        const cfg = PHASE_CFG[p];
        return (
          <div key={p} className="flex items-center flex-1">
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all',
              done ? 'bg-matcha-500 text-white' : active ? 'bg-saffron text-white scale-110 shadow-md' : 'bg-stone-200 text-stone-400',
            )}>
              <span className="text-[10px] font-black">{i + 1}</span>
            </div>
            {i < ORDER.length - 1 && (
              <div className={cn('flex-1 h-1 mx-0.5 rounded-full', done ? 'bg-matcha-400' : 'bg-stone-200')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function LiveDeliveryCommand({
  orderId,
  locationId,
  initialStatus,
  etaLatest,
}: {
  orderId: string;
  locationId?: string | null;
  initialStatus?: string;
  etaLatest?: string | null;
}) {
  const [phase, setPhase] = useState<DeliveryPhase>(mapStatus(initialStatus ?? 'preparing'));
  const [etaMin, setEtaMin] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  // Sekunden-Tick für Countdown
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(iv);
  }, []);

  // ETA berechnen
  useEffect(() => {
    if (!etaLatest) { setEtaMin(null); return; }
    const diff = Math.round((new Date(etaLatest).getTime() - Date.now()) / 60_000);
    setEtaMin(diff);
    if (diff <= 5 && phase === 'picked_up') setPhase('near');
  }, [etaLatest, tick]);

  // Status pollen
  useEffect(() => {
    if (!orderId) return;
    const poll = () => {
      fetch(`/api/delivery/order/${orderId}/status`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d) return;
          const p = mapStatus(d.status ?? '');
          setPhase(p);
          if (d.eta_latest) {
            const diff = Math.round((new Date(d.eta_latest).getTime() - Date.now()) / 60_000);
            setEtaMin(diff);
            if (diff <= 5 && p === 'picked_up') setPhase('near');
          }
        })
        .catch(() => {});
    };
    poll();
    const iv = setInterval(poll, 30_000);
    return () => clearInterval(iv);
  }, [orderId]);

  const cfg = PHASE_CFG[phase];

  if (phase === 'delivered') {
    return (
      <div className={cn('rounded-2xl border p-4 flex items-center gap-3', cfg.bg, cfg.border)}>
        <div className={cn('w-12 h-12 rounded-full flex items-center justify-center', 'bg-matcha-100 text-matcha-700')}>
          {cfg.icon}
        </div>
        <div>
          <div className={cn('font-bold text-base', cfg.color)}>{cfg.label}</div>
          <div className="text-sm text-muted-foreground">{cfg.sub}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl border p-4', cfg.bg, cfg.border)}>
      {/* Status-Icon + Text */}
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center',
          cfg.bg, cfg.color,
          cfg.pulse ? 'animate-pulse' : '',
        )}>
          {cfg.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn('font-bold text-base', cfg.color)}>{cfg.label}</div>
          <div className="text-sm text-muted-foreground">{cfg.sub}</div>
        </div>
        {/* ETA */}
        {etaMin !== null && etaMin > 0 && (
          <div className="shrink-0 text-right">
            <div className={cn(
              'text-2xl font-black tabular-nums',
              etaMin <= 5 ? 'text-matcha-700' : etaMin <= 15 ? 'text-amber-700' : 'text-char',
            )}>
              {etaMin}<span className="text-sm font-bold"> Min</span>
            </div>
            <div className="text-[10px] text-muted-foreground">ETA</div>
          </div>
        )}
        {etaMin !== null && etaMin <= 0 && (
          <div className="shrink-0 text-right">
            <div className="text-lg font-black text-matcha-700">Jetzt</div>
            <div className="text-[10px] text-muted-foreground">ETA</div>
          </div>
        )}
      </div>

      {/* Phasen-Schritte */}
      <Steps phase={phase} />

      {/* Phasen-Labels */}
      <div className="flex justify-between mt-1 px-0.5">
        <span className="text-[9px] text-muted-foreground">Küche</span>
        <span className="text-[9px] text-muted-foreground">Bereit</span>
        <span className="text-[9px] text-muted-foreground">Fahrer</span>
        <span className="text-[9px] text-muted-foreground">Geliefert</span>
      </div>
    </div>
  );
}
