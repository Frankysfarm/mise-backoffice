'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Activity, Zap, AlertTriangle, CheckCircle2, Pause } from 'lucide-react';

type SignalState = 'normal' | 'extended' | 'paused' | null;

interface Props {
  locationId: string;
}

interface LiveData {
  queue_signal: SignalState;
  eta_min: number | null;
  eta_extension_min: number;
  active_orders: number;
  drivers_online: number;
  load: string;
}

const SIGNAL_CONFIG = {
  normal: {
    color: 'bg-emerald-500',
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-800',
    label: 'Normalbetrieb',
    sublabel: 'Alle Systeme im grünen Bereich',
    icon: CheckCircle2,
    pulse: false,
  },
  extended: {
    color: 'bg-amber-400',
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-800',
    label: 'Erhöhte Wartezeit',
    sublabel: 'ETA wird automatisch verlängert',
    icon: AlertTriangle,
    pulse: true,
  },
  paused: {
    color: 'bg-red-500',
    bg: 'bg-red-50 border-red-300',
    text: 'text-red-800',
    label: 'Pausiert',
    sublabel: 'Keine neuen Bestellungen empfohlen',
    icon: Pause,
    pulse: true,
  },
};

export function SchichtEchtzeitAmpel({ locationId }: Props) {
  const [data, setData] = useState<LiveData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (!locationId) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/eta/live?location_id=${locationId}`, { cache: 'no-store' });
        if (!res.ok) return;
        const d = await res.json();
        setData({
          queue_signal: d.queue_signal ?? 'normal',
          eta_min: d.eta_min ?? null,
          eta_extension_min: d.eta_extension_min ?? 0,
          active_orders: d.active_orders ?? 0,
          drivers_online: d.drivers_online ?? 0,
          load: d.load ?? 'quiet',
        });
        setLastUpdate(new Date());
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const signal = data?.queue_signal ?? 'normal';
  const cfg = SIGNAL_CONFIG[signal] ?? SIGNAL_CONFIG.normal;
  const Icon = cfg.icon;

  return (
    <Card className={cn('overflow-hidden border-2 transition-all', cfg.bg)}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-current/10">
        <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex-1">
          System-Echtzeit-Ampel
        </span>
        {lastUpdate && (
          <span className="text-[9px] text-muted-foreground">
            {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 p-4">
        {/* Traffic light */}
        <div className="flex flex-col gap-1.5 items-center shrink-0">
          {(['normal', 'extended', 'paused'] as const).map((s) => (
            <div
              key={s}
              className={cn(
                'h-4 w-4 rounded-full transition-all duration-500',
                signal === s
                  ? `${SIGNAL_CONFIG[s].color} shadow-lg ${SIGNAL_CONFIG[s].pulse ? 'animate-pulse' : ''}`
                  : 'bg-gray-200',
              )}
            />
          ))}
        </div>

        {/* Status text */}
        <div className="flex-1 min-w-0">
          <div className={cn('flex items-center gap-2 font-bold text-base', cfg.text)}>
            <Icon className={cn('h-4 w-4 shrink-0', cfg.pulse ? 'animate-pulse' : '')} />
            {cfg.label}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{cfg.sublabel}</div>
          {data?.eta_extension_min != null && data.eta_extension_min > 0 && (
            <div className="text-xs font-semibold text-amber-700 mt-0.5">
              +{data.eta_extension_min} Min ETA-Verlängerung aktiv
            </div>
          )}
        </div>

        {/* Live KPIs */}
        {data && (
          <div className="grid grid-cols-2 gap-2 shrink-0 text-right">
            <div>
              <div className="text-[10px] text-muted-foreground">Aktive Orders</div>
              <div className="font-black text-lg leading-tight tabular-nums">{data.active_orders}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Fahrer online</div>
              <div className="font-black text-lg leading-tight tabular-nums text-matcha-700">{data.drivers_online}</div>
            </div>
            {data.eta_min != null && (
              <div className="col-span-2">
                <div className="text-[10px] text-muted-foreground">Ø Lieferzeit</div>
                <div className="font-black text-base leading-tight tabular-nums">~{data.eta_min} Min</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Load bar */}
      {data && (
        <div className="px-4 pb-3">
          <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
            <span className="uppercase font-bold">Systemlast</span>
            <span className="capitalize font-bold">{data.load}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', cfg.color)}
              style={{
                width: data.load === 'peak' ? '95%' : data.load === 'busy' ? '70%' : data.load === 'normal' ? '45%' : '20%',
              }}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
