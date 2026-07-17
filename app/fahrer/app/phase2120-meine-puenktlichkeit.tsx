'use client';

import { useCallback, useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerPuenktlichkeit {
  fahrer_id: string;
  quote_pct: number;
  puenktlich: number;
  zu_spaet: number;
  gesamt_stopps: number;
  grade: 'A' | 'B' | 'C' | 'D';
  ampel: 'gruen' | 'gelb' | 'rot';
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
}

interface ApiData {
  fahrer: FahrerPuenktlichkeit[];
  team_durchschnitt: number;
}

const MOCK_MEIN: FahrerPuenktlichkeit = {
  fahrer_id: 'mock',
  quote_pct: 88.2,
  puenktlich: 22,
  zu_spaet: 3,
  gesamt_stopps: 25,
  grade: 'B',
  ampel: 'gelb',
  trend: 'steigend',
  trend_delta: 3,
};

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2120MeinePuenktlichkeit({ driverId, locationId, isOnline }: Props) {
  const [open, setOpen]       = useState(false);
  const [mein, setMein]       = useState<FahrerPuenktlichkeit>(MOCK_MEIN);
  const [teamAvg, setTeamAvg] = useState(81.5);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId || !isOnline) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-puenktlichkeit?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) {
        const d: ApiData = await r.json();
        setTeamAvg(d.team_durchschnitt);
        const me = d.fahrer.find(f => f.fahrer_id === driverId);
        if (me) setMein(me);
      }
    } catch { /* use mock */ } finally {
      setLoading(false);
    }
  }, [locationId, driverId, isOnline]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) return null;

  const unterZiel = mein.quote_pct < 85;
  const differenz = Math.round((mein.quote_pct - teamAvg) * 10) / 10;

  function tipp(): string {
    if (mein.quote_pct >= 90) return 'Ausgezeichnet — weiter so!';
    if (mein.quote_pct >= 85) return 'Gut! Noch etwas Tempo und du erreichst Top-Level.';
    if (mein.quote_pct >= 70) return 'Fahrroute optimieren und Kunden direkt anrufen bei Verzögerung.';
    return 'Bitte Dispatch kontaktieren — gemeinsam optimieren wir deine Route.';
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <TrendingUp className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Meine Pünktlichkeit</span>
        {unterZiel && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          {/* Quote Hero */}
          <div className={cn(
            'rounded-xl p-4 text-center space-y-1',
            mein.ampel === 'gruen' ? 'bg-green-50 border border-green-200'
            : mein.ampel === 'gelb' ? 'bg-amber-50 border border-amber-200'
            : 'bg-red-50 border border-red-200'
          )}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pünktlichkeitsquote</p>
            <p className={cn(
              'text-4xl font-black tabular-nums',
              mein.ampel === 'gruen' ? 'text-green-600' : mein.ampel === 'gelb' ? 'text-amber-600' : 'text-red-600'
            )}>
              {mein.quote_pct.toFixed(1)}%
            </p>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              {mein.trend === 'steigend' ? <TrendingUp className="h-3.5 w-3.5 text-green-500" /> : mein.trend === 'fallend' ? <TrendingDown className="h-3.5 w-3.5 text-red-500" /> : <Minus className="h-3.5 w-3.5" />}
              <span>
                {mein.trend === 'steigend' ? `+${mein.trend_delta}% Trend` : mein.trend === 'fallend' ? `${mein.trend_delta}% Trend` : 'Stabiler Trend'}
              </span>
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border bg-muted/20 p-2.5 text-center">
              <p className="text-[9px] text-muted-foreground uppercase">Pünktlich</p>
              <p className="text-base font-black tabular-nums text-green-600">{mein.puenktlich}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-2.5 text-center">
              <p className="text-[9px] text-muted-foreground uppercase">Verspätet</p>
              <p className="text-base font-black tabular-nums text-red-600">{mein.zu_spaet}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-2.5 text-center">
              <p className="text-[9px] text-muted-foreground uppercase">Team-Ø</p>
              <p className={cn('text-base font-black tabular-nums', differenz >= 0 ? 'text-green-600' : 'text-amber-600')}>
                {differenz >= 0 ? '+' : ''}{differenz}%
              </p>
            </div>
          </div>

          {/* Fortschrittsbalken */}
          <div className="space-y-1">
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>Ziel: 85%</span>
              <span>{mein.puenktlich}/{mein.gesamt_stopps} Stopps</span>
            </div>
            <div className="h-2 w-full rounded-full bg-black/10 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', mein.ampel === 'gruen' ? 'bg-green-500' : mein.ampel === 'gelb' ? 'bg-amber-400' : 'bg-red-500')}
                style={{ width: `${Math.min(mein.quote_pct, 100)}%` }}
              />
            </div>
            <div className="relative">
              <div className="absolute left-[85%] -translate-x-1/2 -top-0.5 h-3 w-0.5 bg-foreground/30" />
            </div>
          </div>

          {/* Tipp */}
          <div className={cn(
            'rounded-lg px-3 py-2 flex items-start gap-2',
            unterZiel ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
          )}>
            {unterZiel
              ? <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
              : <CheckCircle className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
            }
            <p className={cn('text-[11px] font-medium', unterZiel ? 'text-red-700' : 'text-green-700')}>
              {tipp()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
