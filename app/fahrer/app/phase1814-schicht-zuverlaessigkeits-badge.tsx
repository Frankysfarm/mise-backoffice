'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ShieldCheck, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

/**
 * Phase 1814 — Schicht-Zuverlässigkeits-Badge (Fahrer-App)
 *
 * Zeigt dem Fahrer seinen eigenen Zuverlässigkeits-Score aus Phase1811-API.
 * Score + Ampel + Wochenverlauf-Sparkline + persönlicher Verbesserungstipp.
 * isOnline-Guard; 30-Min-Polling.
 */

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

interface FahrerZuverlaessigkeit {
  fahrer_id: string;
  name: string;
  score: number;
  ampel: Ampel;
  schichtantritt_pct: number;
  puenktlichkeit_pct: number;
  abbruch_quote_pct: number;
  trend_7_tage: Trend;
  score_verlauf: number[];
  tipp: string | null;
}

interface ApiAntwort {
  fahrer: FahrerZuverlaessigkeit[];
}

const MOCK: FahrerZuverlaessigkeit = {
  fahrer_id: 'mock',
  name: 'Du',
  score: 82,
  ampel: 'gruen',
  schichtantritt_pct: 90,
  puenktlichkeit_pct: 85,
  abbruch_quote_pct: 3,
  trend_7_tage: 'steigend',
  score_verlauf: [75, 77, 79, 80, 81, 82, 82],
  tipp: null,
};

interface Props {
  driverId: string | null;
  isOnline: boolean;
}

const AMPEL_STYLES: Record<Ampel, { bg: string; text: string; border: string; label: string }> = {
  gruen: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800', label: 'Sehr zuverlässig' },
  gelb: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800', label: 'Gut – Luft nach oben' },
  rot: { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-800', label: 'Verbesserung nötig' },
};

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function FahrerPhase1814SchichtZuverlaessigkeitsBadge({ driverId, isOnline }: Props) {
  const [data, setData] = useState<FahrerZuverlaessigkeit | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  async function load() {
    if (!driverId) { setData(MOCK); return; }
    setLoading(true);
    try {
      const res = await globalThis.fetch(`/api/delivery/admin/fahrer-zuverlaessigkeit?driver_id=${driverId}`);
      if (!res.ok) throw new Error('err');
      const json: ApiAntwort = await res.json();
      setData(json.fahrer?.[0] ?? MOCK);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, isOnline]);

  if (!isOnline || !data) return null;

  const s = AMPEL_STYLES[data.ampel];
  const TrendIcon = data.trend_7_tage === 'steigend' ? TrendingUp : data.trend_7_tage === 'fallend' ? TrendingDown : Minus;

  return (
    <div className={cn('rounded-2xl border shadow-sm overflow-hidden mb-3', s.bg, s.border)}>
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className={cn('h-5 w-5', s.text)} />
          <div className="text-left">
            <div className={cn('font-bold text-sm', s.text)}>Zuverlässigkeits-Score: {data.score}/100</div>
            <div className={cn('text-xs', s.text, 'opacity-80')}>{s.label}</div>
          </div>
          {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3">
          {/* Score ring */}
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/20" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none" strokeWidth="3"
                  stroke={data.ampel === 'gruen' ? '#10b981' : data.ampel === 'gelb' ? '#f59e0b' : '#ef4444'}
                  strokeDasharray={`${data.score} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn('text-lg font-extrabold', s.text)}>{data.score}</span>
              </div>
            </div>
            <div className="flex-1 space-y-1.5">
              {[
                { label: 'Pünktlichkeit', val: data.puenktlichkeit_pct },
                { label: 'Schichtantritt', val: data.schichtantritt_pct },
                { label: 'Abbruchquote', val: 100 - data.abbruch_quote_pct, invert: true },
              ].map(({ label, val, invert }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={cn('font-semibold', s.text)}>{invert ? `${data.abbruch_quote_pct}%` : `${val}%`}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${val}%`,
                        background: val >= 80 ? '#10b981' : val >= 60 ? '#f59e0b' : '#ef4444',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sparkline */}
          <div className={cn('rounded-xl border p-3', s.border)}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">7-Tage-Verlauf</span>
              <div className={cn('flex items-center gap-1 text-xs font-medium', s.text)}>
                <TrendIcon className="h-3 w-3" />
                {data.trend_7_tage === 'steigend' ? 'Steigend' : data.trend_7_tage === 'fallend' ? 'Fallend' : 'Stabil'}
              </div>
            </div>
            <div className={cn(s.text)}>
              <Sparkline values={data.score_verlauf} />
            </div>
          </div>

          {/* Tipp */}
          {data.tipp && (
            <div className="rounded-xl bg-white/60 dark:bg-black/20 border p-3">
              <p className="text-xs font-semibold text-foreground mb-0.5">💡 Tipp</p>
              <p className="text-xs text-muted-foreground">{data.tipp}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
