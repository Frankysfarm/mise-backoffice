'use client';

/**
 * OrderUrgencyPanel — Echtzeit-Dringlichkeitsübersicht für die Küche.
 * Zeigt alle aktiven Bestellungen farbkodiert nach Prep-Dringlichkeit:
 * 🔴 Kritisch: Zubereitung überfällig oder Fahrer kommt in <2 Min
 * 🟡 Dringend: Fertig in <5 Min, noch nicht gestartet
 * 🟢 OK: Zubereitung läuft planmäßig
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChefHat, CheckCircle2, Clock, Flame, Zap } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  kunde_name: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  items: { name: string; menge: number }[];
};

type KitchenTiming = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type UrgencyLevel = 'kritisch' | 'dringend' | 'ok' | 'fertig';

interface UrgencyEntry {
  orderId: string;
  bestellnummer: string;
  kundenName: string;
  level: UrgencyLevel;
  secsUntilReady: number | null;
  status: string;
  itemCount: number;
  prepMin: number | null;
}

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

const URGENCY_META: Record<UrgencyLevel, {
  label: string;
  bg: string;
  border: string;
  badge: string;
  icon: React.ElementType;
}> = {
  kritisch: {
    label: 'Kritisch',
    bg: 'bg-red-50',
    border: 'border-red-300',
    badge: 'bg-red-500 text-white',
    icon: Flame,
  },
  dringend: {
    label: 'Dringend',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    badge: 'bg-amber-500 text-white',
    icon: AlertTriangle,
  },
  ok: {
    label: 'Läuft',
    bg: 'bg-matcha-50',
    border: 'border-matcha-200',
    badge: 'bg-matcha-500 text-white',
    icon: ChefHat,
  },
  fertig: {
    label: 'Fertig',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    badge: 'bg-gray-400 text-white',
    icon: CheckCircle2,
  },
};

function fmtSecs(s: number): string {
  const abs = Math.abs(s);
  const m = Math.floor(abs / 60);
  const sec = abs % 60;
  if (s < 0) return `-${m}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function UrgencyRow({ entry }: { entry: UrgencyEntry }) {
  const meta = URGENCY_META[entry.level];
  const Icon = meta.icon;
  const isNegative = (entry.secsUntilReady ?? 0) < 0;

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all',
      meta.bg, meta.border,
      entry.level === 'kritisch' && 'animate-pulse',
    )}>
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', meta.badge)}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-sm text-gray-900 truncate">{entry.kundenName}</span>
          <span className="text-[10px] text-gray-400 shrink-0">#{entry.bestellnummer.slice(-4)}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-gray-500">
            {entry.itemCount} {entry.itemCount === 1 ? 'Artikel' : 'Artikel'}
          </span>
          {entry.prepMin && (
            <span className="text-[10px] text-gray-400">
              · {entry.prepMin} Min Prep
            </span>
          )}
        </div>
      </div>

      <div className="text-right shrink-0">
        {entry.secsUntilReady != null ? (
          <div className={cn(
            'font-mono font-black text-sm tabular-nums',
            isNegative ? 'text-red-600' :
            entry.level === 'dringend' ? 'text-amber-600' :
            'text-matcha-700',
          )}>
            {fmtSecs(entry.secsUntilReady)}
          </div>
        ) : null}
        <div className={cn(
          'text-[9px] font-bold uppercase tracking-wide mt-0.5',
          isNegative ? 'text-red-500' : 'text-gray-400',
        )}>
          {isNegative ? 'Überzogen!' : entry.secsUntilReady != null ? 'bis fertig' : entry.status}
        </div>
      </div>
    </div>
  );
}

export function OrderUrgencyPanel({
  orders,
  timings,
}: {
  orders: Order[];
  timings: KitchenTiming[];
}) {
  useTick();

  const now = Date.now();
  const CRIT_SECS = 120;   // < 2 Min bis fertig oder überfällig
  const WARN_SECS = 5 * 60; // < 5 Min bis fertig

  const entries: UrgencyEntry[] = orders
    .filter(o => ['bestätigt', 'in_zubereitung', 'fertig'].includes(o.status))
    .map((order): UrgencyEntry => {
      const timing = timings.find(t => t.order_id === order.id);
      let secsUntilReady: number | null = null;
      let level: UrgencyLevel = 'ok';

      if (timing?.ready_target) {
        secsUntilReady = Math.floor((new Date(timing.ready_target).getTime() - now) / 1000);
      } else if (order.bestellt_am && order.geschaetzte_zubereitung_min) {
        const targetMs = new Date(order.bestellt_am).getTime() + order.geschaetzte_zubereitung_min * 60_000;
        secsUntilReady = Math.floor((targetMs - now) / 1000);
      }

      if (order.status === 'fertig') {
        level = 'fertig';
      } else if (secsUntilReady != null && secsUntilReady < CRIT_SECS) {
        level = 'kritisch';
      } else if (secsUntilReady != null && secsUntilReady < WARN_SECS) {
        level = 'dringend';
      }

      return {
        orderId: order.id,
        bestellnummer: order.bestellnummer,
        kundenName: order.kunde_name,
        level,
        secsUntilReady,
        status: order.status,
        itemCount: order.items.reduce((s, i) => s + i.menge, 0),
        prepMin: timing?.prep_min ?? order.geschaetzte_zubereitung_min,
      };
    })
    .sort((a, b) => {
      const levelOrder: Record<UrgencyLevel, number> = { kritisch: 0, dringend: 1, ok: 2, fertig: 3 };
      if (levelOrder[a.level] !== levelOrder[b.level]) return levelOrder[a.level] - levelOrder[b.level];
      if (a.secsUntilReady != null && b.secsUntilReady != null) return a.secsUntilReady - b.secsUntilReady;
      return 0;
    });

  const kritischCount = entries.filter(e => e.level === 'kritisch').length;
  const dringendCount = entries.filter(e => e.level === 'dringend').length;

  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5 border-b',
        kritischCount > 0 ? 'bg-red-50 border-red-200' :
        dringendCount > 0 ? 'bg-amber-50 border-amber-200' :
        'bg-gray-50 border-gray-200',
      )}>
        <Zap className={cn(
          'h-4 w-4',
          kritischCount > 0 ? 'text-red-600' :
          dringendCount > 0 ? 'text-amber-600' :
          'text-gray-400',
        )} />
        <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
          Dringlichkeit
        </span>
        {kritischCount > 0 && (
          <span className="ml-1 rounded-full bg-red-500 text-white px-2 py-0.5 text-[10px] font-black animate-pulse">
            {kritischCount} kritisch
          </span>
        )}
        {dringendCount > 0 && (
          <span className="ml-1 rounded-full bg-amber-500 text-white px-2 py-0.5 text-[10px] font-black">
            {dringendCount} dringend
          </span>
        )}
        <Clock className="h-3.5 w-3.5 text-gray-400 ml-auto" />
        <span className="text-[10px] text-gray-400 font-mono tabular-nums">
          {entries.length} aktiv
        </span>
      </div>

      {/* Urgency Rows */}
      <div className="divide-y divide-gray-100">
        {entries.slice(0, 8).map(entry => (
          <div key={entry.orderId} className="px-3 py-1.5">
            <UrgencyRow entry={entry} />
          </div>
        ))}
        {entries.length > 8 && (
          <div className="px-4 py-2 text-center text-[10px] text-gray-400">
            +{entries.length - 8} weitere Bestellungen
          </div>
        )}
      </div>
    </div>
  );
}
