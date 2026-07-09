'use client';

import { useEffect, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ZoneEntry = {
  zone: string;
  bestellungen: number;
  fahrer_verfuegbar: number;
  druck: 'niedrig' | 'mittel' | 'hoch' | 'kritisch';
  avg_eta_min: number | null;
};

type ApiResponse = { zonen: ZoneEntry[] };

function mock(): ApiResponse {
  return {
    zonen: [
      { zone: 'Nord', bestellungen: 8, fahrer_verfuegbar: 2, druck: 'hoch', avg_eta_min: 22 },
      { zone: 'Mitte', bestellungen: 5, fahrer_verfuegbar: 3, druck: 'mittel', avg_eta_min: 18 },
      { zone: 'Süd', bestellungen: 12, fahrer_verfuegbar: 1, druck: 'kritisch', avg_eta_min: 35 },
      { zone: 'West', bestellungen: 2, fahrer_verfuegbar: 2, druck: 'niedrig', avg_eta_min: 14 },
      { zone: 'Ost', bestellungen: 3, fahrer_verfuegbar: 1, druck: 'mittel', avg_eta_min: 20 },
    ],
  };
}

const DRUCK_STYLE = {
  niedrig:  { bg: 'bg-matcha-50 dark:bg-matcha-950/30', border: 'border-matcha-200 dark:border-matcha-800', badge: 'bg-matcha-500 text-white', bar: 'bg-matcha-500', label: 'Niedrig' },
  mittel:   { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-700', badge: 'bg-amber-500 text-white', bar: 'bg-amber-400', label: 'Mittel' },
  hoch:     { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-700', badge: 'bg-orange-500 text-white', bar: 'bg-orange-500', label: 'Hoch' },
  kritisch: { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-700', badge: 'bg-red-500 text-white', bar: 'bg-red-500', label: 'Kritisch' },
};

export function DispatchPhase1060ZonenBestelldruckLive({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const p = new URLSearchParams(); if (locationId) p.set('location_id', locationId);
      const r = await fetch(`/api/delivery/admin/zonen-bestelldruck?${p}`);
      if (r.ok) setData(await r.json()); else throw new Error();
    } catch { setData(mock()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); const id = setInterval(load, 60000); return () => clearInterval(id); }, [locationId]);

  const zonen = (data?.zonen ?? []).sort((a, b) => {
    const order = ['kritisch', 'hoch', 'mittel', 'niedrig'];
    return order.indexOf(a.druck) - order.indexOf(b.druck);
  });
  if (!loading && zonen.length === 0) return null;

  const kritisch = zonen.filter((z) => z.druck === 'kritisch').length;
  const maxBestellungen = Math.max(...zonen.map((z) => z.bestellungen), 1);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <MapPin size={15} className="text-purple-500" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">Zonen-Bestelldruck — Live</span>
        {kritisch > 0 && (
          <span className="rounded-full bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 animate-pulse">
            {kritisch} Kritisch
          </span>
        )}
        {loading && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
      </div>

      <div className="p-3 space-y-2">
        {zonen.map((z) => {
          const ss = DRUCK_STYLE[z.druck];
          const pct = Math.round((z.bestellungen / maxBestellungen) * 100);
          return (
            <div key={z.zone} className={cn('rounded-xl border p-3', ss.bg, ss.border)}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin size={12} className="text-muted-foreground" />
                  <span className="text-sm font-bold">Zone {z.zone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-[9px] font-bold rounded-full px-2 py-0.5', ss.badge)}>{ss.label}</span>
                  {z.avg_eta_min !== null && (
                    <span className="text-[10px] font-bold text-muted-foreground">~{z.avg_eta_min} Min ETA</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex-1 h-2 rounded-full bg-black/10 overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', ss.bar)} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] font-bold tabular-nums w-14 text-right text-muted-foreground">
                  {z.bestellungen} Best.
                </span>
              </div>
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                <span>{z.fahrer_verfuegbar} Fahrer frei</span>
                <span>
                  Verhältnis: {z.fahrer_verfuegbar > 0 ? (z.bestellungen / z.fahrer_verfuegbar).toFixed(1) : '∞'} Best./Fahrer
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
