'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, MapPin, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ZoneSlaMonitorResponse, ZoneSlaData, SlaAmpel } from '@/app/api/delivery/admin/zone-sla-monitor/route';

const AMPEL_CFG: Record<SlaAmpel, { text: string; dot: string; badge: string }> = {
  gruen: { text: 'text-matcha-700', dot: 'bg-matcha-500', badge: 'bg-matcha-100 text-matcha-800' },
  gelb:  { text: 'text-amber-700',  dot: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-800' },
  rot:   { text: 'text-red-700',    dot: 'bg-red-500',    badge: 'bg-red-100 text-red-800' },
};

function ZoneRow({ z }: { z: ZoneSlaData }) {
  const cfg = AMPEL_CFG[z.sla_ampel];
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-stone-50 last:border-0">
      <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', cfg.dot, z.sla_ampel === 'rot' && 'animate-pulse')} />
      <div className="flex-1 min-w-0">
        <div className={cn('text-sm font-bold truncate', cfg.text)}>{z.zone_name}</div>
        <div className="text-[10px] text-stone-400">
          {z.gesamt_lieferungen} Lieferungen · Ø {z.avg_lieferzeit_min} Min
        </div>
      </div>
      <div className="shrink-0 text-right">
        <span className={cn('text-xs font-black tabular-nums px-2 py-0.5 rounded-full', cfg.badge)}>
          {z.puenktlichkeit_pct.toFixed(1)}%
        </span>
        <div className="text-[9px] text-stone-400 mt-0.5">Pünktl.</div>
      </div>
    </div>
  );
}

export function DispatchPhase1669ZoneSlaMonitorWidget({
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
  const gesamtAmpel: SlaAmpel = data.gesamt_puenktlichkeit_pct >= 88 ? 'gruen' : data.gesamt_puenktlichkeit_pct >= 80 ? 'gelb' : 'rot';
  const gesamtCfg = AMPEL_CFG[gesamtAmpel];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b bg-stone-50 hover:bg-stone-100 transition-colors"
      >
        <MapPin className="h-4 w-4 text-saffron shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider text-stone-700">
          Zonen SLA-Monitor
        </span>
        {hasAlert && (
          <span className="flex items-center gap-1 text-[9px] font-black bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">
            <AlertTriangle className="h-2.5 w-2.5" />
            {data.alert_zonen.length} ALERT
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className={cn('text-sm font-black tabular-nums', gesamtCfg.text)}>
            {data.gesamt_puenktlichkeit_pct.toFixed(1)}% gesamt
          </span>
          <span className="text-[10px] text-stone-400">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <>
          {/* Alert banner */}
          {hasAlert && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border-b border-red-100">
              <TrendingDown className="h-4 w-4 text-red-600 shrink-0" />
              <span className="text-xs font-bold text-red-700">
                SLA-Unterschreitung (&lt;80%) in: {data.alert_zonen.join(', ')}
              </span>
            </div>
          )}

          {/* Zone rows */}
          <div className="px-4">
            {data.zonen.map(z => <ZoneRow key={z.zone_name} z={z} />)}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-1.5 px-4 py-2 border-t bg-stone-50">
            <Clock className="h-3 w-3 text-stone-400" />
            <span className="text-[10px] text-stone-400">
              Letzte 2h · SLA-Ziel: ≥85% in ≤45 Min · 5-Min-Polling
            </span>
          </div>
        </>
      )}
    </div>
  );
}
