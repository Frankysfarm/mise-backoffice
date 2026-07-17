'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Lightbulb, Minus, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerEffizienz {
  fahrer_id: string;
  name: string;
  score: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  touren_pro_stunde: number;
  km_pro_stopp: number;
  wartezeit_min: number;
}

interface ApiData {
  fahrer: FahrerEffizienz[];
  team_durchschnitt: number;
}

const MOCK: ApiData = {
  team_durchschnitt: 68,
  fahrer: [
    { fahrer_id: 'f1', name: 'Max Müller',  score: 88, ampel: 'gruen', trend: 'steigend', trend_delta: 5,  touren_pro_stunde: 2.1, km_pro_stopp: 1.8, wartezeit_min: 4  },
    { fahrer_id: 'f2', name: 'Lena Schmidt', score: 72, ampel: 'gelb',  trend: 'stabil',   trend_delta: 1,  touren_pro_stunde: 1.6, km_pro_stopp: 2.5, wartezeit_min: 8  },
    { fahrer_id: 'f3', name: 'Tom Becker',   score: 45, ampel: 'rot',   trend: 'fallend',  trend_delta: -9, touren_pro_stunde: 0.9, km_pro_stopp: 4.2, wartezeit_min: 18 },
  ],
};

function tipp(score: number, trend: string): string {
  if (score >= 90) return 'Ausgezeichnete Effizienz! Du bist heute im Top-Bereich.';
  if (score >= 75) return 'Gute Effizienz. Kürzere Wartezeiten können deinen Score weiter verbessern.';
  if (trend === 'fallend') return 'Dein Score sinkt — prüfe ob Wartezeiten oder lange Strecken das Problem sind.';
  if (score >= 50) return 'Mittlere Effizienz. Versuche Routen zu bündeln und Wartezeiten zu reduzieren.';
  return 'Effizienz niedrig. Sprich mit dem Dispatcher über Routenoptimierung.';
}

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

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2140MeineSchichtEffizienz({ driverId, locationId, isOnline }: Props) {
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
    const id = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) return null;

  const mein = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const vsTeam = Math.round((mein.score - data.team_durchschnitt) * 10) / 10;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Zap className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Meine Schicht-Effizienz</span>
        <span className={cn('text-xs font-black tabular-nums', scoreColor(mein.score))}>{mein.score}</span>
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Effizienz-Score</p>
              <p className={cn('text-3xl font-black tabular-nums', scoreColor(mein.score))}>{mein.score}</p>
            </div>
            <div className="ml-auto text-right space-y-0.5">
              <p className="text-[9px] text-muted-foreground">Team-Ø {data.team_durchschnitt}</p>
              <p className={cn('text-[10px] font-semibold', vsTeam >= 0 ? 'text-green-600' : 'text-red-600')}>
                {vsTeam >= 0 ? '+' : ''}{vsTeam} vs. Team
              </p>
              <div className="flex items-center justify-end gap-1">
                {mein.trend === 'steigend' && <TrendingUp   className="h-3 w-3 text-green-500" />}
                {mein.trend === 'fallend'  && <TrendingDown className="h-3 w-3 text-red-500" />}
                {mein.trend === 'stabil'   && <Minus        className="h-3 w-3 text-muted-foreground" />}
                <span className="text-[9px] text-muted-foreground">
                  {mein.trend === 'steigend' ? 'verbessert' : mein.trend === 'fallend' ? 'gesunken' : 'stabil'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', barColor(mein.score))} style={{ width: `${mein.score}%` }} />
            </div>
            <div className="flex gap-1 text-[9px] text-muted-foreground">
              <span className="mr-auto">0</span>
              <span className="absolute left-1/2 -translate-x-1/2 relative">70 Ziel</span>
              <span>100</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-lg bg-muted/20 border px-2.5 py-1.5 text-center">
              <p className="text-[9px] text-muted-foreground">Touren/Std.</p>
              <p className="text-sm font-bold tabular-nums">{mein.touren_pro_stunde}</p>
            </div>
            <div className="rounded-lg bg-muted/20 border px-2.5 py-1.5 text-center">
              <p className="text-[9px] text-muted-foreground">Wartezeit</p>
              <p className="text-sm font-bold tabular-nums">{mein.wartezeit_min} Min.</p>
            </div>
          </div>

          <div className="rounded-lg bg-muted/30 border px-3 py-2 flex items-start gap-2">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-snug">{tipp(mein.score, mein.trend)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
