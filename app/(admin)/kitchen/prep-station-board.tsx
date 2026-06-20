'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Flame, Snowflake, Coffee, Package, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string;
  items: { id: string; name: string; menge: number }[];
};

type KitchenTiming = {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
}

type Station = 'heiß' | 'kalt' | 'getränke' | 'verpackung';

const STATION_CONFIG: Record<Station, {
  label: string; icon: typeof Flame; bg: string; border: string; text: string; iconClass: string;
}> = {
  heiß:       { label: 'Heiß',       icon: Flame,     bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    iconClass: 'text-red-500'    },
  kalt:       { label: 'Kalt',       icon: Snowflake, bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   iconClass: 'text-blue-500'   },
  getränke:   { label: 'Getränke',   icon: Coffee,    bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  iconClass: 'text-amber-500'  },
  verpackung: { label: 'Verpackung', icon: Package,   bg: 'bg-matcha-50', border: 'border-matcha-200', text: 'text-matcha-700', iconClass: 'text-matcha-600' },
};

const HOT_KEYWORDS = ['pizza', 'burger', 'pasta', 'suppe', 'schnitzel', 'döner', 'fleisch', 'warm', 'grill', 'falafel', 'currywurst', 'pommes', 'nugget', 'wrap'];
const COLD_KEYWORDS = ['salat', 'sushi', 'kalte', 'dessert', 'eis', 'bowl', 'gazpacho'];
const DRINK_KEYWORDS = ['cola', 'wasser', 'saft', 'bier', 'wein', 'kaffee', 'tee', 'limo', 'getränk', 'shake', 'smoothie'];

function classifyItem(name: string): Station {
  const lower = name.toLowerCase();
  if (DRINK_KEYWORDS.some((k) => lower.includes(k))) return 'getränke';
  if (COLD_KEYWORDS.some((k) => lower.includes(k))) return 'kalt';
  if (HOT_KEYWORDS.some((k) => lower.includes(k))) return 'heiß';
  return 'verpackung';
}

function useTick() {
  const [, setN] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setN((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

function fmtSec(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sec < 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`;
}

export function KitchenPrepStationBoard({ orders, timings }: Props) {
  useTick();
  const now = Date.now();
  const timingMap = new Map(timings.map((t) => [t.order_id, t]));

  const active = orders.filter((o) => ['bestätigt', 'in_zubereitung'].includes(o.status));
  if (active.length === 0) return null;

  type StationEntry = {
    orderId: string;
    bestellnummer: string;
    kundenname: string;
    station: Station;
    remainSec: number | null;
    urgent: boolean;
  };

  const grouped: Record<Station, StationEntry[]> = { heiß: [], kalt: [], getränke: [], verpackung: [] };

  for (const o of active) {
    const t = timingMap.get(o.id);
    let remainSec: number | null = null;
    if (t?.ready_target) {
      remainSec = Math.floor((new Date(t.ready_target).getTime() - now) / 1000);
    } else if (o.bestellt_am) {
      const prepMin = t?.prep_min ?? o.geschaetzte_zubereitung_min ?? 20;
      const elapsed = (now - new Date(o.bestellt_am).getTime()) / 1000;
      remainSec = Math.floor(prepMin * 60 - elapsed);
    }

    const dominant = (o.items ?? []).reduce<Record<Station, number>>(
      (acc, item) => {
        const st = classifyItem(item.name);
        acc[st] = (acc[st] ?? 0) + item.menge;
        return acc;
      },
      { heiß: 0, kalt: 0, getränke: 0, verpackung: 0 },
    );
    const station = (Object.entries(dominant).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'heiß') as Station;

    grouped[station].push({
      orderId: o.id,
      bestellnummer: o.bestellnummer,
      kundenname: o.kunde_name,
      station,
      remainSec,
      urgent: remainSec !== null && remainSec < 180,
    });
  }

  const usedStations = (Object.keys(grouped) as Station[]).filter((s) => grouped[s].length > 0);
  if (usedStations.length === 0) return null;

  const criticalTotal = usedStations.flatMap((s) => grouped[s]).filter((e) => e.urgent).length;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className={cn('flex items-center gap-2 px-3 py-2', criticalTotal > 0 ? 'bg-red-600' : 'bg-matcha-600')}>
        <Flame className="h-4 w-4 text-white" />
        <span className="text-xs font-black uppercase tracking-wider text-white">
          Stations-Board · {active.length} aktiv
        </span>
        {criticalTotal > 0 && (
          <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
            {criticalTotal} dringend
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-px bg-border">
        {usedStations.map((station) => {
          const cfg = STATION_CONFIG[station];
          const Icon = cfg.icon;
          const entries = grouped[station];
          return (
            <div key={station} className={cn('p-3 space-y-2', cfg.bg)}>
              <div className="flex items-center gap-1.5">
                <Icon size={13} className={cfg.iconClass} />
                <span className={cn('text-[11px] font-bold uppercase', cfg.text)}>{cfg.label}</span>
                <span className={cn('ml-auto rounded-full text-[9px] font-bold px-1.5 py-0.5', cfg.text, cfg.border, 'border bg-white/50')}>
                  {entries.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {entries.slice(0, 4).map((e) => (
                  <div key={e.orderId} className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5 border', e.urgent ? 'bg-red-50 border-red-200' : 'bg-white/60 border-border')}>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-mono text-muted-foreground">#{e.bestellnummer}</div>
                      <div className="text-[11px] font-semibold truncate">{e.kundenname}</div>
                    </div>
                    {e.remainSec !== null ? (
                      <div className={cn('font-mono text-xs font-black tabular-nums shrink-0', e.urgent ? 'text-red-600 animate-pulse' : cfg.text)}>
                        {fmtSec(e.remainSec)}
                      </div>
                    ) : (
                      <Clock size={11} className="text-muted-foreground shrink-0" />
                    )}
                    {e.urgent && <AlertTriangle size={11} className="text-red-500 shrink-0 animate-pulse" />}
                  </div>
                ))}
                {entries.length > 4 && (
                  <div className="text-[9px] text-muted-foreground text-center">+{entries.length - 4} weitere</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
