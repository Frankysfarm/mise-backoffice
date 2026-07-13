'use client';

// Phase 1253 — Zone-Bestelldichte-Live-Overlay (Dispatch)
// Nutzt Phase-1246-API: Zone-Intensität als farbige Badges + Hotspot-Alert
// Props: locationId · 60s-Polling

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Flame, TrendingUp, TrendingDown, Minus, Loader2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZoneData {
  zone: string;
  bestellungen_2h: number;
  bestellungen_30min: number;
  intensitaet: 'ruhig' | 'normal' | 'hoch' | 'peak';
  trend: 'steigend' | 'stabil' | 'fallend';
  hotspot: boolean;
}

interface ApiResponse {
  zonen: ZoneData[];
  gesamt_2h: number;
  hotspot_zonen: string[];
  peak_zone: string | null;
  location_id: string;
  generiert_am: string;
}

const INTENSITAET_STYLE: Record<ZoneData['intensitaet'], { bg: string; border: string; badge: string; label: string }> = {
  ruhig:  { bg: 'bg-slate-50 dark:bg-slate-900/20',   border: 'border-slate-200 dark:border-slate-700',  badge: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200', label: 'Ruhig' },
  normal: { bg: 'bg-sky-50 dark:bg-sky-900/20',       border: 'border-sky-200 dark:border-sky-700',      badge: 'bg-sky-500 text-white',    label: 'Normal' },
  hoch:   { bg: 'bg-amber-50 dark:bg-amber-900/20',   border: 'border-amber-300 dark:border-amber-600',  badge: 'bg-amber-500 text-white',  label: 'Hoch' },
  peak:   { bg: 'bg-red-50 dark:bg-red-900/20',       border: 'border-red-300 dark:border-red-600',      badge: 'bg-red-600 text-white',    label: 'Peak' },
};

const TREND_ICON = { steigend: TrendingUp, stabil: Minus, fallend: TrendingDown };
const TREND_COLOR = { steigend: 'text-green-500', stabil: 'text-slate-400', fallend: 'text-orange-500' };

export function DispatchPhase1253ZoneBestelldichteOverlay({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = () => {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/echtzeit-bestelldichte?location_id=${locationId}`)
      .then(r => r.json())
      .then((d: ApiResponse) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const hotspotCount = data?.hotspot_zonen?.length ?? 0;
  const headerBg = hotspotCount > 0
    ? 'bg-gradient-to-r from-red-500 to-orange-500'
    : 'bg-gradient-to-r from-sky-500 to-indigo-500';

  return (
    <div className="rounded-xl border border-border overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn('w-full flex items-center gap-2 px-4 py-2.5 text-white', headerBg)}
      >
        <Flame className="h-4 w-4 shrink-0" />
        <span className="text-sm font-bold flex-1 text-left">Zone-Bestelldichte</span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin opacity-70" />}
        {hotspotCount > 0 && (
          <span className="flex items-center gap-1 text-xs bg-white/20 rounded-full px-2 py-0.5 font-bold">
            <Zap className="h-3 w-3" />
            {hotspotCount} Hotspot{hotspotCount !== 1 ? 's' : ''}
          </span>
        )}
        {data && (
          <span className="text-xs opacity-80">{data.gesamt_2h} Bestellungen (2h)</span>
        )}
        {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>

      {open && (
        <div className="bg-background p-3 space-y-2">
          {!locationId && (
            <p className="text-sm text-muted-foreground text-center py-2">Bitte Filiale auswählen.</p>
          )}

          {locationId && !data && !loading && (
            <p className="text-sm text-muted-foreground text-center py-2">Keine Daten verfügbar.</p>
          )}

          {/* Hotspot-Alert */}
          {data && hotspotCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2">
              <Zap className="h-4 w-4 text-red-500 shrink-0" />
              <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                Hotspot-Zonen: {data.hotspot_zonen.join(', ')} — erhöhten Fahrerbedarf prüfen!
              </span>
            </div>
          )}

          {/* Zone grid */}
          {data && data.zonen.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.zonen.map((zone) => {
                const style = INTENSITAET_STYLE[zone.intensitaet];
                const TrendIcon = TREND_ICON[zone.trend];
                return (
                  <div
                    key={zone.zone}
                    className={cn(
                      'rounded-lg border px-3 py-2 flex items-center gap-3',
                      style.bg, style.border,
                    )}
                  >
                    {zone.hotspot && <Flame className="h-4 w-4 text-red-500 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold truncate">Zone {zone.zone}</span>
                        <span className={cn('text-[9px] rounded-full px-1.5 py-0.5 font-bold', style.badge)}>
                          {style.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {zone.bestellungen_2h} in 2h · {zone.bestellungen_30min} in 30min
                        </span>
                      </div>
                    </div>
                    <TrendIcon className={cn('h-4 w-4 shrink-0', TREND_COLOR[zone.trend])} />
                  </div>
                );
              })}
            </div>
          )}

          {data?.peak_zone && (
            <p className="text-[11px] text-muted-foreground text-center">
              Stärkste Zone: <strong>{data.peak_zone}</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
