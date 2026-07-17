'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Lightbulb, Minus, Timer, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerReaktionszeit {
  driver_id: string;
  name: string;
  avg_min: number;
  auftraege: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_delta: number;
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerReaktionszeit[];
  team_avg_min: number;
  alert_count: number;
}

const MOCK: ApiData = {
  team_avg_min: 5.9,
  alert_count: 0,
  fahrer: [
    { driver_id: 'd1', name: 'Max M.',   avg_min: 3.2,  auftraege: 12, trend: 'besser',     trend_delta: -0.8, alert: false },
    { driver_id: 'd2', name: 'Sarah K.', avg_min: 5.1,  auftraege: 9,  trend: 'gleich',     trend_delta: 0,    alert: false },
    { driver_id: 'd3', name: 'Tom B.',   avg_min: 11.4, auftraege: 7,  trend: 'schlechter', trend_delta: 2.3,  alert: true  },
  ],
};

function tipp(min: number, trend: string): string {
  if (min <= 2) return 'Blitzschnell! Du gehörst zu den reaktionsschnellsten Fahrern heute.';
  if (min <= 3) return 'Sehr gute Reaktionszeit! Halte dein Handy griffbereit und starte gleich nach dem Batch.';
  if (trend === 'schlechter') return 'Deine Reaktionszeit steigt — bereite dich schon beim Warten vor, damit du sofort losfahren kannst.';
  if (min <= 5) return 'Solide Reaktionszeit. Ziel: unter 3 Min. — schau auf den Bildschirm und starte direkt nach dem Piepen.';
  return 'Reaktionszeit über 5 Min. — sprich mit deinem Teamleiter für Tipps zur Verbesserung.';
}

function zeitColor(min: number) {
  if (min <= 3) return 'text-green-600';
  if (min <= 5) return 'text-amber-600';
  return 'text-red-600';
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2150MeineReaktionszeit({ driverId, locationId, isOnline }: Props) {
  const [open, setOpen]       = useState(true);
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-reaktionszeit?location_id=${locationId}`, { cache: 'no-store' });
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

  const vsTeam = Math.round((mein.avg_min - data.team_avg_min) * 10) / 10;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Timer className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Meine Reaktionszeit</span>
        <span className={cn('text-xs font-black tabular-nums', zeitColor(mein.avg_min))}>{mein.avg_min.toFixed(1)} Min.</span>
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Ø Reaktionszeit heute</p>
              <p className={cn('text-3xl font-black tabular-nums', zeitColor(mein.avg_min))}>{mein.avg_min.toFixed(1)}</p>
              <p className="text-[10px] text-muted-foreground">Minuten</p>
            </div>
            <div className="ml-auto text-right space-y-0.5">
              <p className="text-[9px] text-muted-foreground">Ziel: &lt; 3 Min.</p>
              <p className="text-[9px] text-muted-foreground">Team-Ø {data.team_avg_min.toFixed(1)} Min.</p>
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

          <div className="rounded-lg bg-muted/20 border px-3 py-2 text-center">
            <p className="text-[9px] text-muted-foreground">Aufträge heute</p>
            <p className="text-lg font-bold tabular-nums">{mein.auftraege}</p>
          </div>

          <div className="rounded-lg bg-muted/30 border px-3 py-2 flex items-start gap-2">
            <Lightbulb className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-snug">{tipp(mein.avg_min, mein.trend)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
