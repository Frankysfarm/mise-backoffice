'use client';

/**
 * KitchenKochstartEntscheidung — Smart "Jetzt kochen?" Entscheidungs-Kommando.
 *
 * Zeigt die EINZIGE wichtigste Handlungsempfehlung für die Küche:
 * Welche Bestellung als nächstes started werden soll und WARUM.
 *
 * Farb-Logik:
 *  🔴 ROT   (animate-pulse): Sofort kochen! — Kochstart überfällig
 *  🟠 ORANGE: In ≤3 Min starten — Fahrer kommt bald
 *  🟡 GELB:  In 3–8 Min starten — Vorausplanen
 *  🟢 GRÜN:  Noch Zeit — Alles im Plan
 *
 * Nutzt dieselben Order/Timing-Props wie die anderen Kitchen-Komponenten.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Clock, Flame, Timer, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string;
};

type KitchenTiming = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string | null;
};

type Urgency = 'critical' | 'urgent' | 'soon' | 'ok';

type CookDecision = {
  orderId: string;
  bestellnummer: string;
  kundeName: string;
  urgency: Urgency;
  action: string;
  reason: string;
  elapsedMin: number;
  prepMin: number | null;
  remainSecCook: number | null;
};

function computeDecision(order: Order, timing: KitchenTiming | undefined, now: number): CookDecision {
  const elapsed = order.bestellt_am
    ? Math.floor((now - new Date(order.bestellt_am).getTime()) / 60_000)
    : 0;
  const prepMin = order.geschaetzte_zubereitung_min ?? timing?.prep_min ?? 15;

  let remainSecCook: number | null = null;
  if (timing?.cook_start_at) {
    remainSecCook = Math.round((new Date(timing.cook_start_at).getTime() - now) / 1_000);
  }

  let urgency: Urgency = 'ok';
  let action = 'Noch Zeit';
  let reason = '';

  if (order.status === 'in_zubereitung') {
    if (timing?.ready_target) {
      const remMin = Math.round((new Date(timing.ready_target).getTime() - now) / 60_000);
      if (remMin < 0) {
        urgency = 'critical';
        action = '⚡ Sofort fertig melden!';
        reason = `${Math.abs(remMin)} Min überfällig`;
      } else if (remMin < 3) {
        urgency = 'urgent';
        action = '🔥 Fast fertig — abschließen!';
        reason = `Noch ${remMin} Min`;
      } else {
        urgency = 'soon';
        action = '👨‍🍳 In Zubereitung';
        reason = `Noch ~${remMin} Min`;
      }
    } else {
      const expectedDoneMin = prepMin - elapsed;
      if (expectedDoneMin < 0) {
        urgency = 'critical';
        action = '⚡ Wahrscheinlich fertig — prüfen!';
        reason = 'Keine genaue Zeitangabe, aber sollte fertig sein';
      } else {
        urgency = 'soon';
        action = '👨‍🍳 In Zubereitung';
        reason = `~${expectedDoneMin} Min bis fertig`;
      }
    }
  } else if (order.status === 'bestätigt' || order.status === 'neu') {
    if (remainSecCook !== null && remainSecCook < 0) {
      urgency = 'critical';
      action = '🔴 JETZT KOCHEN!';
      reason = `Kochstart ${Math.abs(Math.floor(remainSecCook / 60))} Min überfällig`;
    } else if (remainSecCook !== null && remainSecCook < 180) {
      urgency = 'urgent';
      action = '🟠 Bald kochen!';
      reason = `Kochstart in ${Math.floor(remainSecCook / 60)}:${String(remainSecCook % 60).padStart(2, '0')} Min`;
    } else if (elapsed > prepMin) {
      urgency = 'critical';
      action = '🔴 SOFORT STARTEN!';
      reason = `Bestellung ${elapsed} Min alt, Zubereitung ${prepMin} Min`;
    } else if (elapsed > prepMin - 3) {
      urgency = 'urgent';
      action = '🟠 Jetzt starten!';
      reason = `${elapsed} von ~${prepMin} Min Vorlauf verstrichen`;
    } else if (elapsed > prepMin - 8) {
      urgency = 'soon';
      action = '🟡 Bald starten';
      reason = `Noch ${prepMin - elapsed} Min Puffer`;
    } else {
      urgency = 'ok';
      action = '🟢 Noch Zeit';
      reason = `${prepMin - elapsed} Min Puffer`;
    }
  }

  return {
    orderId: order.id,
    bestellnummer: order.bestellnummer,
    kundeName: order.kunde_name,
    urgency,
    action,
    reason,
    elapsedMin: elapsed,
    prepMin,
    remainSecCook,
  };
}

const URGENCY_STYLE: Record<Urgency, { bg: string; border: string; text: string; badge: string; pulse: boolean }> = {
  critical: { bg: 'bg-red-50',    border: 'border-red-400',    text: 'text-red-900',    badge: 'bg-red-600 text-white',    pulse: true  },
  urgent:   { bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-900', badge: 'bg-orange-500 text-white', pulse: false },
  soon:     { bg: 'bg-amber-50',  border: 'border-amber-300',  text: 'text-amber-900',  badge: 'bg-amber-400 text-white', pulse: false },
  ok:       { bg: 'bg-matcha-50', border: 'border-matcha-300', text: 'text-matcha-900', badge: 'bg-matcha-600 text-white', pulse: false },
};

export function KitchenKochstartEntscheidung({
  orders,
  timings,
}: {
  orders: Order[];
  timings: KitchenTiming[];
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(iv);
  }, []);

  const active = orders.filter((o) =>
    ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status)
  );

  if (active.length === 0) return null;

  const decisions: CookDecision[] = active
    .map((o) => computeDecision(o, timings.find((t) => t.order_id === o.id), now))
    .sort((a, b) => {
      const priority = { critical: 0, urgent: 1, soon: 2, ok: 3 };
      return priority[a.urgency] - priority[b.urgency];
    });

  const top = decisions[0];
  const style = URGENCY_STYLE[top.urgency];

  const critCount  = decisions.filter((d) => d.urgency === 'critical').length;
  const urgentCount = decisions.filter((d) => d.urgency === 'urgent').length;

  return (
    <div className={cn('rounded-2xl border-2 overflow-hidden shadow-sm', style.border, top.urgency === 'critical' && 'animate-pulse')}>
      {/* Header */}
      <div className={cn('flex items-center gap-2 px-4 py-2.5', style.bg)}>
        <Flame className={cn('h-4 w-4 shrink-0', top.urgency === 'critical' ? 'text-red-600' : top.urgency === 'urgent' ? 'text-orange-500' : 'text-amber-500')} />
        <span className={cn('text-[11px] font-black uppercase tracking-widest', style.text)}>
          Kochstart-Entscheidung · {active.length} aktiv
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {critCount > 0 && (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white">
              {critCount} krit.
            </span>
          )}
          {urgentCount > 0 && (
            <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-black text-white">
              {urgentCount} dringend
            </span>
          )}
        </div>
      </div>

      {/* Top Action — die wichtigste Empfehlung */}
      <div className={cn('px-4 py-4', style.bg)}>
        <div className="flex items-center gap-3">
          <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl font-black border-2', style.border)}>
            {top.urgency === 'critical' ? '🔴' : top.urgency === 'urgent' ? '🟠' : top.urgency === 'soon' ? '🟡' : '🟢'}
          </div>
          <div className="min-w-0 flex-1">
            <div className={cn('font-display text-base font-black leading-tight', style.text)}>
              {top.action}
            </div>
            <div className={cn('text-sm mt-0.5', style.text, 'opacity-80')}>
              #{top.bestellnummer.replace('FF-', '')} · {top.kundeName} · {top.reason}
            </div>
          </div>
        </div>
      </div>

      {/* Queue — alle anderen Bestellungen kompakt */}
      {decisions.length > 1 && (
        <div className="border-t border-current/10 px-4 py-2.5 bg-white/60">
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {decisions.slice(1).map((d) => {
              const s = URGENCY_STYLE[d.urgency];
              return (
                <div
                  key={d.orderId}
                  className={cn(
                    'flex-shrink-0 rounded-xl border px-3 py-2 min-w-[90px]',
                    s.bg, s.border,
                  )}
                >
                  <div className={cn('text-[10px] font-black tabular-nums', s.text)}>
                    #{d.bestellnummer.replace('FF-', '').slice(-4)}
                  </div>
                  <div className={cn('text-[9px] mt-0.5 leading-tight', s.text, 'opacity-80')}>
                    {d.reason.slice(0, 20)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Counts summary */}
      <div className="flex items-center gap-4 border-t border-current/10 px-4 py-2 bg-white/40">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <ChefHat className="h-3 w-3" />
          <span>{active.filter(o => o.status === 'in_zubereitung').length} in Zubereitung</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{active.filter(o => ['neu', 'bestätigt'].includes(o.status)).length} wartend</span>
        </div>
        <div className="ml-auto">
          <span className="text-[9px] text-muted-foreground tabular-nums">
            {new Date(now).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
}
