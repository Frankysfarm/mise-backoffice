'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Users, AlertTriangle, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';

/**
 * Phase 933 — Live-Fahrer-Kapazitäts-Gauge (Dispatch)
 *
 * Frei / Aktiv / Überlastet / Offline Fahrer + Kapazitäts-% Gauge.
 * Alert bei <20% freier Kapazität. 60s-Polling.
 */

interface Props {
  locationId: string | null;
}

interface KapData {
  gesamt: number;
  frei: number;
  aktiv: number;
  ueberlastet: number;
  offline: number;
  kapazitaet_pct: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  alert: boolean;
  generatedAt: string;
}

const MOCK: KapData = {
  gesamt: 6,
  frei: 2,
  aktiv: 3,
  ueberlastet: 0,
  offline: 1,
  kapazitaet_pct: 40,
  trend: 'stabil',
  alert: false,
  generatedAt: new Date().toISOString(),
};

const POLL_MS = 60 * 1000;

function TrendIcon({ trend }: { trend: 'steigend' | 'fallend' | 'stabil' }) {
  if (trend === 'steigend') return <TrendingUp className="w-3 h-3 text-amber-500" />;
  if (trend === 'fallend') return <TrendingDown className="w-3 h-3 text-matcha-500" />;
  return <Minus className="w-3 h-3 text-stone-400" />;
}

function GaugeSvg({ pct }: { pct: number }) {
  const r = 36;
  const cx = 44;
  const cy = 44;
  const circum = Math.PI * r;
  const filled = (pct / 100) * circum;
  const color = pct < 20 ? '#ef4444' : pct < 50 ? '#f59e0b' : '#4ade80';
  return (
    <svg width="88" height="52" viewBox="0 0 88 52" className="overflow-visible">
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circum}`}
      />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="14" fontWeight="bold" fill={color}>
        {pct}%
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="7" fill="#6b7280">
        Kapazität frei
      </text>
    </svg>
  );
}

export function DispatchPhase933FahrerKapazitaetGauge({ locationId }: Props) {
  const [data, setData] = useState<KapData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-kapazitaet-live?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
      else setData(MOCK);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  if (!locationId) return null;

  const d = data ?? MOCK;

  return (
    <div className={cn(
      'rounded-xl border shadow-sm p-4',
      d.alert ? 'border-red-300 bg-red-50' : 'border-stone-200 bg-white',
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-stone-600" />
          <span className="text-sm font-semibold text-stone-800">Fahrer-Kapazität Live</span>
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <Loader2 className="w-3 h-3 animate-spin text-stone-400" />}
          {!loading && <TrendIcon trend={d.trend} />}
          <span className="text-[10px] text-stone-400 capitalize">{d.trend}</span>
        </div>
      </div>

      {d.alert && (
        <div className="flex items-center gap-2 rounded-lg bg-red-100 border border-red-300 px-3 py-2 text-xs text-red-700 font-semibold mb-3">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Kapazitätsalarm — weniger als 20% der Fahrer frei!
        </div>
      )}

      <div className="flex items-center gap-4">
        <GaugeSvg pct={d.kapazitaet_pct} />

        <div className="flex-1 space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <div className="flex items-center gap-1.5 rounded-md bg-matcha-50 border border-matcha-200 px-2 py-1">
              <span className="w-2 h-2 rounded-full bg-matcha-400 shrink-0" />
              <span className="text-[11px] text-matcha-700 font-medium">Frei: {d.frei}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-md bg-sky-50 border border-sky-200 px-2 py-1">
              <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
              <span className="text-[11px] text-sky-700 font-medium">Aktiv: {d.aktiv}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2 py-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-[11px] text-amber-700 font-medium">Überlastet: {d.ueberlastet}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-md bg-stone-50 border border-stone-200 px-2 py-1">
              <span className="w-2 h-2 rounded-full bg-stone-300 shrink-0" />
              <span className="text-[11px] text-stone-500 font-medium">Offline: {d.offline}</span>
            </div>
          </div>
          <div className="text-[10px] text-stone-400 text-right">
            Gesamt: {d.gesamt} Fahrer
          </div>
        </div>
      </div>
    </div>
  );
}
