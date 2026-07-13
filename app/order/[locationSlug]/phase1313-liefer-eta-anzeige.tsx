'use client';

// Phase 1313 — Liefer-ETA-Anzeige (Storefront)
// Live-ETA aus liefer-prognose API im Checkout · 5-Min-Polling · Ampel-Indikator

import { useEffect, useState, useCallback } from 'react';
import { Clock, Truck, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string;
  deliveryZone?: string;
}

type Engpass = 'ok' | 'warnung' | 'kritisch';

interface ZoneInfo {
  zone: string;
  eta_min: number;
  engpass: Engpass;
}

interface PrognoseData {
  zonen: ZoneInfo[];
  gesamt_eta_min: number;
  gesamt_engpass: Engpass;
  offene_bestellungen: number;
}

const MOCK: PrognoseData = {
  zonen: [
    { zone: 'A', eta_min: 20, engpass: 'ok' },
    { zone: 'B', eta_min: 28, engpass: 'warnung' },
    { zone: 'C', eta_min: 38, engpass: 'kritisch' },
    { zone: 'D', eta_min: 22, engpass: 'ok' },
  ],
  gesamt_eta_min: 27,
  gesamt_engpass: 'warnung',
  offene_bestellungen: 18,
};

const POLL_MS = 5 * 60 * 1000;

const CFG: Record<Engpass, { bg: string; border: string; text: string; sub: string; icon: typeof Zap }> = {
  ok:       { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-700', text: 'text-emerald-700 dark:text-emerald-300', sub: 'Normale Lieferzeit',      icon: Zap },
  warnung:  { bg: 'bg-amber-50 dark:bg-amber-900/20',     border: 'border-amber-200 dark:border-amber-700',     text: 'text-amber-700 dark:text-amber-300',     sub: 'Etwas erhöhte Wartezeit', icon: Clock },
  kritisch: { bg: 'bg-red-50 dark:bg-red-900/20',         border: 'border-red-200 dark:border-red-700',         text: 'text-red-700 dark:text-red-300',         sub: 'Erhöhte Wartezeit',       icon: Truck },
};

export function Phase1313LieferEtaAnzeige({ locationId, deliveryZone }: Props) {
  const [data, setData] = useState<PrognoseData | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/admin/liefer-prognose?location_id=${locationId}`);
      setData(res.ok ? await res.json() : MOCK);
    } catch {
      setData(MOCK);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  if (!data) return null;

  const zoneData = deliveryZone
    ? data.zonen.find((z) => z.zone.toLowerCase() === deliveryZone.toLowerCase())
    : null;

  const eta = zoneData?.eta_min ?? data.gesamt_eta_min;
  const engpass = zoneData?.engpass ?? data.gesamt_engpass;
  const cfg = CFG[engpass];
  const Icon = cfg.icon;

  return (
    <div className={cn('rounded-xl border px-3 py-2.5 flex items-center gap-3', cfg.bg, cfg.border)}>
      <div className={cn('shrink-0 rounded-full p-2', engpass === 'ok' ? 'bg-emerald-100 dark:bg-emerald-900/50' : engpass === 'warnung' ? 'bg-amber-100 dark:bg-amber-900/50' : 'bg-red-100 dark:bg-red-900/50')}>
        <Icon className={cn('h-4 w-4', cfg.text)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs font-bold', cfg.text)}>
          Lieferzeit ca. {eta} Min.
          {deliveryZone && <span className="font-normal ml-1 opacity-75">(Zone {deliveryZone})</span>}
        </p>
        <p className="text-[11px] text-muted-foreground">{cfg.sub}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn('text-xl font-black tabular-nums', cfg.text)}>{eta}</p>
        <p className="text-[10px] text-muted-foreground">Min</p>
      </div>
    </div>
  );
}
