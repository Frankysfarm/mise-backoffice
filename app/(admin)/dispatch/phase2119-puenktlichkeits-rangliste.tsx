'use client';

import { useCallback, useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerPuenktlichkeit {
  fahrer_id: string;
  fahrer_name: string;
  quote_pct: number;
  puenktlich: number;
  zu_spaet: number;
  gesamt_stopps: number;
  grade: 'A' | 'B' | 'C' | 'D';
  ampel: 'gruen' | 'gelb' | 'rot';
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  rang: number;
}

interface ApiData {
  fahrer: FahrerPuenktlichkeit[];
  team_durchschnitt: number;
}

const MOCK: ApiData = {
  team_durchschnitt: 81.5,
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max Müller',  quote_pct: 92.9, puenktlich: 39, zu_spaet: 3,  gesamt_stopps: 42, grade: 'A', ampel: 'gruen', trend: 'steigend', trend_delta: 4,  rang: 1 },
    { fahrer_id: 'f2', fahrer_name: 'Sara Koch',   quote_pct: 81.6, puenktlich: 31, zu_spaet: 7,  gesamt_stopps: 38, grade: 'B', ampel: 'gelb',  trend: 'stabil',   trend_delta: 1,  rang: 2 },
    { fahrer_id: 'f3', fahrer_name: 'Tim Becker',  quote_pct: 69.0, puenktlich: 20, zu_spaet: 9,  gesamt_stopps: 29, grade: 'C', ampel: 'gelb',  trend: 'fallend',  trend_delta: -6, rang: 3 },
    { fahrer_id: 'f4', fahrer_name: 'Lisa Fuchs',  quote_pct: 52.6, puenktlich: 10, zu_spaet: 9,  gesamt_stopps: 19, grade: 'D', ampel: 'rot',   trend: 'stabil',   trend_delta: 0,  rang: 4 },
  ],
};

function TrendIcon({ trend, delta }: { trend: string; delta: number }) {
  if (trend === 'steigend') return <TrendingUp className="h-3 w-3 text-green-500" />;
  if (trend === 'fallend')  return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function GradeBadge({ grade }: { grade: string }) {
  const cls = grade === 'A' ? 'bg-green-100 text-green-700 border-green-200'
            : grade === 'B' ? 'bg-blue-100 text-blue-700 border-blue-200'
            : grade === 'C' ? 'bg-amber-100 text-amber-700 border-amber-200'
            : 'bg-red-100 text-red-700 border-red-200';
  return (
    <span className={cn('text-[9px] font-black rounded border px-1 py-0.5 uppercase', cls)}>{grade}</span>
  );
}

interface Props { locationId: string | null }

export function DispatchPhase2119PuenktlichkeitsRangliste({ locationId }: Props) {
  const [open, setOpen]       = useState(true);
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-puenktlichkeit?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const unterZiel = data.team_durchschnitt < 85;
  const kritisch  = data.fahrer.filter(f => f.ampel === 'rot');

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <TrendingUp className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Pünktlichkeits-Rangliste</span>
        {unterZiel && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          {/* KPI */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border bg-muted/20 p-2.5 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Team-Ø</p>
              <p className={cn('text-lg font-black tabular-nums', unterZiel ? 'text-red-600' : 'text-green-600')}>
                {data.team_durchschnitt.toFixed(1)}%
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-2.5 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Ziel</p>
              <p className="text-lg font-black tabular-nums text-foreground">85%</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-2.5 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Fahrer</p>
              <p className="text-lg font-black tabular-nums text-foreground">{data.fahrer.length}</p>
            </div>
          </div>

          {unterZiel && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-700 font-medium">
                Team-Pünktlichkeit unter 85% — {kritisch.length} Fahrer kritisch
              </p>
            </div>
          )}

          {/* Rangliste */}
          <div className="space-y-1.5">
            {data.fahrer.map((f, idx) => (
              <div key={f.fahrer_id} className={cn(
                'rounded-lg border p-2.5 space-y-1.5',
                idx === 0 ? 'bg-green-50 border-green-200' : 'bg-muted/20'
              )}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-muted-foreground w-4 text-center">
                    {idx === 0 ? <Trophy className="h-3 w-3 text-amber-500 inline" /> : f.rang}
                  </span>
                  <span className="text-[11px] font-bold text-foreground flex-1 truncate">{f.fahrer_name}</span>
                  <GradeBadge grade={f.grade} />
                  <div className="flex items-center gap-0.5">
                    <TrendIcon trend={f.trend} delta={f.trend_delta} />
                    {f.trend_delta !== 0 && (
                      <span className={cn('text-[9px] tabular-nums', f.trend === 'steigend' ? 'text-green-600' : f.trend === 'fallend' ? 'text-red-600' : 'text-muted-foreground')}>
                        {f.trend_delta > 0 ? '+' : ''}{f.trend_delta}%
                      </span>
                    )}
                  </div>
                  <span className={cn(
                    'text-[12px] font-black tabular-nums w-12 text-right',
                    f.ampel === 'gruen' ? 'text-green-600' : f.ampel === 'gelb' ? 'text-amber-600' : 'text-red-600'
                  )}>
                    {f.quote_pct.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', f.ampel === 'gruen' ? 'bg-green-500' : f.ampel === 'gelb' ? 'bg-amber-400' : 'bg-red-500')}
                      style={{ width: `${Math.min(f.quote_pct, 100)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">
                    {f.puenktlich}/{f.gesamt_stopps}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
