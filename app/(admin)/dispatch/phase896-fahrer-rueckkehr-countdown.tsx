'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Timer, MapPin, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

/**
 * Phase 896 — Fahrer-Rückkehr-Countdown
 *
 * Countdown-Liste wann jeder aktive Fahrer zurückkehrt.
 * ETR = verbleibende Stopps × Ø-Stoppzeit basierend auf Haversine-Distanz.
 */

interface FahrerEtr {
  driver_id: string;
  driver_name: string;
  vehicle_type: string;
  stopps_gesamt: number;
  stopps_verbleibend: number;
  etr_minuten: number;
  aktuelle_zone: string | null;
  status: string;
}

interface ApiResponse {
  fahrer: FahrerEtr[];
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const VEHICLE_ICON: Record<string, string> = {
  bike: '🚲',
  scooter: '🛵',
  car: '🚗',
  ebike: '⚡🚲',
};
const ZONE_COLOR: Record<string, string> = {
  A: 'text-matcha-600',
  B: 'text-blue-600',
  C: 'text-amber-600',
  D: 'text-red-600',
};

const MOCK: ApiResponse = {
  fahrer: [
    { driver_id: '1', driver_name: 'Max M.', vehicle_type: 'scooter', stopps_gesamt: 3, stopps_verbleibend: 1, etr_minuten: 8, aktuelle_zone: 'A', status: 'unterwegs' },
    { driver_id: '2', driver_name: 'Sarah K.', vehicle_type: 'bike', stopps_gesamt: 4, stopps_verbleibend: 3, etr_minuten: 22, aktuelle_zone: 'B', status: 'unterwegs' },
    { driver_id: '3', driver_name: 'Tom R.', vehicle_type: 'car', stopps_gesamt: 2, stopps_verbleibend: 2, etr_minuten: 15, aktuelle_zone: 'C', status: 'unterwegs' },
  ],
  generatedAt: new Date().toISOString(),
};

export function DispatchPhase896FahrerRueckkehrCountdown({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-rueckkehr-countdown?location_id=${locationId}`);
        if (!cancelled) setData(res.ok ? await res.json() : MOCK);
      } catch {
        if (!cancelled) setData(MOCK);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 90_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId]);

  const fahrer = data?.fahrer ?? [];
  const sorted = [...fahrer].sort((a, b) => a.etr_minuten - b.etr_minuten);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/30 transition text-left"
      >
        <Timer className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Fahrer-Rückkehr-Countdown
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        {!loading && fahrer.length > 0 && (
          <span className="rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-black px-2 py-0.5">
            {fahrer.length} aktiv
          </span>
        )}
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {!locationId && (
            <p className="text-sm text-muted-foreground">Bitte Filiale auswählen.</p>
          )}
          {locationId && !loading && sorted.length === 0 && (
            <p className="text-sm text-muted-foreground">Keine aktiven Fahrer.</p>
          )}
          {sorted.map(f => {
            const urgency = f.etr_minuten <= 5 ? 'rot' : f.etr_minuten <= 12 ? 'amber' : 'gruen';
            return (
              <div
                key={f.driver_id}
                className="flex items-center gap-3 rounded-lg border border-border bg-background/60 px-3 py-2.5"
              >
                <span className="text-lg shrink-0">{VEHICLE_ICON[f.vehicle_type] ?? '🚗'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-foreground truncate">{f.driver_name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className={cn(
                      'text-[10px] font-semibold',
                      f.aktuelle_zone ? ZONE_COLOR[f.aktuelle_zone] : 'text-muted-foreground',
                    )}>
                      Zone {f.aktuelle_zone ?? '?'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {f.stopps_verbleibend}/{f.stopps_gesamt} Stopps
                    </span>
                  </div>
                </div>
                <div className={cn(
                  'flex items-center gap-1 rounded-lg px-2.5 py-1.5 shrink-0',
                  urgency === 'rot' ? 'bg-matcha-500 text-white animate-pulse' :
                  urgency === 'amber' ? 'bg-amber-400 text-white' :
                  'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
                )}>
                  <Timer className="h-3 w-3" />
                  <span className="text-[11px] font-black tabular-nums">
                    {f.etr_minuten} Min
                  </span>
                </div>
              </div>
            );
          })}
          {data && (
            <p className="text-[9px] text-muted-foreground text-right">
              ETR = verbleibende Stopps × Ø-Stoppzeit · 90s-Refresh
            </p>
          )}
        </div>
      )}
    </div>
  );
}
