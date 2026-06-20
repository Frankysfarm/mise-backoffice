'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChefHat, CheckCircle2, Clock, Flame, Zap } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string;
}

interface KitchenTiming {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
}

interface ActionItem {
  id: string;
  bestellnummer: string;
  kundenname: string;
  urgency: 'sofort' | 'bald' | 'ok';
  remainSec: number | null;
  action: string;
  sub: string;
}

function useTick(ms = 1000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
}

function computeActions(orders: Order[], timings: KitchenTiming[], now: number): ActionItem[] {
  const timingMap = new Map(timings.map((t) => [t.order_id, t]));
  const result: ActionItem[] = [];

  for (const o of orders) {
    if (!['neu', 'bestätigt', 'in_zubereitung'].includes(o.status)) continue;
    const t = timingMap.get(o.id);

    if (t?.ready_target) {
      const remainSec = Math.floor((new Date(t.ready_target).getTime() - now) / 1000);
      const urgency: ActionItem['urgency'] =
        remainSec < -60 ? 'sofort' : remainSec < 180 ? 'sofort' : remainSec < 420 ? 'bald' : 'ok';
      const absMin = Math.abs(Math.floor(remainSec / 60));
      const absSec = Math.abs(remainSec % 60);
      const timeStr = `${absMin}:${String(absSec).padStart(2, '0')}`;
      result.push({
        id: o.id,
        bestellnummer: o.bestellnummer,
        kundenname: o.kunde_name,
        urgency,
        remainSec,
        action: remainSec < 0 ? 'ÜBERFÄLLIG' : t.status === 'scheduled' ? 'JETZT KOCHEN' : 'IN ZUBEREITUNG',
        sub: remainSec < 0 ? `${timeStr} überzeit` : `fertig in ${timeStr}`,
      });
    } else if (o.status === 'neu' || o.status === 'bestätigt') {
      const elapsed = o.bestellt_am
        ? Math.floor((now - new Date(o.bestellt_am).getTime()) / 60_000)
        : 0;
      const target = o.geschaetzte_zubereitung_min ?? 20;
      const pct = elapsed / target;
      const urgency: ActionItem['urgency'] = pct >= 0.9 ? 'sofort' : pct >= 0.6 ? 'bald' : 'ok';
      result.push({
        id: o.id,
        bestellnummer: o.bestellnummer,
        kundenname: o.kunde_name,
        urgency,
        remainSec: null,
        action: o.status === 'neu' ? 'ANNEHMEN' : 'KOCHSTART PLANEN',
        sub: `${elapsed} Min seit Bestellung`,
      });
    }
  }

  return result.sort((a, b) => {
    const urgOrder = { sofort: 0, bald: 1, ok: 2 };
    if (urgOrder[a.urgency] !== urgOrder[b.urgency]) return urgOrder[a.urgency] - urgOrder[b.urgency];
    return (a.remainSec ?? 9999) - (b.remainSec ?? 9999);
  });
}

function UrgencyRing({ urgency }: { urgency: ActionItem['urgency'] }) {
  return (
    <div
      className={cn(
        'flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-white',
        urgency === 'sofort' && 'bg-red-500 animate-pulse',
        urgency === 'bald' && 'bg-amber-400',
        urgency === 'ok' && 'bg-emerald-500',
      )}
    >
      {urgency === 'sofort' ? <Flame size={16} /> : urgency === 'bald' ? <Clock size={15} /> : <ChefHat size={15} />}
    </div>
  );
}

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
  maxItems?: number;
}

export function KitchenSchichtSofortCockpit({ orders, timings, maxItems = 5 }: Props) {
  useTick();
  const now = Date.now();
  const actions = computeActions(orders, timings, now).slice(0, maxItems);

  const sofortCount = actions.filter((a) => a.urgency === 'sofort').length;
  const baldCount = actions.filter((a) => a.urgency === 'bald').length;

  if (actions.length === 0) {
    return (
      <div className="rounded-xl border bg-emerald-50 border-emerald-200 px-4 py-5 flex items-center gap-3">
        <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
        <div>
          <div className="text-sm font-bold text-emerald-800">Küche im grünen Bereich</div>
          <div className="text-xs text-emerald-600">Keine dringenden Aktionen erforderlich</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 border-b',
          sofortCount > 0 ? 'bg-red-50 border-red-200' : baldCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white',
        )}
      >
        <Zap size={14} className={cn(sofortCount > 0 ? 'text-red-500' : 'text-matcha-600')} />
        <span className="text-xs font-black uppercase tracking-wider flex-1">Sofort-Cockpit</span>
        <div className="flex items-center gap-1.5">
          {sofortCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-black bg-red-500 text-white rounded-full px-2 py-0.5 animate-pulse">
              <AlertTriangle size={9} />
              {sofortCount} dringend
            </span>
          )}
          {baldCount > 0 && (
            <span className="text-[10px] font-bold bg-amber-400 text-white rounded-full px-2 py-0.5">
              {baldCount} bald
            </span>
          )}
        </div>
      </div>

      {/* Action List */}
      <div className="divide-y divide-border">
        {actions.map((item) => (
          <div
            key={item.id}
            className={cn(
              'flex items-center gap-3 px-4 py-3 transition-colors',
              item.urgency === 'sofort' && 'bg-red-50/60',
              item.urgency === 'bald' && 'bg-amber-50/40',
            )}
          >
            <UrgencyRing urgency={item.urgency} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-foreground tabular-nums">#{item.bestellnummer}</span>
                <span
                  className={cn(
                    'text-[9px] font-black rounded px-1.5 py-0.5 tracking-wide',
                    item.urgency === 'sofort' && 'bg-red-500 text-white',
                    item.urgency === 'bald' && 'bg-amber-400 text-white',
                    item.urgency === 'ok' && 'bg-emerald-500 text-white',
                  )}
                >
                  {item.action}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{item.kundenname}</div>
            </div>

            <div className="text-right shrink-0">
              <span
                className={cn(
                  'text-xs font-black tabular-nums font-mono',
                  item.urgency === 'sofort' ? 'text-red-600' : item.urgency === 'bald' ? 'text-amber-600' : 'text-emerald-600',
                )}
              >
                {item.sub}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
