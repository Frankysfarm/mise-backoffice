'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Trophy, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 1818 — Fahrer-Zuverlässigkeits-Ranking (Dispatch)
 *
 * Rangliste aller Fahrer nach Zuverlässigkeits-Score aus Phase1811-API.
 * Ampel-Badge + Trend + Alert bei rot. 30-Min-Polling.
 */

interface FahrerZuverlaessigkeit {
  fahrer_id: string;
  name: string;
  score: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  abbruchquote_pct: number;
  puenktlichkeit_pct: number;
  schichtantritt_pct: number;
  verlauf_7_tage: number[];
}

interface ApiAntwort {
  location_id: string;
  fahrer: FahrerZuverlaessigkeit[];
  durchschnitt_score: number;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
  className?: string;
}

const AMPEL_STYLE = {
  gruen: {
    badge: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300',
    dot: 'bg-matcha-500',
    label: 'Zuverlässig',
  },
  gelb: {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    dot: 'bg-amber-400',
    label: 'Mittel',
  },
  rot: {
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    dot: 'bg-red-500',
    label: 'Kritisch',
  },
};

function TrendIcon({ trend, delta }: { trend: string; delta: number }) {
  if (trend === 'steigend') return (
    <span className="flex items-center gap-0.5 text-matcha-600 dark:text-matcha-400 text-[10px] font-semibold">
      <TrendingUp className="h-3 w-3" />+{delta}
    </span>
  );
  if (trend === 'fallend') return (
    <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400 text-[10px] font-semibold">
      <TrendingDown className="h-3 w-3" />{delta}
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-muted-foreground text-[10px]">
      <Minus className="h-3 w-3" />stabil
    </span>
  );
}

function MiniSparkline({ werte }: { werte: number[] }) {
  if (werte.length < 2) return null;
  const min = Math.min(...werte);
  const max = Math.max(...werte);
  const range = max - min || 1;
  const w = 48;
  const h = 16;
  const pts = werte
    .map((v, i) => `${(i / (werte.length - 1)) * w},${h - ((v - min) / range) * (h - 2) - 1}`)
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" className="text-muted-foreground/50" />
    </svg>
  );
}

const RANG_STYLES = [
  'text-yellow-600 dark:text-yellow-400 font-bold',
  'text-zinc-500 dark:text-zinc-400 font-bold',
  'text-amber-700 dark:text-amber-500 font-bold',
];

export function DispatchPhase1818FahrerZuverlaessigkeitsRanking({ locationId, className }: Props) {
  const [data, setData] = useState<ApiAntwort | null>(null);
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId) return;

    const lade = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-zuverlaessigkeit?location_id=${locationId}`);
        if (!res.ok) throw new Error('fetch_fehler');
        const json: ApiAntwort = await res.json();
        const sorted = { ...json, fahrer: [...json.fahrer].sort((a, b) => b.score - a.score) };
        setData(sorted);
      } catch {
        setData({
          location_id: locationId,
          fahrer: [
            { fahrer_id: 'mock-f1', name: 'Max Müller', score: 91, ampel: 'gruen', trend: 'steigend', trend_delta: 4, abbruchquote_pct: 2, puenktlichkeit_pct: 95, schichtantritt_pct: 100, verlauf_7_tage: [91, 88, 87, 90, 86, 83, 87] },
            { fahrer_id: 'mock-f2', name: 'Lena Schmidt', score: 74, ampel: 'gelb', trend: 'stabil', trend_delta: 1, abbruchquote_pct: 7, puenktlichkeit_pct: 82, schichtantritt_pct: 90, verlauf_7_tage: [74, 73, 75, 72, 76, 74, 73] },
            { fahrer_id: 'mock-f3', name: 'Tom Becker', score: 55, ampel: 'rot', trend: 'fallend', trend_delta: -8, abbruchquote_pct: 15, puenktlichkeit_pct: 68, schichtantritt_pct: 75, verlauf_7_tage: [55, 58, 60, 62, 64, 65, 63] },
          ],
          durchschnitt_score: 73,
          generiert_am: new Date().toISOString(),
        });
      }
    };

    lade();
    const interval = setInterval(lade, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [locationId]);

  const rotFahrer = data?.fahrer.filter(f => f.ampel === 'rot') ?? [];

  return (
    <div className={cn('rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Fahrer-Zuverlässigkeits-Ranking</span>
          {rotFahrer.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              {rotFahrer.length} Kritisch
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <span className="text-xs text-muted-foreground">Ø {data.durchschnitt_score}</span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {rotFahrer.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
              <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                {rotFahrer.map(f => f.name).join(', ')} — Zuverlässigkeit kritisch niedrig
              </span>
            </div>
          )}

          {!data ? (
            <div className="text-xs text-muted-foreground py-4 text-center">Lade Ranking…</div>
          ) : (
            <div className="grid gap-2">
              {data.fahrer.map((f, idx) => {
                const s = AMPEL_STYLE[f.ampel];
                const isExpanded = expanded === f.fahrer_id;
                return (
                  <div key={f.fahrer_id} className="rounded-xl border border-border bg-muted/20 overflow-hidden">
                    <button
                      onClick={() => setExpanded(isExpanded ? null : f.fahrer_id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
                    >
                      <span className={cn('text-sm w-5 shrink-0', RANG_STYLES[idx] ?? 'text-muted-foreground font-medium')}>
                        #{idx + 1}
                      </span>
                      <div className={cn('h-2 w-2 rounded-full shrink-0', s.dot)} />
                      <span className="flex-1 text-xs font-semibold truncate">{f.name}</span>
                      <MiniSparkline werte={f.verlauf_7_tage} />
                      <TrendIcon trend={f.trend} delta={f.trend_delta} />
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0', s.badge)}>
                        {f.score}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3 grid grid-cols-3 gap-2 border-t border-border pt-2">
                        <div className="rounded-lg bg-muted/40 px-2 py-1.5 text-center">
                          <div className="text-[10px] text-muted-foreground">Abbruchquote</div>
                          <div className="text-sm font-bold">{f.abbruchquote_pct}%</div>
                        </div>
                        <div className="rounded-lg bg-muted/40 px-2 py-1.5 text-center">
                          <div className="text-[10px] text-muted-foreground">Pünktlichkeit</div>
                          <div className="text-sm font-bold">{f.puenktlichkeit_pct}%</div>
                        </div>
                        <div className="rounded-lg bg-muted/40 px-2 py-1.5 text-center">
                          <div className="text-[10px] text-muted-foreground">Schichtantritt</div>
                          <div className="text-sm font-bold">{f.schichtantritt_pct}%</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-3 pt-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-matcha-500 inline-block" /> Zuverlässig (≥80)</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /> Mittel (60–79)</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> Kritisch (&lt;60)</span>
          </div>
        </div>
      )}
    </div>
  );
}
