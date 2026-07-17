'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type Trend = 'besser' | 'gleich' | 'schlechter';

interface FahrerQuote {
  driver_id: string;
  fahrer_name: string;
  gesamt: number;
  abgeschlossen: number;
  abgebrochen: number;
  quote: number;
  trend: Trend;
  quote_gestern: number | null;
}

interface ApiData {
  fahrer: FahrerQuote[];
  team_avg_quote: number;
  team_avg_gestern: number | null;
  alert_count: number;
}

const MOCK: ApiData = {
  team_avg_quote: 88,
  team_avg_gestern: 90,
  alert_count: 1,
  fahrer: [
    { driver_id: 'a', fahrer_name: 'Max Müller',   gesamt: 12, abgeschlossen: 12, abgebrochen: 0, quote: 100, trend: 'besser',     quote_gestern: 92 },
    { driver_id: 'b', fahrer_name: 'Anna Schmidt',  gesamt: 10, abgeschlossen: 9,  abgebrochen: 1, quote: 90,  trend: 'gleich',     quote_gestern: 90 },
    { driver_id: 'c', fahrer_name: 'Klaus Weber',   gesamt: 8,  abgeschlossen: 6,  abgebrochen: 2, quote: 75,  trend: 'schlechter', quote_gestern: 88 },
  ],
};

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === 'besser')      return <TrendingUp   className="h-3 w-3 text-green-500" />;
  if (trend === 'schlechter')  return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function quoteColor(q: number) {
  if (q >= 90) return 'text-green-600';
  if (q >= 80) return 'text-amber-600';
  return 'text-red-600';
}

function barColor(q: number) {
  if (q >= 90) return 'bg-green-500';
  if (q >= 80) return 'bg-amber-500';
  return 'bg-red-500';
}

interface Props { locationId: string | null }

export function DispatchPhase2129AbschlussquotenBoard({ locationId }: Props) {
  const [open, setOpen]       = useState(true);
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/tour-abschlussquote?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const alertFahrer = data.fahrer.filter(f => f.quote < 80);
  const hasAlert    = alertFahrer.length > 0;
  const teamTrend   = data.team_avg_gestern !== null
    ? data.team_avg_quote > data.team_avg_gestern ? 'besser'
    : data.team_avg_quote < data.team_avg_gestern ? 'schlechter'
    : 'gleich'
    : 'gleich';

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Abschlussquoten-Board</span>
        {hasAlert && (
          <span className="flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-100 border border-red-200 rounded-full px-2 py-0.5">
            <AlertTriangle className="h-2.5 w-2.5" />{alertFahrer.length} NIEDRIG
          </span>
        )}
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          {/* Team-Ø KPI */}
          <div className="rounded-lg bg-muted/30 border px-3 py-2 flex items-center gap-3">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Team-Ø Abschlussquote</p>
              <p className={cn('text-xl font-black tabular-nums', quoteColor(data.team_avg_quote))}>
                {data.team_avg_quote}%
              </p>
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <TrendIcon trend={teamTrend as Trend} />
              {data.team_avg_gestern !== null && (
                <span className="text-[10px] text-muted-foreground">gestern {data.team_avg_gestern}%</span>
              )}
            </div>
          </div>

          {hasAlert && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-700 font-medium leading-snug">
                {alertFahrer.map(f => f.fahrer_name).join(', ')} — Abschlussquote unter 80%
              </p>
            </div>
          )}

          <div className="space-y-2">
            {data.fahrer.map(f => (
              <div key={f.driver_id} className={cn(
                'rounded-lg border p-2.5 space-y-1.5',
                f.quote < 80 ? 'bg-red-50 border-red-200'
                : f.quote < 90 ? 'bg-amber-50 border-amber-200'
                : 'bg-muted/10'
              )}>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold flex-1 truncate">{f.fahrer_name}</span>
                  <TrendIcon trend={f.trend} />
                  <span className={cn('text-sm font-black tabular-nums', quoteColor(f.quote))}>
                    {f.quote}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', barColor(f.quote))}
                    style={{ width: `${Math.min(f.quote, 100)}%` }}
                  />
                </div>
                <div className="flex gap-3 text-[9px] text-muted-foreground">
                  <span>{f.abgeschlossen}/{f.gesamt} Tours</span>
                  {f.abgebrochen > 0 && <span className="text-red-500">{f.abgebrochen} abgebrochen</span>}
                  {f.quote_gestern !== null && <span>gestern {f.quote_gestern}%</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
