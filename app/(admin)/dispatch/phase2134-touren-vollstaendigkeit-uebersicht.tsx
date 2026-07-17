'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerVoll {
  fahrer_id: string;
  fahrer_name: string;
  touren_gesamt: number;
  abgeschlossen: number;
  abgebrochen: number;
  quote_pct: number;
  trend: 'besser' | 'gleich' | 'schlechter';
}

interface ApiData {
  fahrer: FahrerVoll[];
  team_index?: number;
  alert_count?: number;
}

const MOCK: ApiData = {
  team_index: 84,
  alert_count: 1,
  fahrer: [
    { fahrer_id: 'a', fahrer_name: 'Max Müller',   touren_gesamt: 12, abgeschlossen: 12, abgebrochen: 0, quote_pct: 100,  trend: 'besser'     },
    { fahrer_id: 'b', fahrer_name: 'Anna Schmidt',  touren_gesamt: 10, abgeschlossen: 9,  abgebrochen: 1, quote_pct: 90,   trend: 'gleich'     },
    { fahrer_id: 'c', fahrer_name: 'Klaus Weber',   touren_gesamt: 8,  abgeschlossen: 5,  abgebrochen: 2, quote_pct: 62.5, trend: 'schlechter' },
  ],
};

function indexColor(q: number) {
  if (q >= 90) return 'text-green-600';
  if (q >= 85) return 'text-amber-600';
  return 'text-red-600';
}

function barColor(q: number) {
  if (q >= 90) return 'bg-green-500';
  if (q >= 85) return 'bg-amber-500';
  return 'bg-red-500';
}

interface Props { locationId: string | null }

export function DispatchPhase2134TourenVollstaendigkeitUebersicht({ locationId }: Props) {
  const [open, setOpen]       = useState(true);
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-touren-vollstaendigkeit?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const teamIndex  = data.team_index ?? Math.round(data.fahrer.reduce((s, f) => s + f.quote_pct, 0) / Math.max(data.fahrer.length, 1));
  const alertList  = data.fahrer.filter(f => f.quote_pct < 85);
  const hasAlert   = alertList.length > 0;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <CheckCheck className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Touren-Vollständigkeit</span>
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
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Team-Vollständigkeitsindex</p>
              <p className={cn('text-xl font-black tabular-nums', indexColor(teamIndex))}>
                {teamIndex}%
              </p>
            </div>
            {hasAlert && (
              <p className="ml-auto text-[10px] text-muted-foreground italic">Aufträge klarer kommunizieren</p>
            )}
          </div>

          {hasAlert && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-700 font-medium leading-snug">
                {alertList.map(f => f.fahrer_name).join(', ')} — Index unter 85 %
              </p>
            </div>
          )}

          <div className="space-y-2">
            {data.fahrer.map(f => (
              <div key={f.fahrer_id} className={cn(
                'rounded-lg border p-2.5 space-y-1.5',
                f.quote_pct < 85  ? 'bg-red-50 border-red-200'
                : f.quote_pct < 90 ? 'bg-amber-50 border-amber-200'
                : 'bg-muted/10'
              )}>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold flex-1 truncate">{f.fahrer_name}</span>
                  <span className={cn('text-sm font-black tabular-nums', indexColor(f.quote_pct))}>
                    {f.quote_pct}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', barColor(f.quote_pct))}
                    style={{ width: `${Math.min(f.quote_pct, 100)}%` }}
                  />
                </div>
                <div className="flex gap-3 text-[9px] text-muted-foreground">
                  <span>{f.abgeschlossen}/{f.touren_gesamt} Touren</span>
                  {f.abgebrochen > 0 && <span className="text-red-500">{f.abgebrochen} abgebrochen</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
