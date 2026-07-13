'use client';

// Phase 1298 — Schicht-Qualitäts-Report (Kitchen)
// Fehlerquote (Stornos/Beschwerden) + beste/schlechteste Stunde + Empfehlungen
// Props-basiert (keine eigene API) · nach Phase1293 + Phase1295

import { useMemo, useState } from 'react';
import { Award, ChevronDown, ChevronUp, ThumbsDown, ThumbsUp, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderInput {
  id: string;
  status?: string;
  created_at?: string;
  rating?: number;
}

interface Props {
  orders: OrderInput[];
}

function stundeLabel(h: number): string {
  return `${h.toString().padStart(2, '0')}:00`;
}

interface StundenStats {
  stunde: number;
  anzahl: number;
  stornos: number;
  stornoQuote: number;
}

export function KitchenPhase1298SchichtQualitaetsReport({ orders }: Props) {
  const [open, setOpen] = useState(false);

  const stats = useMemo(() => {
    const stundenMap: Record<number, StundenStats> = {};

    let gesamtStornos = 0;

    for (const o of orders) {
      const h = new Date(o.created_at ?? Date.now()).getHours();
      if (!stundenMap[h]) stundenMap[h] = { stunde: h, anzahl: 0, stornos: 0, stornoQuote: 0 };
      stundenMap[h].anzahl++;
      const isCancelled = ['cancelled', 'storniert', 'canceled'].includes(o.status ?? '');
      if (isCancelled) {
        stundenMap[h].stornos++;
        gesamtStornos++;
      }
    }

    const stundenListe = Object.values(stundenMap).map(s => ({
      ...s,
      stornoQuote: s.anzahl > 0 ? +(s.stornos / s.anzahl) * 100 : 0,
    }));

    const gesamtQuote = orders.length > 0 ? +(gesamtStornos / orders.length) * 100 : 0;

    // Beste Stunde = höchste Anzahl, niedrigste Storno-Quote
    const besten = [...stundenListe].sort((a, b) => {
      if (b.anzahl !== a.anzahl) return b.anzahl - a.anzahl;
      return a.stornoQuote - b.stornoQuote;
    });
    const beste = besten[0] ?? null;

    // Schlechteste Stunde = höchste Storno-Quote (min. 2 Bestellungen)
    const kritisch = stundenListe
      .filter(s => s.anzahl >= 2)
      .sort((a, b) => b.stornoQuote - a.stornoQuote);
    const schlechteste = kritisch[0] ?? null;

    // Empfehlungen
    const empfehlungen: string[] = [];
    if (gesamtQuote > 15) empfehlungen.push('Hohe Stornoqoute — Vorbereitung und Kapazität prüfen.');
    if (schlechteste && schlechteste.stornoQuote > 20)
      empfehlungen.push(`Stunde ${stundeLabel(schlechteste.stunde)} besonders kritisch (${schlechteste.stornoQuote.toFixed(0)}% Stornos).`);
    if (orders.length < 5) empfehlungen.push('Geringe Bestellmenge — Auslastung beobachten.');
    if (empfehlungen.length === 0) empfehlungen.push('Qualität im grünen Bereich. Weiter so!');

    return { gesamtQuote, gesamtStornos, stundenListe, beste, schlechteste, empfehlungen };
  }, [orders]);

  const alertKritisch = stats.gesamtQuote > 15;

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 text-white',
          alertKritisch ? 'bg-red-600 dark:bg-red-700' : 'bg-emerald-600 dark:bg-emerald-700',
        )}
      >
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4" />
          <span className="text-sm font-semibold">Schicht-Qualitäts-Report</span>
          <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5">
            Storno {stats.gesamtQuote.toFixed(1)}%
          </span>
          {alertKritisch && (
            <span className="text-[10px] font-bold bg-white/20 rounded-full px-2 py-0.5 animate-pulse">
              KRITISCH
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* Fehlerquote-Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-stone-50 dark:bg-stone-800 p-3 text-center">
              <div className={cn('text-2xl font-black', alertKritisch ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                {stats.gesamtQuote.toFixed(1)}%
              </div>
              <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">Stornoqoute</div>
            </div>
            <div className="rounded-xl bg-stone-50 dark:bg-stone-800 p-3 text-center">
              <div className="text-2xl font-black text-stone-700 dark:text-stone-200">
                {orders.length}
              </div>
              <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
                Bestellungen gesamt
              </div>
            </div>
          </div>

          {/* Beste / Schlechteste Stunde */}
          <div className="grid grid-cols-2 gap-3">
            {stats.beste && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <ThumbsUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">Beste Stunde</span>
                </div>
                <div className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                  {stundeLabel(stats.beste.stunde)}
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                  {stats.beste.anzahl} Bestellungen
                </div>
              </div>
            )}
            {stats.schlechteste && (
              <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <ThumbsDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                  <span className="text-[10px] font-semibold text-red-700 dark:text-red-300">Kritische Stunde</span>
                </div>
                <div className="text-lg font-black text-red-700 dark:text-red-300">
                  {stundeLabel(stats.schlechteste.stunde)}
                </div>
                <div className="text-[10px] text-red-600 dark:text-red-400">
                  {stats.schlechteste.stornoQuote.toFixed(0)}% Stornos
                </div>
              </div>
            )}
          </div>

          {/* Empfehlungen */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
              Empfehlungen
            </div>
            {stats.empfehlungen.map((e, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg bg-stone-50 dark:bg-stone-800 px-3 py-2"
              >
                {alertKritisch && i === 0 ? (
                  <TrendingDown className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                ) : (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                )}
                <span className="text-xs text-stone-700 dark:text-stone-200">{e}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
