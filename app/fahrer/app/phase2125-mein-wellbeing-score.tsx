'use client';

import { useCallback, useEffect, useState } from 'react';
import { Heart, ChevronDown, ChevronUp, Star, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerRisiko {
  driver_id: string;
  risiko_score: number;
  verspaetungen_3_tage: number;
}

interface ApiData {
  fahrer: FahrerRisiko[];
  team_durchschnitt?: number;
}

const MOCK: ApiData = {
  fahrer: [{ driver_id: 'mock-me', risiko_score: 3, verspaetungen_3_tage: 1 }],
};

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2125MeinWellbeingScore({ driverId, locationId, isOnline }: Props) {
  const [open, setOpen]       = useState(false);
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId || !isOnline) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-ausfallrisiko?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally { setLoading(false); }
  }, [locationId, isOnline]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) return null;

  const me = data.fahrer.find(f => f.driver_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const wellbeing = Math.max(0, Math.min(100, 100 - me.risiko_score * 10));
  const level = wellbeing >= 80 ? 'top' : wellbeing >= 60 ? 'gut' : 'verbesserbar';
  const color = level === 'top' ? 'text-green-600' : level === 'gut' ? 'text-amber-600' : 'text-red-600';
  const bg    = level === 'top' ? 'bg-green-50 border-green-200' : level === 'gut' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
  const tip   = level === 'top' ? 'Ausgezeichnet! Deine Verlässlichkeit macht den Unterschied.'
              : level === 'gut' ? 'Du bist auf einem guten Weg — weiter so!'
              : 'Ein paar pünktliche Schichten verbessern deinen Score sofort.';
  const stars = level === 'top' ? 5 : level === 'gut' ? 3 : 1;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Heart className="h-4 w-4 text-pink-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Mein Engagement</span>
        <span className={cn('text-[10px] font-black rounded-full px-2 py-0.5 border', bg, color)}>
          {wellbeing}%
        </span>
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          <div className={cn('rounded-xl p-4 text-center space-y-2 border', bg)}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Dein Engagement heute</p>
            <p className={cn('text-4xl font-black tabular-nums', color)}>{wellbeing}%</p>
            <div className="flex justify-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={cn('h-4 w-4', i < stars ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground')} />
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">{me.verspaetungen_3_tage} Verspätungen in 3 Tagen</p>
          </div>

          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', level === 'top' ? 'bg-green-500' : level === 'gut' ? 'bg-amber-400' : 'bg-red-500')} style={{ width: `${wellbeing}%` }} />
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 flex items-start gap-2">
            <Lightbulb className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-[11px] text-blue-700 leading-snug">{tip}</p>
          </div>
        </div>
      )}
    </div>
  );
}
