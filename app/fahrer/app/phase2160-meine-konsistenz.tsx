'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, ChevronDown, ChevronUp, Lightbulb, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerVarianz {
  driver_id: string;
  name: string;
  stdabweichung_min: number;
  avg_lieferzeit_min: number;
  auftraege: number;
  konsistenz_score: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerVarianz[];
  team_avg_sigma: number;
}

const MOCK: ApiData = {
  team_avg_sigma: 9.2,
  fahrer: [
    { driver_id: 'd1', name: 'Max M.',   stdabweichung_min: 3.2,  avg_lieferzeit_min: 24, auftraege: 12, konsistenz_score: 90, trend: 'besser', alert: false },
    { driver_id: 'd2', name: 'Sarah K.', stdabweichung_min: 8.5,  avg_lieferzeit_min: 31, auftraege: 9,  konsistenz_score: 65, trend: 'gleich', alert: false },
  ],
};

function tipp(sigma: number, trend: string): string {
  if (sigma <= 3) return 'Ausgezeichnete Konsistenz! Deine Lieferzeiten sind sehr vorhersehbar.';
  if (sigma <= 5) return 'Gute Konsistenz. Halte deine gewohnte Routenreihenfolge bei.';
  if (trend === 'schlechter') return 'Deine Varianz steigt — plane ähnliche Zonen zusammen und halte Routenreihenfolge konstant.';
  if (sigma <= 15) return 'Mittlere Varianz. Standardisierte Routen helfen dir, vorhersehbarer zu werden.';
  return 'Hohe Varianz über 15 Min. — Gespräch mit Teamleiter empfohlen. Feste Stopp-Reihenfolge einhalten.';
}

function sigmaColor(sigma: number) {
  if (sigma <= 5)  return 'text-green-600';
  if (sigma <= 15) return 'text-amber-600';
  return 'text-red-600';
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2160MeineKonsistenz({ driverId, locationId, isOnline }: Props) {
  const [open, setOpen]       = useState(true);
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-lieferzeit-varianz?location_id=${locationId}`, { cache: 'no-store' });
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

  const vsTeam = Math.round((mein.stdabweichung_min - data.team_avg_sigma) * 10) / 10;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Activity className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Meine Konsistenz</span>
        <span className={cn('text-xs font-black tabular-nums', sigmaColor(mein.stdabweichung_min))}>
          σ {mein.stdabweichung_min.toFixed(1)} Min.
        </span>
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          <div className="flex items-start gap-3">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Varianz heute (σ)</p>
              <p className={cn('text-3xl font-black tabular-nums', sigmaColor(mein.stdabweichung_min))}>
                {mein.stdabweichung_min.toFixed(1)}
              </p>
              <p className="text-[10px] text-muted-foreground">Minuten</p>
            </div>
            <div className="ml-auto text-right space-y-0.5">
              <p className="text-[9px] text-muted-foreground">Konsistenz-Score</p>
              <p className={cn('text-lg font-black tabular-nums', sigmaColor(mein.stdabweichung_min))}>
                {mein.konsistenz_score}/100
              </p>
              <p className="text-[9px] text-muted-foreground">Team-Ø σ {data.team_avg_sigma.toFixed(1)} Min.</p>
              <p className={cn('text-[10px] font-semibold', vsTeam <= 0 ? 'text-green-600' : 'text-red-600')}>
                {vsTeam >= 0 ? '+' : ''}{vsTeam} Min. vs. Team
              </p>
              <div className="flex items-center justify-end gap-1">
                {mein.trend === 'besser'     && <TrendingDown className="h-3 w-3 text-green-500" />}
                {mein.trend === 'schlechter' && <TrendingUp   className="h-3 w-3 text-red-500" />}
                {mein.trend === 'gleich'     && <Minus        className="h-3 w-3 text-muted-foreground" />}
                <span className="text-[9px] text-muted-foreground">
                  {mein.trend === 'besser' ? 'verbessert' : mein.trend === 'schlechter' ? 'gestiegen' : 'stabil'}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-muted/20 border px-3 py-2 flex items-center gap-4">
            <div className="text-center">
              <p className="text-[9px] text-muted-foreground">Aufträge heute</p>
              <p className="text-lg font-bold tabular-nums">{mein.auftraege}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-muted-foreground">Ø Lieferzeit</p>
              <p className="text-lg font-bold tabular-nums">{mein.avg_lieferzeit_min} Min.</p>
            </div>
          </div>

          <div className="rounded-lg bg-muted/30 border px-3 py-2 flex items-start gap-2">
            <Lightbulb className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-snug">{tipp(mein.stdabweichung_min, mein.trend)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
