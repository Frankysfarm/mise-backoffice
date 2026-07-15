'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, MapPin, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ZoneSlaMonitorResponse } from '@/app/api/delivery/admin/zone-sla-monitor/route';

export function LieferdienstPhase1621ZoneLeistungsUebersicht({
  locationId,
}: {
  locationId: string | null;
}) {
  const [data, setData] = useState<ZoneSlaMonitorResponse | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const url = locationId
      ? `/api/delivery/admin/zone-sla-monitor?location_id=${locationId}`
      : '/api/delivery/admin/zone-sla-monitor';

    const load = () => {
      fetch(url, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setData(d); })
        .catch(() => {});
    };

    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!data) return null;

  const hasAlert = data.alert_zonen.length > 0;
  const gesamtColor =
    data.gesamt_puenktlichkeit_pct >= 88 ? 'text-matcha-700' :
    data.gesamt_puenktlichkeit_pct >= 80 ? 'text-amber-700' : 'text-red-700';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b bg-stone-50 hover:bg-stone-100 transition-colors text-left"
      >
        <MapPin className="h-4 w-4 text-saffron shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider text-stone-700">
          Zonen-Leistungs-Übersicht
        </span>
        {hasAlert && (
          <span className="flex items-center gap-1 text-[9px] font-black bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">
            <AlertTriangle className="h-2.5 w-2.5" />
            {data.alert_zonen.length} Alert
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className={cn('text-sm font-black tabular-nums', gesamtColor)}>
            {data.gesamt_puenktlichkeit_pct.toFixed(1)}%
          </span>
          <span className="text-[10px] text-stone-400">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <>
          {/* Alert */}
          {hasAlert && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-100">
              <TrendingDown className="h-4 w-4 text-red-600 shrink-0" />
              <span className="text-xs font-bold text-red-700">
                SLA unter 80% in: {data.alert_zonen.join(', ')}
              </span>
            </div>
          )}

          {/* Zone grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3">
            {data.zonen.map(z => {
              const isAlert = z.sla_ampel === 'rot';
              const isWarn  = z.sla_ampel === 'gelb';
              return (
                <div
                  key={z.zone_name}
                  className={cn(
                    'rounded-xl border p-3',
                    isAlert ? 'bg-red-50 border-red-200' :
                    isWarn  ? 'bg-amber-50 border-amber-200' : 'bg-matcha-50 border-matcha-200',
                  )}
                >
                  <div className={cn(
                    'text-[10px] font-black uppercase tracking-wide mb-1 truncate',
                    isAlert ? 'text-red-700' : isWarn ? 'text-amber-700' : 'text-matcha-700',
                  )}>
                    {z.zone_name}
                  </div>
                  <div className={cn(
                    'text-xl font-black tabular-nums',
                    isAlert ? 'text-red-700' : isWarn ? 'text-amber-700' : 'text-matcha-700',
                  )}>
                    {z.puenktlichkeit_pct.toFixed(0)}%
                  </div>
                  <div className="text-[9px] text-stone-500 mt-1">
                    {z.gesamt_lieferungen} Liefg. · Ø {z.avg_lieferzeit_min}m
                  </div>
                  {isAlert && (
                    <TrendingDown className="h-3 w-3 text-red-500 mt-1" />
                  )}
                  {!isAlert && !isWarn && (
                    <TrendingUp className="h-3 w-3 text-matcha-500 mt-1" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-4 pb-2 text-[10px] text-stone-400">
            Letzte 2h · SLA-Ziel ≥85% · 5-Min-Refresh
          </div>
        </>
      )}
    </div>
  );
}
