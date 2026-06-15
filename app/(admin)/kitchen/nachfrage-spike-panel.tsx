'use client';

import { useEffect, useState } from 'react';
import { Zap, TrendingUp, AlertTriangle, Flame, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type Order = {
  id: string;
  status: string;
  bestellt_am: string | null;
  typ?: string;
  geschaetzte_zubereitung_min?: number | null;
};

interface SpikeInfo {
  detected: boolean;
  ordersLast5Min: number;
  ordersLast15Min: number;
  growthRate: number;
  severity: 'normal' | 'erhoeht' | 'surge' | 'kritisch';
  estimatedClearMin: number;
  recommendation: string;
}

function analyzeDemand(orders: Order[]): SpikeInfo {
  const now = Date.now();
  const last5 = orders.filter(o => {
    if (!o.bestellt_am) return false;
    return now - new Date(o.bestellt_am).getTime() < 5 * 60_000;
  }).length;
  const last15 = orders.filter(o => {
    if (!o.bestellt_am) return false;
    return now - new Date(o.bestellt_am).getTime() < 15 * 60_000;
  }).length;

  const rateNow = last5 / 5;
  const ratePrev = (last15 - last5) / 10;
  const growthRate = ratePrev > 0 ? Math.round(((rateNow - ratePrev) / ratePrev) * 100) : 0;

  const active = orders.filter(o => ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status));
  const avgPrep = active.reduce((s, o) => s + (o.geschaetzte_zubereitung_min ?? 15), 0) / Math.max(1, active.length);
  const estimatedClearMin = Math.round((active.length * avgPrep) / 2);

  let severity: SpikeInfo['severity'] = 'normal';
  let recommendation = 'Normalbetrieb — alles unter Kontrolle.';

  if (last5 >= 5 || growthRate >= 100) {
    severity = 'kritisch';
    recommendation = 'Sofortmaßnahme: Dispatch pausieren, alle Stationen voll belasten, ETA erhöhen.';
  } else if (last5 >= 3 || growthRate >= 60) {
    severity = 'surge';
    recommendation = 'Surge erkannt: Batch-Kochen aktivieren, Beilagen vorbereiten, Dispatch informieren.';
  } else if (last5 >= 2 || growthRate >= 30) {
    severity = 'erhoeht';
    recommendation = 'Erhöhte Nachfrage: Vorauskochen empfohlen, besonders häufige Items.';
  }

  return {
    detected: severity !== 'normal',
    ordersLast5Min: last5,
    ordersLast15Min: last15,
    severity,
    growthRate,
    estimatedClearMin,
    recommendation,
  };
}

export function KitchenNachfrageSpike({ orders }: { orders: Order[] }) {
  const [spike, setSpike] = useState<SpikeInfo | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    const info = analyzeDemand(orders);
    setSpike(info);
    // Auto-expand on surge/kritisch
    if (info.severity === 'surge' || info.severity === 'kritisch') {
      setExpanded(true);
    }
  }, [orders]);

  if (!spike || !spike.detected) return null;

  const key = `${spike.severity}-${spike.ordersLast5Min}`;
  if (dismissed === key) return null;

  const cfg = {
    normal:   { bg: 'bg-gray-50',     border: 'border-gray-200',  text: 'text-gray-700',  icon: Clock,          label: 'Normal' },
    erhoeht:  { bg: 'bg-blue-50',     border: 'border-blue-300',  text: 'text-blue-800',  icon: TrendingUp,      label: 'Erhöhte Nachfrage' },
    surge:    { bg: 'bg-orange-50',   border: 'border-orange-400', text: 'text-orange-900', icon: Zap,            label: 'Surge!' },
    kritisch: { bg: 'bg-red-50',      border: 'border-red-500',   text: 'text-red-900',   icon: Flame,           label: 'Kritisch!' },
  }[spike.severity];

  const Icon = cfg.icon;

  return (
    <div className={cn(
      'rounded-xl border-2 overflow-hidden transition-all',
      cfg.bg, cfg.border,
      spike.severity === 'kritisch' && 'animate-pulse',
    )}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <div className={cn(
          'h-9 w-9 rounded-xl flex items-center justify-center shrink-0',
          spike.severity === 'kritisch' ? 'bg-red-600 text-white' :
          spike.severity === 'surge'   ? 'bg-orange-500 text-white' :
          'bg-blue-500 text-white',
        )}>
          <Icon className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className={cn('font-black text-sm', cfg.text)}>
            {cfg.label} · {spike.ordersLast5Min} Bestellungen in 5 Min
          </div>
          <div className={cn('text-[11px] mt-0.5 opacity-80', cfg.text)}>
            {spike.growthRate > 0 ? `+${spike.growthRate}%` : `${spike.growthRate}%`} gegenüber der Viertelstunde
            &nbsp;·&nbsp;ca. {spike.estimatedClearMin} Min Warteschlange
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-black',
            spike.severity === 'kritisch' ? 'bg-red-600 text-white' :
            spike.severity === 'surge'    ? 'bg-orange-500 text-white' :
            'bg-blue-500 text-white',
          )}>
            {spike.ordersLast15Min} / 15 Min
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 opacity-60" /> : <ChevronDown className="h-4 w-4 opacity-60" />}
        </div>
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className={cn('border-t px-4 pb-4 pt-3 space-y-3', cfg.border)}>
          {/* Empfehlung */}
          <div className={cn('flex items-start gap-2 rounded-lg p-3', spike.severity === 'kritisch' ? 'bg-red-100' : spike.severity === 'surge' ? 'bg-orange-100' : 'bg-blue-100')}>
            <AlertTriangle className={cn('h-4 w-4 mt-0.5 shrink-0', cfg.text)} />
            <p className={cn('text-sm font-semibold', cfg.text)}>{spike.recommendation}</p>
          </div>

          {/* Metriken */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Letzte 5 Min', value: spike.ordersLast5Min },
              { label: 'Letzte 15 Min', value: spike.ordersLast15Min },
              { label: 'Wachstum', value: `${spike.growthRate > 0 ? '+' : ''}${spike.growthRate}%` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-white/70 border border-white/80 px-3 py-2 text-center">
                <div className="text-[9px] font-bold uppercase tracking-wide text-gray-500">{label}</div>
                <div className={cn('text-lg font-black tabular-nums mt-0.5', cfg.text)}>{value}</div>
              </div>
            ))}
          </div>

          {/* Maßnahmen-Checkliste für surge/kritisch */}
          {(spike.severity === 'surge' || spike.severity === 'kritisch') && (
            <div className="space-y-1.5">
              <div className={cn('text-[10px] font-black uppercase tracking-wider opacity-70', cfg.text)}>
                Sofortmaßnahmen
              </div>
              {[
                'Dispatch: Neue Batches sofort zuweisen',
                'Küche: Parallel kochen — häufigste Items priorisieren',
                spike.severity === 'kritisch' ? 'ETA erhöhen (+10 Min) — Kunden informieren' : 'Vorkochen: Beilagen und Dips vorbereiten',
                spike.severity === 'kritisch' ? 'Zusatzpersonal anfordern' : 'Batch-Zubereitung für gleiche Items',
              ].map((action, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', spike.severity === 'kritisch' ? 'bg-red-600' : 'bg-orange-500')} />
                  <span className={cn('font-medium', cfg.text)}>{action}</span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); setDismissed(key); }}
            className="text-[10px] text-gray-500 hover:text-gray-700 underline"
          >
            Schließen (diese Warnung ausblenden)
          </button>
        </div>
      )}
    </div>
  );
}
