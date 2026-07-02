'use client';

/**
 * KitchenBestellflussMonitorPanel — Phase 517
 *
 * Live-Gauge: Aktuelle Bestellrate (Bestellungen/h) vs. Fahrerkapazität.
 * Alert wenn Auslastung > 80%.
 * Pollt /api/delivery/admin/bestellfluss-monitor alle 60s.
 */

import { useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, Minus, Loader2, Users, Package, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HistorySlot {
  label: string;
  count: number;
}

interface BestellflussData {
  currentRatePerHour: number;
  capacityPerHour: number;
  utilizationPct: number;
  alertLevel: 'ok' | 'busy' | 'critical';
  onlineDrivers: number;
  history: HistorySlot[];
  generatedAt: string;
}

const POLL_MS = 60_000;

interface Props {
  locationId: string | null;
}

export function KitchenBestellflussMonitorPanel({ locationId }: Props) {
  const [data, setData] = useState<BestellflussData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/bestellfluss-monitor?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const alertColors = {
    ok:       { banner: 'bg-matcha-950/40 border-matcha-700', badge: 'bg-matcha-800/60 text-matcha-300', icon: CheckCircle, iconClass: 'text-matcha-400' },
    busy:     { banner: 'bg-amber-950/40 border-amber-700',   badge: 'bg-amber-800/60 text-amber-200',   icon: AlertTriangle, iconClass: 'text-amber-400' },
    critical: { banner: 'bg-red-950/50 border-red-700',       badge: 'bg-red-800/60 text-red-200',       icon: AlertTriangle, iconClass: 'text-red-400' },
  } as const;

  const level = data?.alertLevel ?? 'ok';
  const colors = alertColors[level];
  const Icon = colors.icon;

  const maxHistory = data ? Math.max(...data.history.map((h) => h.count), 1) : 1;

  return (
    <div className={cn('rounded-xl border p-4 space-y-3 transition-colors', colors.banner)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className={cn('h-4 w-4', colors.iconClass)} />
          <span className="text-sm font-bold text-foreground">Bestellfluss-Monitor</span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', colors.badge)}>
              {level === 'ok' ? 'Normal' : level === 'busy' ? 'Auslastung Hoch' : 'Kritisch'}
            </span>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-xs text-muted-foreground hover:text-foreground"
            aria-label={open ? 'Einklappen' : 'Ausklappen'}
          >
            {open ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {open && (
        <>
          {/* KPIs */}
          {data ? (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-black/20 p-2 text-center">
                <Package className="h-3 w-3 mx-auto mb-0.5 text-muted-foreground" />
                <div className="text-lg font-black tabular-nums text-foreground">{data.currentRatePerHour}</div>
                <div className="text-[9px] text-muted-foreground">Bestellungen/h</div>
              </div>
              <div className="rounded-lg bg-black/20 p-2 text-center">
                <Users className="h-3 w-3 mx-auto mb-0.5 text-muted-foreground" />
                <div className="text-lg font-black tabular-nums text-foreground">{data.onlineDrivers}</div>
                <div className="text-[9px] text-muted-foreground">Fahrer online</div>
              </div>
              <div className="rounded-lg bg-black/20 p-2 text-center">
                <Zap className="h-3 w-3 mx-auto mb-0.5 text-muted-foreground" />
                <div className={cn('text-lg font-black tabular-nums', level === 'critical' ? 'text-red-300' : level === 'busy' ? 'text-amber-300' : 'text-matcha-300')}>
                  {data.utilizationPct}%
                </div>
                <div className="text-[9px] text-muted-foreground">Auslastung</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-black/20 animate-pulse" />
              ))}
            </div>
          )}

          {/* Auslastungs-Gauge */}
          {data && (
            <div>
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>Kapazität: {data.capacityPerHour} Bestellungen/h</span>
                <span>{data.utilizationPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-black/30 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    level === 'critical' ? 'bg-red-500' : level === 'busy' ? 'bg-amber-400' : 'bg-matcha-500'
                  )}
                  style={{ width: `${Math.min(100, data.utilizationPct)}%` }}
                />
              </div>
              {level !== 'ok' && (
                <p className={cn('text-[10px] mt-1 font-medium', level === 'critical' ? 'text-red-300' : 'text-amber-300')}>
                  <Icon className="h-3 w-3 inline mr-1" />
                  {level === 'critical'
                    ? 'Kapazitätsgrenze erreicht — mehr Fahrer aktivieren!'
                    : 'Hohe Auslastung — Engpass möglich.'}
                </p>
              )}
            </div>
          )}

          {/* 60-Min-History */}
          {data && data.history.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Letzte 60 Min (je 10 Min)</p>
              <div className="flex items-end gap-1 h-10">
                {data.history.map((slot, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className="w-full rounded-sm bg-matcha-600/60 min-h-[2px] transition-all duration-500"
                      style={{ height: `${Math.max(4, (slot.count / maxHistory) * 32)}px` }}
                    />
                    <span className="text-[8px] text-muted-foreground tabular-nums">{slot.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!locationId && (
            <p className="text-xs text-muted-foreground text-center py-2">Bitte Filiale auswählen.</p>
          )}
        </>
      )}
    </div>
  );
}
