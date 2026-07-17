'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
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
}

const MOCK: ApiData = {
  team_avg_quote: 88,
  fahrer: [
    { driver_id: 'a', fahrer_name: 'Max Müller',   gesamt: 12, abgeschlossen: 12, abgebrochen: 0, quote: 100, trend: 'besser',     quote_gestern: 92 },
    { driver_id: 'b', fahrer_name: 'Anna Schmidt',  gesamt: 10, abgeschlossen: 9,  abgebrochen: 1, quote: 90,  trend: 'gleich',     quote_gestern: 90 },
    { driver_id: 'c', fahrer_name: 'Klaus Weber',   gesamt: 8,  abgeschlossen: 6,  abgebrochen: 2, quote: 75,  trend: 'schlechter', quote_gestern: 88 },
  ],
};

function tipp(quote: number, trend: Trend): string {
  if (quote >= 95) return 'Ausgezeichnet! Du schließt fast alle Touren erfolgreich ab.';
  if (quote >= 90) return 'Sehr gute Quote! Bleib so konstant.';
  if (trend === 'schlechter') return 'Deine Quote ist gesunken — prüfe ob Adressen oder Timing das Problem sind.';
  if (quote >= 80) return 'Gute Quote. Mit etwas mehr Fokus schaffst du die 90%.';
  return 'Deine Quote ist unter 80%. Sprich mit dem Dispatcher für Unterstützung.';
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2130MeineAbschlussquote({ driverId, locationId, isOnline }: Props) {
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
    const id = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) return null;

  const mein = data.fahrer.find(f => f.driver_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const vsTeam = mein.quote - data.team_avg_quote;
  const barColor = mein.quote >= 90 ? 'bg-green-500' : mein.quote >= 80 ? 'bg-amber-500' : 'bg-red-500';
  const textColor = mein.quote >= 90 ? 'text-green-600' : mein.quote >= 80 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Meine Abschlussquote</span>
        <span className={cn('text-xs font-black tabular-nums', textColor)}>{mein.quote}%</span>
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          {/* Quote groß */}
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Heute</p>
              <p className={cn('text-3xl font-black tabular-nums', textColor)}>{mein.quote}%</p>
            </div>
            <div className="ml-auto text-right space-y-0.5">
              <p className="text-[9px] text-muted-foreground">Team-Ø {data.team_avg_quote}%</p>
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

          {/* Fortschrittsbalken */}
          <div className="space-y-1">
            <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${mein.quote}%` }} />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>{mein.abgeschlossen} abgeschlossen</span>
              <span>{mein.gesamt} gesamt</span>
            </div>
          </div>

          {/* Tipp */}
          <div className="rounded-lg bg-muted/30 border px-3 py-2 flex items-start gap-2">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-snug">{tipp(mein.quote, mein.trend)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
