'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Target, Zap, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderWithScore {
  id: string;
  bestellnummer: string;
  dispatch_score: number | null;
  delivery_zone: string | null;
  kunde_adresse: string | null;
  gesamtbetrag: number;
  fertig_am: string | null;
  typ: string;
}

function scoreColor(score: number): { bg: string; text: string; border: string; bar: string } {
  if (score >= 80) return { bg: 'bg-matcha-50', text: 'text-matcha-700', border: 'border-matcha-300', bar: 'bg-matcha-500' };
  if (score >= 60) return { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-300',   bar: 'bg-blue-400'   };
  if (score >= 40) return { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-300',  bar: 'bg-amber-400'  };
  return             { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-300',    bar: 'bg-red-500'    };
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Exzellent';
  if (score >= 60) return 'Gut';
  if (score >= 40) return 'Mittel';
  return 'Niedrig';
}

function waitingMinutes(fertig_am: string | null): number {
  if (!fertig_am) return 0;
  return Math.floor((Date.now() - new Date(fertig_am).getTime()) / 60_000);
}

export function DispatchScoreKompaktPanel({ orders }: { orders: OrderWithScore[] }) {
  const [open, setOpen] = useState(true);

  const lieferOrders = orders.filter(
    (o) => o.typ === 'lieferung' && o.dispatch_score !== null,
  );

  if (lieferOrders.length === 0) return null;

  const sorted = [...lieferOrders].sort(
    (a, b) => (b.dispatch_score ?? 0) - (a.dispatch_score ?? 0),
  );

  const avgScore = Math.round(
    sorted.reduce((s, o) => s + (o.dispatch_score ?? 0), 0) / sorted.length,
  );

  const excellent = sorted.filter((o) => (o.dispatch_score ?? 0) >= 80).length;
  const lowScore  = sorted.filter((o) => (o.dispatch_score ?? 0) < 40).length;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/30 transition"
      >
        <Target className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
        <span className="text-[11px] font-black uppercase tracking-wider text-foreground">
          Dispatch-Score · {lieferOrders.length} Bestellungen
        </span>

        <div className="ml-auto flex items-center gap-2">
          {lowScore > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-black text-red-700">
              {lowScore} niedrig
            </span>
          )}
          <span className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-black',
            scoreColor(avgScore).bg, scoreColor(avgScore).text, 'border', scoreColor(avgScore).border,
          )}>
            Ø {avgScore}
          </span>
          {open
            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t">
          {/* Score Distribution Bar */}
          <div className="px-4 py-2 flex items-center gap-1">
            {(['excellent', 'good', 'medium', 'low'] as const).map((tier) => {
              const count = sorted.filter((o) => {
                const s = o.dispatch_score ?? 0;
                if (tier === 'excellent') return s >= 80;
                if (tier === 'good')      return s >= 60 && s < 80;
                if (tier === 'medium')    return s >= 40 && s < 60;
                return s < 40;
              }).length;
              if (count === 0) return null;
              const colors = {
                excellent: 'bg-matcha-500',
                good:      'bg-blue-400',
                medium:    'bg-amber-400',
                low:       'bg-red-500',
              };
              const labels = {
                excellent: 'Exzellent',
                good:      'Gut',
                medium:    'Mittel',
                low:       'Niedrig',
              };
              return (
                <div
                  key={tier}
                  className={cn('flex-1 h-1.5 rounded-full', colors[tier])}
                  title={`${labels[tier]}: ${count}`}
                />
              );
            })}
          </div>

          {/* Order list */}
          <div className="divide-y divide-border/40 max-h-64 overflow-y-auto">
            {sorted.map((order) => {
              const score = order.dispatch_score ?? 0;
              const c = scoreColor(score);
              const waitMin = waitingMinutes(order.fertig_am);
              return (
                <div
                  key={order.id}
                  className={cn('flex items-center gap-3 px-4 py-2', c.bg)}
                >
                  {/* Score ring */}
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 font-mono text-[12px] font-black',
                      c.text, c.border,
                    )}
                  >
                    {score}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] font-black text-foreground">
                        #{order.bestellnummer.slice(-4)}
                      </span>
                      {order.delivery_zone && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                          Zone {order.delivery_zone}
                        </span>
                      )}
                      {waitMin >= 5 && (
                        <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-600">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {waitMin}m
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {order.kunde_adresse ?? '—'}
                    </div>
                  </div>

                  {/* Score bar + label */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', c.bar)}
                        style={{ width: `${Math.min(100, score)}%` }}
                      />
                    </div>
                    <span className={cn('text-[9px] font-black', c.text)}>
                      {scoreLabel(score)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer summary */}
          <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/20">
            <span className="text-[9px] text-muted-foreground font-semibold">
              {excellent} exzellent · Ø Score {avgScore}
            </span>
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-matcha-600" />
              <span className="text-[9px] text-matcha-600 font-bold">Höchster Score zuerst zuweisen</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
