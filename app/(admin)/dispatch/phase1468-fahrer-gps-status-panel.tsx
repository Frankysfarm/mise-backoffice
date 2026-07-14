'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Wifi, WifiOff, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Phase 1468 — Fahrer-GPS-Status-Panel (Dispatch)
// GPS-Aktualität je Fahrer: Letzte Aktualisierung + Freshnessampel;
// Props-basiert; keine API; nach Phase1467.

interface Driver {
  employee_id: string;
  ist_online?: boolean;
  last_lat?: number | null;
  last_lng?: number | null;
  last_update?: string | null;
  employee?: { vorname?: string; nachname?: string } | null;
}

interface Props {
  drivers: Driver[];
}

function ageMin(ts: string | null | undefined): number | null {
  if (!ts) return null;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 60_000);
}

function gpsLevel(min: number | null): 'frisch' | 'veraltet' | 'alt' | 'unbekannt' {
  if (min === null) return 'unbekannt';
  if (min < 2) return 'frisch';
  if (min < 10) return 'veraltet';
  return 'alt';
}

const LEVEL_CFG = {
  frisch:    { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', label: 'Live' },
  veraltet:  { dot: 'bg-amber-400',   badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',         label: 'Veraltet' },
  alt:       { dot: 'bg-rose-500',    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',             label: 'Alt' },
  unbekannt: { dot: 'bg-muted-foreground', badge: 'bg-muted text-muted-foreground',                                           label: '—' },
};

export function DispatchPhase1468FahrerGpsStatusPanel({ drivers }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const onlineDrivers = useMemo(
    () => drivers.filter((d) => d.ist_online),
    [drivers],
  );

  const rows = useMemo(() => onlineDrivers.map((d) => {
    const min = ageMin(d.last_update);
    const level = gpsLevel(min);
    const name = d.employee ? `${d.employee.vorname ?? ''} ${d.employee.nachname ?? ''}`.trim() : d.employee_id.slice(-6);
    const hasGps = d.last_lat != null && d.last_lng != null;
    return { id: d.employee_id, name, min, level, hasGps };
  }), [onlineDrivers, now]);

  if (rows.length === 0) return null;

  const staleCount = rows.filter((r) => r.level === 'alt' || r.level === 'unbekannt').length;

  return (
    <Card className={cn('overflow-hidden', staleCount > 0 && 'border-amber-300 dark:border-amber-700')}>
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition"
        onClick={() => setCollapsed((c) => !c)}
      >
        <MapPin className="h-4 w-4 shrink-0 text-matcha-600" />
        <span className="text-xs font-bold uppercase tracking-wider">GPS-Status</span>
        {staleCount > 0 && (
          <span className="text-[10px] font-bold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5">
            {staleCount} veraltet
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">{rows.length} online</span>
        {collapsed ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {!collapsed && (
        <div className="divide-y">
          {rows.map((r) => {
            const cfg = LEVEL_CFG[r.level];
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', cfg.dot)} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold truncate">{r.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.hasGps
                    ? <Wifi className="h-3 w-3 text-matcha-500" />
                    : <WifiOff className="h-3 w-3 text-muted-foreground" />}
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground tabular-nums">
                    <Clock className="h-3 w-3" />
                    {r.min !== null ? `vor ${r.min} Min` : '—'}
                  </span>
                  <span className={cn('text-[9px] font-bold rounded-full px-1.5 py-0.5', cfg.badge)}>
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
