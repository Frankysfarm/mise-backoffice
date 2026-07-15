'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart2, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 1748 — Bestellfrequenz-Prognose-Widget (Kitchen)
 *
 * Vorhergesagte Bestellanzahl nächste 30/60/90 Min basierend
 * auf historischen Mustern + aktueller Rate; Balkendiagramm;
 * useMemo; Props orders; Collapsible.
 */

interface Order {
  id: string;
  status?: string;
  createdAt?: string;
  created_at?: string;
  [key: string]: unknown;
}

interface Props {
  orders: Order[];
  ziel_pro_h?: number;
}

interface Zeitfenster {
  label: string;
  minuten: number;
  prognose: number;
  aktuell: number;
  trend: 'steigend' | 'fallend' | 'stabil';
}

export function KitchenPhase1748BestellfrequenzPrognoseWidget({ orders, ziel_pro_h = 20 }: Props) {
  const [open, setOpen] = useState(false);

  const { fenster, rateProH, gesamtHeute } = useMemo(() => {
    const now = Date.now();
    const bestellzeiten = orders
      .map(o => new Date(o.createdAt ?? o.created_at ?? '').getTime())
      .filter(t => !isNaN(t) && t > 0);

    const letzte30 = bestellzeiten.filter(t => now - t <= 30 * 60_000).length;
    const letzte60 = bestellzeiten.filter(t => now - t <= 60 * 60_000).length;
    const letzte90 = bestellzeiten.filter(t => now - t <= 90 * 60_000).length;
    const letzte120 = bestellzeiten.filter(t => now - t <= 120 * 60_000).length;

    const rateProH = letzte60 * 1;
    const gesamtHeute = bestellzeiten.filter(t => {
      const d = new Date(t);
      const h = new Date();
      return d.toDateString() === h.toDateString();
    }).length;

    const projectRate = (minuten: number): number => {
      const baseRate = letzte30 / 30;
      const historicMod = minuten > 60 ? 0.9 : 1.0;
      return Math.round(baseRate * minuten * historicMod);
    };

    const calcTrend = (recent: number, older: number): 'steigend' | 'fallend' | 'stabil' => {
      const delta = recent - older;
      if (delta > 2) return 'steigend';
      if (delta < -2) return 'fallend';
      return 'stabil';
    };

    const fenster: Zeitfenster[] = [
      {
        label: 'Nächste 30 Min',
        minuten: 30,
        prognose: projectRate(30),
        aktuell: letzte30,
        trend: calcTrend(letzte30, bestellzeiten.filter(t => now - t > 30 * 60_000 && now - t <= 60 * 60_000).length),
      },
      {
        label: 'Nächste 60 Min',
        minuten: 60,
        prognose: projectRate(60),
        aktuell: letzte60,
        trend: calcTrend(letzte60, letzte120 - letzte60),
      },
      {
        label: 'Nächste 90 Min',
        minuten: 90,
        prognose: projectRate(90),
        aktuell: letzte90,
        trend: calcTrend(letzte60, bestellzeiten.filter(t => now - t > 60 * 60_000 && now - t <= 120 * 60_000).length),
      },
    ];

    return { fenster, rateProH, gesamtHeute };
  }, [orders]);

  const zielPro30 = Math.round(ziel_pro_h / 2);
  const naechste30 = fenster[0]?.prognose ?? 0;
  const auslastung = ziel_pro_h > 0 ? naechste30 / zielPro30 : 0;
  const auslastungAmpel =
    auslastung >= 1.2 ? 'rot' :
    auslastung >= 0.8 ? 'gelb' :
    'gruen';

  const ampelColor = {
    gruen: 'bg-emerald-50 border-emerald-200',
    gelb:  'bg-amber-50 border-amber-200',
    rot:   'bg-red-50 border-red-200',
  }[auslastungAmpel];

  const maxBar = Math.max(...fenster.map(f => Math.max(f.prognose, f.aktuell)), 1);

  return (
    <div className={cn('mx-4 mb-3 rounded-xl border overflow-hidden', ampelColor)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="text-sm font-bold text-char">Bestellfrequenz-Prognose</span>
          <span className={cn(
            'text-xs font-bold px-2 py-0.5 rounded-full border',
            auslastungAmpel === 'rot'  ? 'bg-red-100 border-red-300 text-red-700' :
            auslastungAmpel === 'gelb' ? 'bg-amber-100 border-amber-300 text-amber-700' :
                                         'bg-emerald-100 border-emerald-300 text-emerald-700',
          )}>
            ~{naechste30} / 30 Min
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
      </button>

      {open && (
        <div className="border-t border-stone-200 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between text-[11px] text-stone-500">
            <span>Heute gesamt: <strong className="text-char">{gesamtHeute}</strong></span>
            <span>Rate: <strong className="text-char">{rateProH}/h</strong></span>
            <span>Ziel: <strong className="text-char">{ziel_pro_h}/h</strong></span>
          </div>

          <div className="space-y-2.5">
            {fenster.map(f => {
              const progPct = Math.min(100, (f.prognose / maxBar) * 100);
              const aktPct = Math.min(100, (f.aktuell / maxBar) * 100);
              const TrendIcon = f.trend === 'steigend' ? TrendingUp : f.trend === 'fallend' ? TrendingDown : Minus;
              const trendColor = f.trend === 'steigend' ? 'text-emerald-600' : f.trend === 'fallend' ? 'text-red-500' : 'text-stone-400';

              return (
                <div key={f.label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <TrendIcon className={cn('w-3.5 h-3.5 shrink-0', trendColor)} />
                      <span className="text-xs font-semibold text-char">{f.label}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      <span className="text-stone-500">ist {f.aktuell}</span>
                      <span className="font-bold text-blue-600">prog ~{f.prognose}</span>
                    </div>
                  </div>
                  <div className="relative h-3 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-stone-200 rounded-full transition-all"
                      style={{ width: `${aktPct}%` }}
                    />
                    <div
                      className="absolute inset-y-0 left-0 bg-blue-400/70 rounded-full transition-all border-r-2 border-blue-600"
                      style={{ width: `${progPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-[9px] text-stone-400 pt-1 border-t border-stone-100">
            Prognose basiert auf aktueller 30-Min-Rate hochgerechnet · Ziel {ziel_pro_h} Best./h
          </div>
        </div>
      )}
    </div>
  );
}
