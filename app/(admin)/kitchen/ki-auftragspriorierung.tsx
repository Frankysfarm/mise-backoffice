'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, Clock, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';

type OrderItem = { name: string; menge: number };

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string;
  items?: OrderItem[];
  typ: string;
};

type Timing = {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type Prioritaet = 'KRITISCH' | 'HOCH' | 'MITTEL' | 'NIEDRIG';

interface ScoredOrder {
  order: Order;
  timing: Timing | undefined;
  score: number;
  prioritaet: Prioritaet;
  secsUntilReady: number | null;
  elapsedMin: number;
}

const ACTIVE_STATUSES = new Set(['neu', 'bestätigt', 'in_zubereitung', 'fertig']);

function computeScore(order: Order, timing: Timing | undefined, now: number): number {
  let score = 0;

  const bestelltMs = order.bestellt_am ? new Date(order.bestellt_am).getTime() : null;
  const elapsedMin = bestelltMs ? (now - bestelltMs) / 60_000 : 0;

  const targetMs = timing?.ready_target
    ? new Date(timing.ready_target).getTime()
    : bestelltMs && order.geschaetzte_zubereitung_min
    ? bestelltMs + order.geschaetzte_zubereitung_min * 60_000
    : null;

  if (bestelltMs && targetMs) {
    const totalMs = targetMs - bestelltMs;
    const elapsedMs = now - bestelltMs;
    const ratio = totalMs > 0 ? Math.min(elapsedMs / totalMs, 2) : 1;
    score += ratio * 40;
  }

  const itemCount = order.items?.reduce((s, i) => s + i.menge, 0) ?? 0;
  score += Math.min(itemCount * 5, 30);

  if (order.typ === 'lieferung') score += 10;
  else if (order.typ === 'abholung') score += 5;

  if (elapsedMin > 20) score += 20;

  return Math.min(Math.round(score), 100);
}

function toPrioritaet(score: number): Prioritaet {
  if (score > 70) return 'KRITISCH';
  if (score > 50) return 'HOCH';
  if (score > 30) return 'MITTEL';
  return 'NIEDRIG';
}

function fmtCountdown(secs: number): string {
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const fmt = `${m}:${String(s).padStart(2, '0')}`;
  return secs < 0 ? `-${fmt}` : fmt;
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score > 70 ? 'bg-red-500' : score >= 40 ? 'bg-amber-400' : 'bg-matcha-500';
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all', color)}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const style =
    rank === 1
      ? 'bg-yellow-400 text-yellow-900'
      : rank === 2
      ? 'bg-gray-300 text-gray-700'
      : rank === 3
      ? 'bg-amber-600 text-amber-50'
      : 'bg-gray-100 text-gray-500';
  return (
    <div
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black',
        style,
      )}
    >
      #{rank}
    </div>
  );
}

function PrioritaetBadge({ p }: { p: Prioritaet }) {
  const style =
    p === 'KRITISCH'
      ? 'bg-red-100 text-red-700 border-red-200'
      : p === 'HOCH'
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : p === 'MITTEL'
      ? 'bg-matcha-50 text-matcha-700 border-matcha-200'
      : 'bg-gray-100 text-gray-500 border-gray-200';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
        style,
      )}
    >
      Priorität: {p}
    </span>
  );
}

function OrderRow({ entry, rank, now }: { entry: ScoredOrder; rank: number; now: number }) {
  const { order, score, prioritaet, secsUntilReady, elapsedMin } = entry;
  const isOverdue = secsUntilReady != null && secsUntilReady < 0;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-all',
        prioritaet === 'KRITISCH'
          ? 'bg-red-50 border-red-200 animate-pulse'
          : prioritaet === 'HOCH'
          ? 'bg-amber-50 border-amber-200'
          : prioritaet === 'MITTEL'
          ? 'bg-matcha-50 border-matcha-200'
          : 'bg-gray-50 border-gray-200',
      )}
    >
      <RankBadge rank={rank} />

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm text-gray-900 truncate">{order.kunde_name}</span>
          <span className="text-[10px] text-gray-400 shrink-0">
            #{order.bestellnummer.slice(-4)}
          </span>
          <PrioritaetBadge p={prioritaet} />
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-gray-400" />
          <span className="text-[10px] text-gray-500 font-medium">KI-Score {score}/100</span>
        </div>
        <ScoreBar score={score} />
      </div>

      <div className="shrink-0 text-right">
        <div
          className={cn(
            'font-mono font-black text-sm tabular-nums',
            isOverdue
              ? 'text-red-600'
              : prioritaet === 'KRITISCH'
              ? 'text-red-500'
              : prioritaet === 'HOCH'
              ? 'text-amber-600'
              : 'text-matcha-700',
          )}
        >
          {secsUntilReady != null ? (
            fmtCountdown(secsUntilReady)
          ) : (
            <span className="text-gray-400">{Math.round(elapsedMin)}m</span>
          )}
        </div>
        <div className="text-[9px] text-gray-400 mt-0.5 uppercase tracking-wide">
          {secsUntilReady != null
            ? isOverdue
              ? 'überfällig'
              : 'bis fertig'
            : 'wartet'}
        </div>
      </div>
    </div>
  );
}

export function KitchenKiAuftragsPriorierung({
  orders,
  timings,
}: {
  orders: Order[];
  timings: Timing[];
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();

  const active = orders.filter(o => ACTIVE_STATUSES.has(o.status));
  if (active.length === 0) return null;

  const scored: ScoredOrder[] = active.map(order => {
    const timing = timings.find(t => t.order_id === order.id);
    const score = computeScore(order, timing, now);
    const prioritaet = toPrioritaet(score);

    const bestelltMs = order.bestellt_am ? new Date(order.bestellt_am).getTime() : null;
    const elapsedMin = bestelltMs ? (now - bestelltMs) / 60_000 : 0;

    const targetMs = timing?.ready_target
      ? new Date(timing.ready_target).getTime()
      : bestelltMs && order.geschaetzte_zubereitung_min
      ? bestelltMs + order.geschaetzte_zubereitung_min * 60_000
      : null;

    const secsUntilReady = targetMs != null ? Math.floor((targetMs - now) / 1000) : null;

    return { order, timing, score, prioritaet, secsUntilReady, elapsedMin };
  });

  scored.sort((a, b) => b.score - a.score);

  const kritischCount = scored.filter(e => e.prioritaet === 'KRITISCH').length;

  return (
    <Card className="overflow-hidden">
      <div
        className={cn(
          'flex items-center gap-2 border-b px-4 py-2.5',
          kritischCount > 0
            ? 'bg-red-50 border-red-200'
            : 'bg-matcha-50 border-matcha-200',
        )}
      >
        <Sparkles
          className={cn(
            'h-4 w-4',
            kritischCount > 0 ? 'text-red-600' : 'text-matcha-600',
          )}
        />
        <span className="text-xs font-bold uppercase tracking-wider text-matcha-700">
          KI-Auftrags-Priorierung
        </span>
        {kritischCount > 0 && (
          <span className="ml-1 rounded-full bg-red-500 text-white px-2 py-0.5 text-[10px] font-black animate-pulse">
            {kritischCount} kritisch
          </span>
        )}
        <Clock className="h-3.5 w-3.5 text-gray-400 ml-auto" />
        <span className="text-[10px] text-gray-400 font-mono tabular-nums">
          {scored.length} aktiv
        </span>
      </div>

      <div className="divide-y divide-gray-100">
        {scored.map((entry, i) => (
          <div key={entry.order.id} className="px-3 py-1.5">
            <OrderRow entry={entry} rank={i + 1} now={now} />
          </div>
        ))}
      </div>
    </Card>
  );
}
