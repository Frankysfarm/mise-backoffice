'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, TrendingDown, TrendingUp, Minus, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerEffizienz {
  fahrer_id: string;
  name: string;
  score: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  touren_pro_stunde: number;
  wartezeit_min: number;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEffizienz[];
  team_durchschnitt: number;
}

const MOCK: ApiData = {
  team_durchschnitt: 68,
  fahrer: [
    { fahrer_id: 'f1', name: 'Max Müller',  score: 88, ampel: 'gruen', trend: 'steigend', trend_delta: 5,  touren_pro_stunde: 2.1, wartezeit_min: 4,  rang: 1 },
    { fahrer_id: 'f2', name: 'Lena Schmidt', score: 72, ampel: 'gelb',  trend: 'stabil',   trend_delta: 1,  touren_pro_stunde: 1.6, wartezeit_min: 8,  rang: 2 },
    { fahrer_id: 'f3', name: 'Tom Becker',   score: 45, ampel: 'rot',   trend: 'fallend',  trend_delta: -9, touren_pro_stunde: 0.9, wartezeit_min: 18, rang: 3 },
  ],
};

function scoreColor(score: number) {
  if (score >= 75) return 'text-green-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-600';
}

function barColor(score: number) {
  if (score >= 75) return 'bg-green-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function cardBg(score: number) {
  if (score < 70) return 'bg-red-50 border-red-200';
  if (score < 75) return 'bg-amber-50 border-amber-200';
  return 'bg-muted/10';
}

interface Props { locationId: string | null }

export function DispatchPhase2139SchichtEffizienzUebersicht({ locationId }: Props) {
  const [open, setOpen]       = useState(true);
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-schicht-effizienz?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const alertList   = data.fahrer.filter(f => f.score < 70);
  const hasAlert    = alertList.length > 0;
  const teamScore   = data.team_durchschnitt;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Zap className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Schicht-Effizienz</span>
        {hasAlert && (
          <span className="flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-100 border border-red-200 rounded-full px-2 py-0.5">
            <AlertTriangle className="h-2.5 w-2.5" />{alertList.length} NIEDRIG
          </span>
        )}
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          <div className="rounded-lg bg-muted/30 border px-3 py-2 flex items-center gap-3">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Team-Ø Effizienz</p>
              <p className={cn('text-xl font-black tabular-nums', scoreColor(teamScore))}>{teamScore}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[9px] text-muted-foreground">Ziel: 70+</p>
              {hasAlert && (
                <p className="text-[10px] text-amber-700 font-medium mt-0.5">Rush-Hour prüfen</p>
              )}
            </div>
          </div>

          {hasAlert && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-700 font-medium leading-snug">
                {alertList.map(f => f.name).join(', ')} — Effizienz unter 70
              </p>
            </div>
          )}

          <div className="space-y-2">
            {data.fahrer.map(f => (
              <div key={f.fahrer_id} className={cn('rounded-lg border p-2.5 space-y-1.5', cardBg(f.score))}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-bold w-4 shrink-0">#{f.rang}</span>
                  <span className="text-[11px] font-semibold flex-1 truncate">{f.name}</span>
                  <div className="flex items-center gap-1">
                    {f.trend === 'steigend' && <TrendingUp   className="h-3 w-3 text-green-500" />}
                    {f.trend === 'fallend'  && <TrendingDown className="h-3 w-3 text-red-500" />}
                    {f.trend === 'stabil'   && <Minus        className="h-3 w-3 text-muted-foreground" />}
                    <span className={cn('text-sm font-black tabular-nums', scoreColor(f.score))}>{f.score}</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', barColor(f.score))} style={{ width: `${f.score}%` }} />
                </div>
                <div className="flex gap-3 text-[9px] text-muted-foreground">
                  <span>{f.touren_pro_stunde} Touren/h</span>
                  <span>{f.wartezeit_min} Min. Wartezeit</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
