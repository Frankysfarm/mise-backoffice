'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, MapPin, RefreshCw, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1145 — Fahrer-Rückkehr-Timeline (Dispatch)
// Zeigt wann jeder aktive Fahrer vom aktuellen Tour zurückerwartet wird

interface FahrerRueckkehr {
  driverId: string;
  driverName: string;
  currentStop: number;
  totalStops: number;
  etaMinutes: number;
  status: 'on_tour' | 'returning' | 'arrived';
  zone?: string;
}

interface ApiResponse {
  drivers: FahrerRueckkehr[];
  updatedAt: string;
}

interface Props {
  locationId: string | null;
}

function mockData(): FahrerRueckkehr[] {
  const now = new Date();
  return [
    { driverId: 'd1', driverName: 'Marco S.', currentStop: 2, totalStops: 3, etaMinutes: 8, status: 'on_tour', zone: 'Nord' },
    { driverId: 'd2', driverName: 'Jana K.', currentStop: 3, totalStops: 3, etaMinutes: 4, status: 'returning', zone: 'Mitte' },
    { driverId: 'd3', driverName: 'Tom H.', currentStop: 1, totalStops: 4, etaMinutes: 22, status: 'on_tour', zone: 'Süd' },
  ];
}

export function DispatchPhase1145FahrerRueckkehrTimeline({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [drivers, setDrivers] = useState<FahrerRueckkehr[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  async function load() {
    if (!locationId) { setDrivers(mockData()); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/tour-rueckkehr-eta?locationId=${locationId}`);
      if (res.ok) {
        const data: ApiResponse = await res.json();
        setDrivers(data.drivers ?? []);
        setLastUpdated(data.updatedAt ?? null);
      } else {
        setDrivers(mockData());
      }
    } catch {
      setDrivers(mockData());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [locationId]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [open, locationId]);

  const sorted = [...drivers].sort((a, b) => a.etaMinutes - b.etaMinutes);

  function etaColor(min: number, status: string): string {
    if (status === 'arrived') return 'text-emerald-600 dark:text-emerald-400';
    if (min <= 5) return 'text-emerald-600 dark:text-emerald-400';
    if (min <= 12) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  }

  function statusBadge(status: string, etaMin: number) {
    if (status === 'arrived') return <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[9px] font-bold">Zurück</span>;
    if (status === 'returning') return <span className="rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 text-[9px] font-bold">Rückkehr</span>;
    return <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[9px] font-bold">Auf Tour</span>;
  }

  const soonCount = sorted.filter(d => d.etaMinutes <= 8 && d.status !== 'arrived').length;

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="font-bold text-sm text-blue-700 dark:text-blue-300">Fahrer-Rückkehr-Timeline</span>
          {soonCount > 0 && (
            <span className="rounded-full bg-blue-200 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 px-2 py-0.5 text-[10px] font-bold">
              {soonCount} bald zurück
            </span>
          )}
          {drivers.length === 0 && !loading && (
            <span className="text-[10px] text-muted-foreground">Keine aktiven Fahrer</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
          {open
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-blue-200 dark:border-blue-800 px-4 pb-4 pt-3 space-y-2">
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">Keine aktiven Fahrer auf Tour.</p>
          )}

          {sorted.map(d => {
            const pct = d.totalStops > 0
              ? Math.round((d.currentStop / d.totalStops) * 100)
              : 0;

            return (
              <div
                key={d.driverId}
                className="flex items-center gap-3 rounded-lg bg-white/70 dark:bg-black/20 border border-blue-100 dark:border-blue-900 px-3 py-2.5"
              >
                {/* Avatar */}
                <div className="h-8 w-8 shrink-0 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center text-xs font-black text-blue-700 dark:text-blue-200">
                  {d.driverName.split(' ').map(p => p[0]).join('')}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[12px] font-bold text-foreground truncate">{d.driverName}</span>
                    {statusBadge(d.status, d.etaMinutes)}
                    {d.zone && (
                      <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                        <MapPin className="h-2.5 w-2.5" />{d.zone}
                      </span>
                    )}
                  </div>
                  {/* Stop-Fortschritt */}
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-blue-100 dark:bg-blue-900/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-muted-foreground whitespace-nowrap">
                      {d.currentStop}/{d.totalStops} Stopps
                    </span>
                  </div>
                </div>

                {/* ETA */}
                <div className="shrink-0 text-right">
                  <div className={cn('text-base font-black tabular-nums', etaColor(d.etaMinutes, d.status))}>
                    {d.status === 'arrived' ? '—' : `~${d.etaMinutes}'`}
                  </div>
                  <div className="flex items-center gap-0.5 justify-end text-[9px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" />
                    <span>ETA</span>
                  </div>
                </div>
              </div>
            );
          })}

          {lastUpdated && (
            <p className="text-[9px] text-muted-foreground text-right pt-1">
              Aktualisiert: {new Date(lastUpdated).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
