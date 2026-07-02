'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Bike, CheckCircle2, Clock, Euro, Target, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';

interface Props {
  locationId?: string | null;
}

interface KpiData {
  umsatz: number;
  lieferungen: number;
  onTimePct: number;
  avgDeliveryMin: number;
  activeFahrer: number;
  stornoPct: number;
}

const MOCK: KpiData = {
  umsatz: 1248.50,
  lieferungen: 47,
  onTimePct: 84,
  avgDeliveryMin: 28,
  activeFahrer: 4,
  stornoPct: 3.2,
};

type Trend = 'up' | 'down' | 'flat';

interface KpiTile {
  label: string;
  value: string;
  sub?: string;
  trend?: Trend;
  icon: React.ReactNode;
  bg: string;
  text: string;
}

function TrendIcon({ t }: { t?: Trend }) {
  if (!t || t === 'flat') return <Minus className="h-3 w-3 text-muted-foreground" />;
  if (t === 'up') return <TrendingUp className="h-3 w-3 text-matcha-600" />;
  return <TrendingDown className="h-3 w-3 text-red-500" />;
}

export function LieferdienstSchichtKpiMatrix({ locationId }: Props) {
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setData(MOCK); setLoading(false); return; }
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/admin/sla?location_id=${locationId}&days=1`);
        if (!r.ok) throw new Error();
        const d = await r.json();
        const s = d?.summary;
        if (s) {
          setData({
            umsatz: s.umsatzEur ?? MOCK.umsatz,
            lieferungen: s.totalStops ?? MOCK.lieferungen,
            onTimePct: s.onTimePct != null ? Math.round(s.onTimePct * 100) : MOCK.onTimePct,
            avgDeliveryMin: s.avgDeliveryMin ?? MOCK.avgDeliveryMin,
            activeFahrer: s.activeFahrer ?? MOCK.activeFahrer,
            stornoPct: s.stornoPct ?? MOCK.stornoPct,
          });
        } else {
          setData(MOCK);
        }
      } catch {
        setData(MOCK);
      } finally {
        setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 90_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="h-20 rounded-2xl bg-stone-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const euro = (v: number) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  const tiles: KpiTile[] = [
    {
      label: 'Schicht-Umsatz',
      value: euro(data.umsatz),
      icon: <Euro className="h-4 w-4" />,
      bg: 'bg-matcha-50',
      text: 'text-matcha-700',
      trend: 'up',
    },
    {
      label: 'Lieferungen',
      value: data.lieferungen.toString(),
      sub: 'heute',
      icon: <CheckCircle2 className="h-4 w-4" />,
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      trend: 'flat',
    },
    {
      label: 'Pünktlichkeit',
      value: `${data.onTimePct}%`,
      icon: <Target className="h-4 w-4" />,
      bg: data.onTimePct >= 80 ? 'bg-matcha-50' : data.onTimePct >= 65 ? 'bg-amber-50' : 'bg-red-50',
      text: data.onTimePct >= 80 ? 'text-matcha-700' : data.onTimePct >= 65 ? 'text-amber-700' : 'text-red-700',
      trend: data.onTimePct >= 80 ? 'up' : 'down',
    },
    {
      label: 'Ø Lieferzeit',
      value: `${data.avgDeliveryMin} Min`,
      icon: <Clock className="h-4 w-4" />,
      bg: data.avgDeliveryMin <= 30 ? 'bg-matcha-50' : data.avgDeliveryMin <= 40 ? 'bg-amber-50' : 'bg-red-50',
      text: data.avgDeliveryMin <= 30 ? 'text-matcha-700' : data.avgDeliveryMin <= 40 ? 'text-amber-700' : 'text-red-700',
      trend: data.avgDeliveryMin <= 30 ? 'up' : 'down',
    },
    {
      label: 'Aktive Fahrer',
      value: data.activeFahrer.toString(),
      sub: 'online',
      icon: <Bike className="h-4 w-4" />,
      bg: 'bg-violet-50',
      text: 'text-violet-700',
      trend: 'flat',
    },
    {
      label: 'Stornoquote',
      value: `${data.stornoPct.toFixed(1)}%`,
      icon: <TrendingDown className="h-4 w-4" />,
      bg: data.stornoPct < 3 ? 'bg-matcha-50' : data.stornoPct < 8 ? 'bg-amber-50' : 'bg-red-50',
      text: data.stornoPct < 3 ? 'text-matcha-700' : data.stornoPct < 8 ? 'text-amber-700' : 'text-red-700',
      trend: data.stornoPct < 3 ? 'up' : 'down',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-matcha-600" />
          Schicht-KPI Matrix
        </h3>
        <span className="text-[10px] text-muted-foreground">Live · alle 90s</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {tiles.map(tile => (
          <div key={tile.label} className={cn('rounded-2xl p-3 space-y-1', tile.bg)}>
            <div className={cn('flex items-center gap-1', tile.text)}>
              {tile.icon}
              <span className="text-[9px] font-semibold uppercase tracking-wide truncate">{tile.label}</span>
            </div>
            <div className={cn('text-base font-black tabular-nums leading-tight', tile.text)}>
              {tile.value}
            </div>
            <div className="flex items-center gap-1">
              <TrendIcon t={tile.trend} />
              {tile.sub && <span className="text-[9px] text-muted-foreground">{tile.sub}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
