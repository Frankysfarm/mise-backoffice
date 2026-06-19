'use client';

/**
 * KitchenOptimalKochstart — Phase 300
 *
 * Die EINE klare Antwort auf "Was soll ich jetzt kochen?"
 * Berechnet die dringlichste Bestellung basierend auf:
 * - Fahrer-ETA aus aktiven Batches
 * - Zubereitungszeit (prep_min)
 * - Bestellalter
 * - Bestelltyp (Lieferung hat Vorrang vor Abholung wenn Fahrer wartet)
 *
 * Ampel: 🔴 JETZT starten | 🟡 In X Min starten | 🟢 Noch Zeit
 */

import { useEffect, useState } from 'react';
import { ChefHat, Clock, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  kunde_name: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
}

interface Timing {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
}

interface Batch {
  id: string;
  status: string;
  started_at: string | null;
  total_eta_min: number | null;
  stops?: { order_id: string; geliefert_am: string | null }[];
}

interface Props {
  orders: Order[];
  timings: Timing[];
  batches: Batch[];
}

type Urgency = 'critical' | 'soon' | 'ok' | 'done';

interface CookAction {
  order: Order;
  urgency: Urgency;
  startInMin: number; // negative = overdue
  prepMin: number;
  driverEtaMin: number | null;
}

function calcDriverEta(order: Order, batches: Batch[]): number | null {
  for (const b of batches) {
    if (b.status !== 'unterwegs' && b.status !== 'on_route') continue;
    const stop = b.stops?.find(s => s.order_id === order.id && !s.geliefert_am);
    if (!stop) continue;
    if (!b.started_at || b.total_eta_min == null) continue;
    const endMs = new Date(b.started_at).getTime() + b.total_eta_min * 60_000;
    return Math.max(0, Math.floor((endMs - Date.now()) / 60_000));
  }
  return null;
}

function calcActions(orders: Order[], timings: Timing[], batches: Batch[]): CookAction[] {
  const pending = orders.filter(o => o.status === 'bestätigt');
  return pending.map(order => {
    const timing = timings.find(t => t.order_id === order.id);
    const prepMin = timing?.prep_min ?? order.geschaetzte_zubereitung_min ?? 20;
    const driverEtaMin = order.typ === 'lieferung' ? calcDriverEta(order, batches) : null;
    const orderAgeMin = order.bestellt_am
      ? (Date.now() - new Date(order.bestellt_am).getTime()) / 60_000
      : 0;

    let startInMin: number;
    if (driverEtaMin !== null) {
      // Fahrer kommt in X Minuten — muss jetzt starten wenn driverEta ≤ prepMin + 2
      startInMin = driverEtaMin - prepMin - 2;
    } else {
      // Kein Fahrer: nach 3 Min Wartezeit starten
      startInMin = 3 - orderAgeMin;
    }

    let urgency: Urgency;
    if (timing?.status === 'cooking' || timing?.status === 'ready') {
      urgency = 'done';
    } else if (startInMin <= 0) {
      urgency = 'critical';
    } else if (startInMin <= 5) {
      urgency = 'soon';
    } else {
      urgency = 'ok';
    }

    return { order, urgency, startInMin, prepMin, driverEtaMin };
  })
    .filter(a => a.urgency !== 'done')
    .sort((a, b) => a.startInMin - b.startInMin);
}

const URGENCY_CONFIG = {
  critical: {
    bg: 'bg-red-50 border-red-400',
    badge: 'bg-red-500 text-white',
    icon: <Zap size={16} />,
    label: 'JETZT STARTEN',
    ring: 'ring-2 ring-red-400 ring-offset-2',
    pulse: true,
  },
  soon: {
    bg: 'bg-amber-50 border-amber-400',
    badge: 'bg-amber-500 text-white',
    icon: <Clock size={16} />,
    label: 'BALD STARTEN',
    ring: '',
    pulse: false,
  },
  ok: {
    bg: 'bg-matcha-50 border-matcha-400',
    badge: 'bg-matcha-600 text-white',
    icon: <CheckCircle2 size={16} />,
    label: 'GENUG ZEIT',
    ring: '',
    pulse: false,
  },
};

export function KitchenOptimalKochstart({ orders, timings, batches }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 10_000);
    return () => clearInterval(iv);
  }, []);

  const actions = calcActions(orders, timings, batches);
  if (actions.length === 0) return null;

  const top = actions[0];
  const cfg = URGENCY_CONFIG[top.urgency];
  const startLabel = top.startInMin <= 0
    ? `${Math.abs(Math.round(top.startInMin))} Min überfällig`
    : top.startInMin <= 1
      ? 'sofort'
      : `in ${Math.round(top.startInMin)} Min`;

  return (
    <div className={cn('rounded-xl border-2 p-4 space-y-3', cfg.bg, cfg.ring)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <ChefHat size={15} className="text-muted-foreground" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Optimaler Kochstart
        </span>
        {actions.length > 1 && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            +{actions.length - 1} weitere
          </span>
        )}
      </div>

      {/* Haupt-Aktion */}
      <div className={cn('flex items-start gap-3', cfg.pulse && 'animate-pulse')}>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white', cfg.badge)}>
          {cfg.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-base">#{top.order.bestellnummer}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', cfg.badge)}>
              {cfg.label}
            </span>
          </div>
          <div className="text-sm text-muted-foreground mt-0.5 truncate">{top.order.kunde_name}</div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
            <span>⏱ Kochzeit: <strong>{top.prepMin} Min</strong></span>
            <span>🚀 Kochen: <strong>{startLabel}</strong></span>
            {top.driverEtaMin !== null && (
              <span>🛵 Fahrer: <strong>in {top.driverEtaMin} Min</strong></span>
            )}
          </div>
        </div>
      </div>

      {/* Warteschlange — wenn mehrere */}
      {actions.length > 1 && (
        <div className="border-t border-border pt-2 space-y-1.5">
          {actions.slice(1, 4).map(a => {
            const c = URGENCY_CONFIG[a.urgency];
            return (
              <div key={a.order.id} className="flex items-center gap-2 text-xs">
                <span className={cn('rounded-full w-2 h-2 shrink-0', {
                  'bg-red-500': a.urgency === 'critical',
                  'bg-amber-500': a.urgency === 'soon',
                  'bg-matcha-500': a.urgency === 'ok',
                })} />
                <span className="font-medium">#{a.order.bestellnummer}</span>
                <span className="text-muted-foreground truncate flex-1">{a.order.kunde_name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {a.startInMin <= 0 ? '🔴 jetzt' : a.startInMin <= 5 ? `🟡 ${Math.round(a.startInMin)} Min` : `🟢 ${Math.round(a.startInMin)} Min`}
                </span>
              </div>
            );
          })}
          {actions.length > 4 && (
            <div className="text-[10px] text-muted-foreground text-center">
              +{actions.length - 4} weitere Bestellungen
            </div>
          )}
        </div>
      )}
    </div>
  );
}
