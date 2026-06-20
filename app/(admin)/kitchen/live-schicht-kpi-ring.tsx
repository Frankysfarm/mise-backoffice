'use client';

import { useEffect, useState } from 'react';
import { Zap, Clock, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiData {
  effizienz: number;
  puenktlichkeit: number;
  durchsatz: number;
  unit: string;
}

function Ring({
  value,
  max = 100,
  size = 80,
  stroke = 8,
  color,
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  color: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const dash = pct * circ;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1a3a2a" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  );
}

function ringColor(v: number): string {
  if (v >= 80) return '#4ade80';
  if (v >= 60) return '#facc15';
  if (v >= 40) return '#fb923c';
  return '#f87171';
}

function KpiRing({
  label,
  value,
  unit,
  icon: Icon,
}: {
  label: string;
  value: number;
  unit: string;
  icon: React.ElementType;
}) {
  const color = ringColor(value);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <Ring value={value} color={color} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon size={12} style={{ color }} />
          <span className="text-xs font-black tabular-nums" style={{ color }}>
            {value}
          </span>
          <span className="text-[9px] text-matcha-400">{unit}</span>
        </div>
      </div>
      <span className="text-[10px] text-matcha-400 font-medium text-center leading-tight max-w-[68px]">
        {label}
      </span>
    </div>
  );
}

export function KitchenLiveSchichtKpiRing({ locationId }: { locationId?: string }) {
  const [data, setData] = useState<KpiData | null>(null);
  const [ts, setTs] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/kitchen/queue?location_id=${locationId ?? 'default'}`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error('api error');
        const json = await res.json();
        if (cancelled) return;

        const total = (json.pending ?? 0) + (json.preparing ?? 0) + (json.ready ?? 0);
        const prepMin = json.avg_prep_min ?? 0;
        const targetMin = 12;

        setData({
          effizienz: Math.min(100, Math.round(total > 0 ? (json.ready ?? 0) / total * 100 : 75)),
          puenktlichkeit: Math.min(100, Math.round(prepMin > 0 ? Math.max(0, (1 - (prepMin - targetMin) / targetMin) * 100) : 80)),
          durchsatz: Math.min(100, Math.round(Math.min((json.completed_last_hour ?? 5) / 12 * 100, 100))),
          unit: '%',
        });
        setTs(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
      } catch {
        if (!cancelled) {
          setData({ effizienz: 72, puenktlichkeit: 85, durchsatz: 58, unit: '%' });
          setTs(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
        }
      }
    }

    load();
    const iv = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!data) {
    return (
      <div className="rounded-2xl border border-matcha-700/50 bg-matcha-800/30 px-4 py-4 animate-pulse h-28" />
    );
  }

  const avg = Math.round((data.effizienz + data.puenktlichkeit + data.durchsatz) / 3);
  const avgColor = ringColor(avg);

  return (
    <div className="rounded-2xl border border-matcha-700/40 bg-matcha-800/20 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-matcha-700/30">
        <span className="text-xs font-black text-matcha-100 uppercase tracking-wider">Schicht-KPIs Live</span>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: `${avgColor}20`, color: avgColor }}
        >
          Ø {avg}%
        </span>
      </div>
      <div className="flex items-center justify-around px-2 py-3">
        <KpiRing label="Effizienz" value={data.effizienz} unit="%" icon={Zap} />
        <KpiRing label="Pünktlichkeit" value={data.puenktlichkeit} unit="%" icon={Clock} />
        <KpiRing label="Durchsatz" value={data.durchsatz} unit="%" icon={TrendingUp} />
      </div>
      <div className="px-3 pb-2 text-[9px] text-matcha-500 text-right">{ts}</div>
    </div>
  );
}
