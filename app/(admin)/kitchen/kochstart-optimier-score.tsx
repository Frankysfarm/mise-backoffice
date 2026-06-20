'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Target, CheckCircle2, AlertTriangle, Clock, Zap } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  fertig_am: string | null;
  geschaetzte_zubereitung_min: number | null;
};

type KitchenTiming = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type Stop = {
  id: string;
  batch_id: string;
  order_id: string;
  angekommen_am: string | null;
  geliefert_am: string | null;
};

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
  stops: Stop[];
}

type TimingResult = {
  bestellnummer: string;
  waitedMin: number;
  verdict: 'perfekt' | 'früh' | 'spät';
};

export function KitchenKochstartOptimierScore({ orders, timings, stops }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 20_000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();
  const window90 = 90 * 60_000;

  // Analysiere Bestellungen: war die Bestellung fertig bevor Fahrer ankam? Oder zu spät?
  const results: TimingResult[] = [];

  for (const o of orders) {
    if (!['fertig', 'unterwegs', 'geliefert'].includes(o.status)) continue;
    if (!o.fertig_am || !o.bestellt_am) continue;
    if (now - new Date(o.bestellt_am).getTime() > window90) continue;

    const stop = stops.find((s) => s.order_id === o.id);
    if (!stop) continue;

    const fertigMs = new Date(o.fertig_am).getTime();
    const fahrerKamMs = stop.angekommen_am ? new Date(stop.angekommen_am).getTime() : null;

    if (!fahrerKamMs) continue;

    // Positiv: Fahrer hat gewartet (fertig vor Fahrer). Negativ: Küche war zu langsam.
    const waitedMin = (fahrerKamMs - fertigMs) / 60_000;
    const verdict: TimingResult['verdict'] =
      waitedMin > 3 ? 'früh' : waitedMin < -2 ? 'spät' : 'perfekt';

    results.push({ bestellnummer: o.bestellnummer, waitedMin, verdict });
  }

  if (results.length === 0) return null;

  const perfekt = results.filter((r) => r.verdict === 'perfekt').length;
  const früh = results.filter((r) => r.verdict === 'früh').length;
  const spät = results.filter((r) => r.verdict === 'spät').length;

  // Score: perfekt = 100p, früh (Fahrer wartete) = 60p, spät (Küche zu langsam) = 20p
  const score = Math.round(
    ((perfekt * 100 + früh * 60 + spät * 20) / results.length),
  );

  const health: 'gut' | 'okay' | 'kritisch' =
    score >= 80 ? 'gut' : score >= 55 ? 'okay' : 'kritisch';

  const style = {
    gut:      { bg: 'bg-matcha-50', border: 'border-matcha-200', text: 'text-matcha-700', ring: '#22c55e', badge: 'bg-matcha-100 text-matcha-800' },
    okay:     { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  ring: '#f59e0b', badge: 'bg-amber-100 text-amber-800'  },
    kritisch: { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    ring: '#ef4444', badge: 'bg-red-100 text-red-800'      },
  }[health];

  const circumference = 2 * Math.PI * 24;
  const offset = circumference * (1 - score / 100);

  return (
    <div className={cn('rounded-xl border p-3 space-y-2.5', style.bg, style.border)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Target size={14} className={style.text} />
        <span className={cn('text-xs font-bold uppercase tracking-wider', style.text)}>
          Kochstart-Timing Score
        </span>
        <span className={cn('ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full', style.badge)}>
          letzte 90 Min
        </span>
      </div>

      {/* Score Ring + KPIs */}
      <div className="flex items-center gap-4">
        {/* SVG Score Ring */}
        <div className="shrink-0 relative flex items-center justify-center">
          <svg width="60" height="60" viewBox="0 0 60 60" className="-rotate-90">
            <circle cx="30" cy="30" r="24" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
            <circle
              cx="30" cy="30" r="24"
              fill="none"
              stroke={style.ring}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('text-lg font-black tabular-nums leading-none', style.text)}>{score}</span>
            <span className="text-[8px] text-muted-foreground font-medium">Score</span>
          </div>
        </div>

        {/* KPI Kacheln */}
        <div className="flex-1 grid grid-cols-3 gap-1.5">
          {[
            { label: 'Perfekt', value: perfekt, icon: CheckCircle2, color: 'text-matcha-700 bg-matcha-50' },
            { label: 'Zu früh', value: früh, icon: Clock, color: 'text-amber-700 bg-amber-50' },
            { label: 'Zu spät', value: spät, icon: AlertTriangle, color: 'text-red-700 bg-red-50' },
          ].map((k) => (
            <div key={k.label} className={cn('rounded-lg px-2 py-1.5 text-center', k.color)}>
              <div className="text-base font-black tabular-nums">{k.value}</div>
              <div className="text-[8px] font-semibold">{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Erklärung */}
      <div className={cn('flex items-center gap-1.5 text-[10px] font-medium', style.text)}>
        <Zap size={10} />
        {score >= 80
          ? 'Küche trifft Kochstart sehr gut — Fahrer warten kaum.'
          : score >= 55
          ? 'Kochstart-Timing kann verbessert werden.'
          : früh > spät
          ? 'Bestellungen werden zu früh fertig — Wärme geht verloren.'
          : 'Küche kommt zu spät fertig — Fahrer warten.'}
      </div>

      {/* Einzelne Bestellungen */}
      {results.length > 0 && (
        <div className="space-y-1">
          {results.slice(0, 5).map((r) => {
            const c =
              r.verdict === 'perfekt' ? 'text-matcha-700' :
              r.verdict === 'früh'    ? 'text-amber-700' :
                                        'text-red-700';
            const bar =
              r.verdict === 'perfekt' ? 'bg-matcha-400' :
              r.verdict === 'früh'    ? 'bg-amber-400' :
                                        'bg-red-400';
            const barW = Math.min(100, Math.max(4, Math.abs(r.waitedMin) * 10));
            return (
              <div key={r.bestellnummer} className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground w-12 shrink-0">
                  #{r.bestellnummer}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-black/8 overflow-hidden">
                  <div className={cn('h-full rounded-full', bar)} style={{ width: `${barW}%` }} />
                </div>
                <span className={cn('text-[10px] font-bold tabular-nums w-16 text-right shrink-0', c)}>
                  {r.waitedMin > 0 ? '+' : ''}{r.waitedMin.toFixed(1)} Min
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-[9px] text-muted-foreground">
        {results.length} Bestellungen analysiert · positiv = Fahrer wartete, negativ = Küche war zu spät
      </div>
    </div>
  );
}
