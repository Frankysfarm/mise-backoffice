'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Banknote, CreditCard, CheckCircle2, ChevronDown, ChevronUp, Euro } from 'lucide-react';

interface Stop {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    gesamtbetrag: number;
    zahlungsart?: string | null;
    bezahlt?: boolean | null;
  };
}

interface Props {
  stops: Stop[];
}

export function KassenUebersicht({ stops }: Props) {
  const [expanded, setExpanded] = useState(false);

  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const cashStops = sorted.filter(
    (s) =>
      (s.order.zahlungsart === 'bar' || s.order.zahlungsart === 'cash') &&
      !s.order.bezahlt,
  );

  if (cashStops.length === 0) return null;

  const pending = cashStops.filter((s) => !s.geliefert_am);
  const collected = cashStops.filter((s) => !!s.geliefert_am);
  const totalPending = pending.reduce((sum, s) => sum + s.order.gesamtbetrag, 0);
  const totalCollected = collected.reduce((sum, s) => sum + s.order.gesamtbetrag, 0);
  const grandTotal = cashStops.reduce((sum, s) => sum + s.order.gesamtbetrag, 0);

  return (
    <div className="rounded-2xl bg-amber-950/80 border border-amber-500/30 overflow-hidden mx-4">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/30 shrink-0">
          <Banknote className="h-4 w-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-black uppercase tracking-widest text-amber-400">
            Kassen-Übersicht
          </div>
          <div className="text-sm font-bold text-white">
            {pending.length} offen · {grandTotal.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} gesamt
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn(
            'rounded-full px-2 py-0.5 text-xs font-bold',
            pending.length > 0 ? 'bg-amber-500 text-white' : 'bg-matcha-600 text-white',
          )}>
            {pending.length > 0 ? `${totalPending.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} einzukassieren` : 'Alles kassiert'}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-amber-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-amber-400" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-amber-500/20 px-4 pb-4 pt-2 space-y-2">
          {sorted
            .filter((s) => cashStops.some((c) => c.id === s.id))
            .map((stop) => {
              const isDone = !!stop.geliefert_am;
              return (
                <div
                  key={stop.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 border',
                    isDone
                      ? 'bg-matcha-800/40 border-matcha-600/30 opacity-60'
                      : 'bg-amber-900/40 border-amber-500/30',
                  )}
                >
                  <div className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full border text-xs font-black shrink-0',
                    isDone
                      ? 'bg-matcha-600 border-matcha-500 text-white'
                      : 'bg-amber-500/20 border-amber-500/40 text-amber-300',
                  )}>
                    {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : stop.reihenfolge}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white truncate">
                      {stop.order.kunde_name}
                    </div>
                    <div className="text-[10px] text-amber-300/70">#{stop.order.bestellnummer}</div>
                  </div>
                  <div className={cn(
                    'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black shrink-0',
                    isDone
                      ? 'bg-matcha-600/30 text-matcha-300'
                      : 'bg-amber-500 text-white',
                  )}>
                    <Euro className="h-3 w-3" />
                    {stop.order.gesamtbetrag.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              );
            })}

          {/* Summary row */}
          <div className="mt-2 rounded-xl bg-amber-900/50 border border-amber-500/30 px-3 py-2.5 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wide">Gesamt-Kasseninhalt</div>
              <div className="text-xs text-amber-300">
                {collected.length} kassiert · {pending.length} ausstehend
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-black text-amber-400">
                {grandTotal.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </div>
              {totalCollected > 0 && (
                <div className="text-[10px] text-matcha-400 font-bold">
                  {totalCollected.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} bereits kassiert
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
