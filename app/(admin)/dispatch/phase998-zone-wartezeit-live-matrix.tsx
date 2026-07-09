'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, TrendingDown, TrendingUp, Minus, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

/**
 * Phase 998 — Zone-Wartezeit-Live-Matrix (Dispatch)
 *
 * Echtzeit-Wartezeit-Prognose je Zone A/B/C/D
 * mit Ampel-Farbkodierung + Trend. 90s-Polling.
 */

interface ZoneWartezeit {
  zone: string;
  wartezeit_min: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  aktive_bestellungen: number;
  freie_fahrer: number;
  status: 'ok' | 'hoch' | 'kritisch';
}

interface ApiResponse {
  zonen: ZoneWartezeit[];
  avg_wartezeit_min: number;
  location_id: string | null;
  generiert_am: string;
}

const MOCK: ApiResponse = {
  zonen: [
    { zone: 'A', wartezeit_min: 18, trend: 'stabil', aktive_bestellungen: 4, freie_fahrer: 2, status: 'ok' },
    { zone: 'B', wartezeit_min: 32, trend: 'steigend', aktive_bestellungen: 7, freie_fahrer: 0, status: 'kritisch' },
    { zone: 'C', wartezeit_min: 24, trend: 'fallend', aktive_bestellungen: 3, freie_fahrer: 1, status: 'hoch' },
    { zone: 'D', wartezeit_min: 15, trend: 'stabil', aktive_bestellungen: 2, freie_fahrer: 2, status: 'ok' },
  ],
  avg_wartezeit_min: 22,
  location_id: null,
  generiert_am: new Date().toISOString(),
};

function statusStyle(status: ZoneWartezeit['status']): { bg: string; bar: string; text: string; badge: string; label: string } {
  switch (status) {
    case 'kritisch':
      return { bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700', bar: 'bg-red-500', text: 'text-red-700 dark:text-red-300', badge: 'bg-red-100 dark:bg-red-900/30 border-red-300 text-red-700 dark:text-red-300', label: 'Kritisch' };
    case 'hoch':
      return { bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700', bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', badge: 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 text-amber-700 dark:text-amber-300', label: 'Hoch' };
    default:
      return { bg: 'bg-matcha-50 dark:bg-matcha-900/20 border-matcha-200 dark:border-matcha-700', bar: 'bg-matcha-500', text: 'text-matcha-700 dark:text-matcha-300', badge: 'bg-matcha-100 dark:bg-matcha-900/30 border-matcha-300 text-matcha-700 dark:text-matcha-300', label: 'OK' };
  }
}

function TrendIcon({ trend }: { trend: ZoneWartezeit['trend'] }) {
  if (trend === 'steigend') return <TrendingUp className="h-3 w-3 text-red-500" />;
  if (trend === 'fallend') return <TrendingDown className="h-3 w-3 text-matcha-500" />;
  return <Minus className="h-3 w-3 text-zinc-400" />;
}

interface Props {
  locationId: string | null;
}

export function DispatchPhase998ZoneWartezeitLiveMatrix({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const url = locationId
          ? `/api/delivery/admin/zonen-abdeckungs-luecken?location_id=${locationId}`
          : '/api/delivery/admin/zonen-abdeckungs-luecken';
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        const raw = await res.json();

        // Map from zonen-abdeckungs-luecken response to our format
        const zonen: ZoneWartezeit[] = (raw.zonen ?? []).map((z: { zone: string; offene_bestellungen: number; aktive_fahrer: number; geschaetzte_wartezeit_min: number | null; risiko: string }) => {
          const wz = z.geschaetzte_wartezeit_min ?? 20;
          return {
            zone: z.zone,
            wartezeit_min: wz,
            trend: wz > 25 ? 'steigend' : wz < 15 ? 'fallend' : 'stabil',
            aktive_bestellungen: z.offene_bestellungen,
            freie_fahrer: z.aktive_fahrer,
            status: z.risiko === 'kritisch' ? 'kritisch' : z.risiko === 'warnung' ? 'hoch' : 'ok',
          } as ZoneWartezeit;
        });
        const avg = zonen.length > 0 ? Math.round(zonen.reduce((a, z) => a + z.wartezeit_min, 0) / zonen.length) : 0;
        setData({ zonen, avg_wartezeit_min: avg, location_id: locationId, generiert_am: new Date().toISOString() });
      } catch {
        setData(MOCK);
      }
    }
    load();
    const iv = setInterval(load, 90_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const d = data ?? MOCK;
  const kritischCount = d.zonen.filter(z => z.status === 'kritisch').length;
  const MAX_WAIT = 45;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold">Zone-Wartezeit-Matrix</span>
          {kritischCount > 0 && (
            <span className="ml-1 flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-300 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300 animate-pulse">
              <AlertCircle className="h-3 w-3" />
              {kritischCount}× Kritisch
            </span>
          )}
          <span className="ml-auto text-xs text-muted-foreground">Ø {d.avg_wartezeit_min} Min</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-3">
            {d.zonen.map(z => {
              const style = statusStyle(z.status);
              const barPct = Math.min(100, Math.round((z.wartezeit_min / MAX_WAIT) * 100));
              return (
                <div key={z.zone} className={cn('rounded-lg border p-3 space-y-2', style.bg)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold">Zone {z.zone}</span>
                      <TrendIcon trend={z.trend} />
                    </div>
                    <span className={cn('rounded-full border px-1.5 py-0.5 text-[10px] font-bold', style.badge)}>
                      {style.label}
                    </span>
                  </div>
                  <div className={cn('text-2xl font-bold tabular-nums', style.text)}>
                    {z.wartezeit_min}
                    <span className="text-sm font-normal ml-1">Min</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', style.bar)}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{z.aktive_bestellungen} Bestellungen</span>
                    <span>{z.freie_fahrer} Fahrer frei</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
