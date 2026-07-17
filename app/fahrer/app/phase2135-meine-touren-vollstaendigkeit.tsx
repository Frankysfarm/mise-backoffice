'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCheck, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
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
}

const MOCK: ApiData = {
  team_index: 88,
  fahrer: [
    { fahrer_id: 'a', fahrer_name: 'Max Müller',   touren_gesamt: 12, abgeschlossen: 12, abgebrochen: 0, quote_pct: 100,  trend: 'besser'     },
    { fahrer_id: 'b', fahrer_name: 'Anna Schmidt',  touren_gesamt: 10, abgeschlossen: 9,  abgebrochen: 1, quote_pct: 90,   trend: 'gleich'     },
    { fahrer_id: 'c', fahrer_name: 'Klaus Weber',   touren_gesamt: 8,  abgeschlossen: 5,  abgebrochen: 2, quote_pct: 62.5, trend: 'schlechter' },
  ],
};

function tipp(index: number, trend: string): string {
  if (index >= 100) return 'Perfekte Vollständigkeit! Alle Touren heute abgeschlossen.';
  if (index >= 90)  return 'Sehr gut! Nur wenige Touren nicht vollständig abgeschlossen.';
  if (trend === 'schlechter') return 'Dein Index ist gesunken — prüfe ob Routenplanung oder Zeitdruck das Problem sind.';
  if (index >= 85)  return 'Guter Index. Mit etwas Fokus schaffst du 90%.';
  return 'Index unter 85 %. Sprich mit dem Dispatcher — Aufträge möglicherweise zu komplex.';
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2135MeineTourenVollstaendigkeit({ driverId, locationId, isOnline }: Props) {
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
    const id = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) return null;

  const mein = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const teamIdx  = data.team_index ?? Math.round(data.fahrer.reduce((s, f) => s + f.quote_pct, 0) / Math.max(data.fahrer.length, 1));
  const vsTeam   = Math.round((mein.quote_pct - teamIdx) * 10) / 10;
  const ist100   = mein.quote_pct >= 100;
  const barColor = mein.quote_pct >= 90 ? 'bg-green-500' : mein.quote_pct >= 85 ? 'bg-amber-500' : 'bg-red-500';
  const textColor = mein.quote_pct >= 90 ? 'text-green-600' : mein.quote_pct >= 85 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <CheckCheck className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Meine Touren-Vollständigkeit</span>
        {ist100 && (
          <span className="text-[9px] font-bold text-green-700 bg-green-100 border border-green-200 rounded-full px-2 py-0.5">
            VOLLSTÄNDIG
          </span>
        )}
        <span className={cn('text-xs font-black tabular-nums', textColor)}>{mein.quote_pct}%</span>
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Vollständigkeitsindex</p>
              <p className={cn('text-3xl font-black tabular-nums', textColor)}>{mein.quote_pct}%</p>
            </div>
            <div className="ml-auto text-right space-y-0.5">
              <p className="text-[9px] text-muted-foreground">Team-Ø {teamIdx}%</p>
              <p className={cn('text-[10px] font-semibold', vsTeam >= 0 ? 'text-green-600' : 'text-red-600')}>
                {vsTeam >= 0 ? '+' : ''}{vsTeam}% vs. Team
              </p>
              <div className="flex items-center justify-end gap-1">
                {mein.trend === 'besser'     && <TrendingUp   className="h-3 w-3 text-green-500" />}
                {mein.trend === 'schlechter' && <TrendingDown className="h-3 w-3 text-red-500" />}
                {mein.trend === 'gleich'     && <Minus        className="h-3 w-3 text-muted-foreground" />}
                <span className="text-[9px] text-muted-foreground">
                  {mein.trend === 'besser' ? 'verbessert' : mein.trend === 'schlechter' ? 'gesunken' : 'stabil'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${Math.min(mein.quote_pct, 100)}%` }} />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>{mein.abgeschlossen} vollständig</span>
              {mein.abgebrochen > 0 && <span className="text-red-500">{mein.abgebrochen} abgebrochen</span>}
              <span>{mein.touren_gesamt} gesamt</span>
            </div>
          </div>

          <div className="rounded-lg bg-muted/30 border px-3 py-2 flex items-start gap-2">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-snug">{tipp(mein.quote_pct, mein.trend)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
