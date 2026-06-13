'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Activity, Zap, Wind, AlertTriangle } from 'lucide-react';

type OpsLoad = 'calm' | 'normal' | 'busy' | 'storm';

type OpsStatus = {
  load: OpsLoad;
  eta_min: number;
  active_orders: number;
  drivers_online: number;
};

const LOAD_META: Record<OpsLoad, { label: string; icon: typeof Activity; color: string; bg: string; desc: string }> = {
  calm:   { label: 'Ruhig',         icon: Wind,          color: 'text-matcha-700', bg: 'bg-matcha-50 border-matcha-200',   desc: 'Alles entspannt' },
  normal: { label: 'Normal',        icon: Activity,      color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',       desc: 'Normales Bestellvolumen' },
  busy:   { label: 'Ausgelastet',   icon: Zap,           color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',     desc: 'Hohes Aufkommen' },
  storm:  { label: 'Sturm!',        icon: AlertTriangle, color: 'text-red-700',    bg: 'bg-red-50 border-red-200',         desc: 'Kritische Auslastung' },
};

export function OpsStatusWidget({ locationId }: { locationId?: string | null }) {
  const [status, setStatus] = useState<OpsStatus | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!locationId) return;
    const load = () => {
      fetch(`/api/delivery/eta/live?location_id=${locationId}`)
        .then(r => r.ok ? r.json() : null)
        .then((d: any) => {
          if (!d?.eta_min) return;
          const active = d.active_orders ?? 0;
          const online = d.drivers_online ?? 0;
          const eta = d.eta_min ?? 30;
          // Derive load from utilization and ETA
          let load: OpsLoad = 'calm';
          if (online > 0 && active / online > 2.5) load = 'storm';
          else if (eta > 45 || (online > 0 && active / online > 1.8)) load = 'busy';
          else if (active > 0) load = 'normal';
          setStatus({ load, eta_min: eta, active_orders: active, drivers_online: online });
          setLastUpdated(new Date());
        })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!status) return null;

  const meta = LOAD_META[status.load];
  const Icon = meta.icon;

  return (
    <div className={cn('rounded-xl border px-4 py-3 flex items-center gap-4', meta.bg)}>
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', meta.color, 'bg-white/60')}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('font-display text-sm font-black', meta.color)}>{meta.label}</span>
          <span className="text-[10px] text-muted-foreground">— {meta.desc}</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
          <span>~{status.eta_min} Min ETA</span>
          <span>·</span>
          <span>{status.active_orders} aktive Bestellungen</span>
          <span>·</span>
          <span>{status.drivers_online} Fahrer online</span>
        </div>
      </div>
      {/* Utilization gauge */}
      {status.drivers_online > 0 && (
        <div className="shrink-0 text-right">
          <div className={cn('text-lg font-black tabular-nums', meta.color)}>
            {Math.round((status.active_orders / status.drivers_online) * 10) / 10}×
          </div>
          <div className="text-[9px] text-muted-foreground">Auslastung/Fahrer</div>
        </div>
      )}
      {lastUpdated && (
        <div className="shrink-0 text-[9px] text-muted-foreground opacity-60">
          {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </div>
  );
}
