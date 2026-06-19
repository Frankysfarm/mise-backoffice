'use client';

/**
 * KitchenSmartKochstartEmpfehlung — Phase 277
 *
 * Berechnet für alle aktiven Bestellungen, WANN die Küche mit
 * dem Kochen starten muss, damit die Bestellung pünktlich fertig ist –
 * basierend auf Fahrer-ETA aus aktiven Batches + Zubereitungszeit.
 *
 * Ampel-Logik:
 *  🔴 ROT:   Kochen muss JETZT starten (< 2 Min Puffer)
 *  🟡 GELB:  Kochen muss in ≤ 5 Min starten
 *  🟢 GRÜN:  Genug Zeit (> 5 Min)
 *  ⚪ GRAU:  Kein Fahrer zugewiesen / kein ETA
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, ChefHat, CheckCircle2, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string;
  typ?: string;
}

interface Batch {
  id: string;
  status: string;
  started_at?: string | null;
  total_eta_min?: number | null;
  stops?: { order_id: string; reihenfolge: number; geliefert_am?: string | null }[];
}

interface Timing {
  order_id: string;
  prep_started_at?: string | null;
  scheduled_cook_at?: string | null;
  estimated_prep_min?: number | null;
}

interface Props {
  orders: Order[];
  batches: Batch[];
  timings: Timing[];
}

type Urgency = 'critical' | 'soon' | 'ok' | 'no-driver';

interface CookEntry {
  orderId: string;
  bestellnummer: string;
  urgency: Urgency;
  minutesUntilCookDeadline: number | null;
  driverEtaMin: number | null;
  prepMin: number;
}

const URGENCY_CONFIG: Record<Urgency, { label: string; bg: string; border: string; text: string; icon: React.ElementType; pulse: boolean }> = {
  critical:   { label: 'JETZT KOCHEN!', bg: 'bg-red-50',    border: 'border-red-400',   text: 'text-red-700',   icon: AlertTriangle, pulse: true  },
  soon:       { label: 'Bald starten',  bg: 'bg-amber-50',  border: 'border-amber-400', text: 'text-amber-700', icon: Zap,           pulse: false },
  ok:         { label: 'Genug Zeit',    bg: 'bg-emerald-50',border: 'border-emerald-300',text: 'text-emerald-700',icon: CheckCircle2, pulse: false },
  'no-driver':{ label: 'Kein Fahrer',  bg: 'bg-gray-50',   border: 'border-gray-200',  text: 'text-gray-500',  icon: Clock,         pulse: false },
};

const DEFAULT_PREP_MIN = 18;

function computeEntries(orders: Order[], batches: Batch[], timings: Timing[], now: number): CookEntry[] {
  const pending = orders.filter(o => ['bestätigt', 'in_zubereitung'].includes(o.status));

  return pending.map(order => {
    const timing = timings.find(t => t.order_id === order.id);
    const prepMin = timing?.estimated_prep_min ?? DEFAULT_PREP_MIN;

    // Find if this order is in an active batch
    const batch = batches.find(b =>
      b.stops?.some(s => s.order_id === order.id) &&
      ['unterwegs', 'on_route', 'aktiv', 'gestartet'].includes(b.status)
    );

    if (!batch?.started_at || !batch.total_eta_min) {
      return { orderId: order.id, bestellnummer: order.bestellnummer, urgency: 'no-driver' as Urgency, minutesUntilCookDeadline: null, driverEtaMin: null, prepMin };
    }

    const batchStartMs = new Date(batch.started_at).getTime();
    const driverArrivalMs = batchStartMs + batch.total_eta_min * 60_000;
    const driverEtaMin = Math.max(0, Math.round((driverArrivalMs - now) / 60_000));

    // Cook deadline: must start cooking at least `prepMin` minutes before driver arrives
    const cookDeadlineMin = driverEtaMin - prepMin;

    let urgency: Urgency;
    if (cookDeadlineMin <= 0)    urgency = 'critical';
    else if (cookDeadlineMin <= 5) urgency = 'soon';
    else                          urgency = 'ok';

    return {
      orderId: order.id,
      bestellnummer: order.bestellnummer,
      urgency,
      minutesUntilCookDeadline: cookDeadlineMin,
      driverEtaMin,
      prepMin,
    };
  });
}

export function KitchenSmartKochstartEmpfehlung({ orders, batches, timings }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(iv);
  }, []);

  const entries = computeEntries(orders, batches, timings, now);
  const critical = entries.filter(e => e.urgency === 'critical');
  const soon     = entries.filter(e => e.urgency === 'soon');

  // Only render if there's something actionable
  if (critical.length === 0 && soon.length === 0) return null;

  const actionable = [...critical, ...soon];

  return (
    <div className="rounded-xl border overflow-hidden bg-white shadow-sm">
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between px-4 py-2.5 border-b',
        critical.length > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200',
      )}>
        <div className="flex items-center gap-2">
          <ChefHat className={cn('h-4 w-4', critical.length > 0 ? 'text-red-600' : 'text-amber-600')} />
          <span className={cn(
            'text-xs font-black uppercase tracking-wider',
            critical.length > 0 ? 'text-red-800' : 'text-amber-800',
          )}>
            Smart Kochstart-Empfehlung
          </span>
          {critical.length > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">
              {critical.length} KRITISCH
            </span>
          )}
        </div>
        <span className="text-[10px] font-bold text-gray-400">
          {actionable.length} Bestellung{actionable.length !== 1 ? 'en' : ''}
        </span>
      </div>

      {/* Entries */}
      <div className="divide-y divide-gray-50">
        {actionable.map(entry => {
          const cfg = URGENCY_CONFIG[entry.urgency];
          const Icon = cfg.icon;
          return (
            <div
              key={entry.orderId}
              className={cn('flex items-center gap-3 px-4 py-3', cfg.bg, cfg.pulse && 'animate-pulse')}
            >
              <div className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2',
                cfg.border, cfg.bg,
              )}>
                <Icon className={cn('h-4 w-4', cfg.text)} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-gray-900">
                    #{entry.bestellnummer.replace(/^FF-?/, '')}
                  </span>
                  <span className={cn('text-[10px] font-bold rounded-full px-1.5 py-0.5', cfg.bg, cfg.text, 'border', cfg.border)}>
                    {cfg.label}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-[10px] text-gray-500">
                  <span>Zubereitungszeit: ~{entry.prepMin} Min</span>
                  {entry.driverEtaMin !== null && (
                    <span>Fahrer in ~{entry.driverEtaMin} Min</span>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right">
                {entry.minutesUntilCookDeadline !== null ? (
                  entry.minutesUntilCookDeadline <= 0 ? (
                    <div className="text-sm font-black text-red-600">JETZT!</div>
                  ) : (
                    <>
                      <div className={cn('text-lg font-black tabular-nums', cfg.text)}>
                        {entry.minutesUntilCookDeadline}
                      </div>
                      <div className="text-[9px] text-gray-400">Min bis Start</div>
                    </>
                  )
                ) : (
                  <div className="text-xs text-gray-400">—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
