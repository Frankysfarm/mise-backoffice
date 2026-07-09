'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Shield, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Star } from 'lucide-react';

/**
 * Phase 1025 — Fahrer-Zuverlässigkeits-Dashboard (Dispatch)
 *
 * Visualisierung der Fahrer-Zuverlässigkeits-Scores aus Phase1018-API.
 * Rang + Trend-Pfeile + Sub-Score Balken. 5-Min-Polling.
 */

interface FahrerScore {
  fahrer_id: string;
  name: string;
  score: number;
  schicht_puenktlichkeit_pct: number;
  abbruch_rate_pct: number;
  pausen_einhaltung_pct: number;
  schichten_gesamt: number;
  status: 'sehr_gut' | 'gut' | 'mittel' | 'schlecht';
  trend: 'up' | 'down' | 'gleich';
}

interface ApiResponse {
  fahrer: FahrerScore[];
  durchschnitt: number;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', name: 'Max Müller', score: 88, schicht_puenktlichkeit_pct: 92, abbruch_rate_pct: 4, pausen_einhaltung_pct: 82, schichten_gesamt: 24, status: 'sehr_gut', trend: 'up' },
    { fahrer_id: 'f2', name: 'Sarah Koch', score: 73, schicht_puenktlichkeit_pct: 78, abbruch_rate_pct: 12, pausen_einhaltung_pct: 68, schichten_gesamt: 18, status: 'gut', trend: 'gleich' },
    { fahrer_id: 'f3', name: 'Tom Weber', score: 61, schicht_puenktlichkeit_pct: 65, abbruch_rate_pct: 18, pausen_einhaltung_pct: 55, schichten_gesamt: 15, status: 'mittel', trend: 'down' },
    { fahrer_id: 'f4', name: 'Lisa Fischer', score: 82, schicht_puenktlichkeit_pct: 88, abbruch_rate_pct: 7, pausen_einhaltung_pct: 74, schichten_gesamt: 21, status: 'gut', trend: 'up' },
  ],
  durchschnitt: 76,
  generiert_am: new Date().toISOString(),
};

function statusStyle(status: FahrerScore['status']) {
  switch (status) {
    case 'sehr_gut': return { bar: 'bg-matcha-500', badge: 'bg-matcha-100 dark:bg-matcha-900/30 border-matcha-300 text-matcha-700 dark:text-matcha-300', label: 'Sehr gut' };
    case 'gut': return { bar: 'bg-blue-500', badge: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 text-blue-700 dark:text-blue-300', label: 'Gut' };
    case 'mittel': return { bar: 'bg-amber-500', badge: 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 text-amber-700 dark:text-amber-300', label: 'Mittel' };
    default: return { bar: 'bg-red-500', badge: 'bg-red-100 dark:bg-red-900/30 border-red-300 text-red-700 dark:text-red-300', label: 'Schlecht' };
  }
}

const RANG_EMOJIS = ['🥇', '🥈', '🥉'];

function TrendIcon({ trend }: { trend: FahrerScore['trend'] }) {
  if (trend === 'up') return <TrendingUp className="h-3 w-3 text-matcha-500" />;
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-zinc-400" />;
}

export function DispatchPhase1025FahrerZuverlaessigkeitsDashboard({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      if (!locationId) { setData(MOCK); return; }
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-zuverlaessigkeits-score?location_id=${locationId}`);
        if (res.ok) setData(await res.json());
        else setData(MOCK);
      } catch { setData(MOCK); }
      finally { setLoading(false); }
    }
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [locationId]);

  const sorted = data ? [...data.fahrer].sort((a, b) => b.score - a.score) : [];
  const schlechtCount = sorted.filter(f => f.status === 'schlecht').length;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
      >
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Fahrer-Zuverlässigkeits-Dashboard</span>
          {schlechtCount > 0 && (
            <span className="rounded-full border border-red-300 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
              {schlechtCount} Handlungsbedarf
            </span>
          )}
          {data && (
            <span className="text-xs text-zinc-500">Ø {data.durchschnitt}/100</span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {loading && !data && (
            <p className="text-xs text-muted-foreground py-2">Lade Daten…</p>
          )}

          {sorted.map((f, idx) => {
            const style = statusStyle(f.status);
            return (
              <div key={f.fahrer_id} className="rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{RANG_EMOJIS[idx] ?? `#${idx + 1}`}</span>
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{f.name}</span>
                    <TrendIcon trend={f.trend} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold', style.badge)}>
                      <Star className="h-2.5 w-2.5" />
                      {style.label}
                    </span>
                    <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{f.score}/100</span>
                  </div>
                </div>

                {/* Gesamt-Score-Balken */}
                <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden mb-3">
                  <div className={cn('h-full rounded-full transition-all', style.bar)} style={{ width: `${f.score}%` }} />
                </div>

                {/* Sub-Scores */}
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <div className="text-muted-foreground mb-0.5">Pünktlichkeit</div>
                    <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-400" style={{ width: `${f.schicht_puenktlichkeit_pct}%` }} />
                    </div>
                    <div className="font-semibold text-zinc-700 dark:text-zinc-300 mt-0.5">{f.schicht_puenktlichkeit_pct}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-0.5">Abbruch-Inv.</div>
                    <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${100 - f.abbruch_rate_pct}%` }} />
                    </div>
                    <div className="font-semibold text-zinc-700 dark:text-zinc-300 mt-0.5">{100 - f.abbruch_rate_pct}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-0.5">Pause-Einh.</div>
                    <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                      <div className="h-full rounded-full bg-matcha-400" style={{ width: `${f.pausen_einhaltung_pct}%` }} />
                    </div>
                    <div className="font-semibold text-zinc-700 dark:text-zinc-300 mt-0.5">{f.pausen_einhaltung_pct}%</div>
                  </div>
                </div>
                <div className="mt-1.5 text-[10px] text-muted-foreground">{f.schichten_gesamt} Schichten (30 Tage)</div>
              </div>
            );
          })}

          {!loading && sorted.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">Keine Fahrerdaten verfügbar.</p>
          )}

          {data && (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Team-Ø Zuverlässigkeits-Score</span>
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{data.durchschnitt}/100</span>
            </div>
          )}
          <p className="text-[10px] text-right text-muted-foreground/60">Pünktlichkeit 35% · Abbruch-Inv. 35% · Pausen 30%</p>
        </div>
      )}
    </div>
  );
}
