'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, MapPin, Clock, Zap, CheckCircle2 } from 'lucide-react';

interface FahrerNaeheData {
  distanzMeters: number | null;
  etaMinuten: number | null;
  fahrerName: string | null;
  istUnterwegs: boolean;
  zuletzt: string | null;
}

function useDriverProximity(orderId: string | null): FahrerNaeheData | null {
  const [data, setData] = useState<FahrerNaeheData | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let active = true;

    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/tracking?order_id=${orderId}`);
        if (!r.ok || !active) return;
        const d = await r.json();
        setData({
          distanzMeters: d.distance_m ?? null,
          etaMinuten: d.eta_min ?? null,
          fahrerName: d.driver_name ?? null,
          istUnterwegs: d.is_on_route ?? false,
          zuletzt: d.last_update ?? null,
        });
      } catch {}
    };

    load();
    const iv = setInterval(load, 20_000);
    return () => { active = false; clearInterval(iv); };
  }, [orderId]);

  return data;
}

function PulseRing({ pct }: { pct: number }) {
  const clamp = Math.max(0, Math.min(1, pct));
  const color = clamp > 0.8 ? '#10b981' : clamp > 0.5 ? '#3b82f6' : clamp > 0.2 ? '#f59e0b' : '#6b7280';
  const r = 36;
  const circ = 2 * Math.PI * r;
  return (
    <svg width="90" height="90" viewBox="0 0 90 90" className="shrink-0">
      <circle cx="45" cy="45" r={r} fill="none" stroke="#f3f4f6" strokeWidth="7" />
      <circle
        cx="45" cy="45" r={r} fill="none"
        stroke={color} strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={`${circ}`}
        strokeDashoffset={`${circ * (1 - clamp)}`}
        className="transition-all duration-700"
        transform="rotate(-90 45 45)"
      />
      <Bike className="hidden" />
    </svg>
  );
}

interface Props {
  orderId: string | null;
  className?: string;
}

export function FahrerNaeheLiveAnzeige({ orderId, className }: Props) {
  const data = useDriverProximity(orderId);
  const [pulseActive, setPulseActive] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setPulseActive((p) => !p), 1500);
    return () => clearInterval(iv);
  }, []);

  if (!data?.istUnterwegs) return null;

  const maxDistM = 3000;
  const pct = data.distanzMeters != null
    ? Math.max(0, 1 - data.distanzMeters / maxDistM)
    : data.etaMinuten != null
    ? Math.max(0, 1 - data.etaMinuten / 20)
    : 0.3;

  const isNearby = data.distanzMeters != null && data.distanzMeters < 500;
  const isArriving = data.etaMinuten != null && data.etaMinuten <= 2;

  return (
    <div className={cn('rounded-2xl border bg-white shadow-sm overflow-hidden', className)}>
      {/* Live header */}
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5 border-b',
        isNearby ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-100',
      )}>
        <span className={cn(
          'h-2 w-2 rounded-full shrink-0',
          pulseActive ? 'bg-blue-500' : 'bg-blue-300',
          'transition-colors duration-300',
        )} />
        <span className="text-xs font-bold text-gray-700 flex-1">
          {isNearby ? 'Fahrer fast da!' : 'Fahrer unterwegs'}
        </span>
        <span className="text-[10px] text-gray-400">Live</span>
      </div>

      <div className="flex items-center gap-4 p-4">
        {/* Proximity ring */}
        <div className="relative">
          <PulseRing pct={pct} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Bike
              size={22}
              className={cn(
                'transition-colors',
                isNearby ? 'text-emerald-600' : 'text-blue-500',
              )}
            />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {data.fahrerName && (
            <div className="text-sm font-bold text-gray-800 mb-1 truncate">{data.fahrerName}</div>
          )}

          {isArriving ? (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0 animate-bounce" />
              <span className="text-sm font-black text-emerald-600">Kommt jetzt an!</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {data.etaMinuten != null && (
                <div className="flex items-center gap-1.5">
                  <Clock size={13} className="text-gray-400 shrink-0" />
                  <span className="text-sm font-black text-gray-800 tabular-nums">
                    {data.etaMinuten} min
                  </span>
                  <span className="text-xs text-gray-400">bis Lieferung</span>
                </div>
              )}
              {data.distanzMeters != null && (
                <div className="flex items-center gap-1.5">
                  <MapPin size={13} className="text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-500">
                    {data.distanzMeters < 1000
                      ? `${data.distanzMeters.toFixed(0)} m entfernt`
                      : `${(data.distanzMeters / 1000).toFixed(1)} km entfernt`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                isNearby ? 'bg-emerald-500' : 'bg-blue-400',
              )}
              style={{ width: `${Math.round(pct * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {isNearby && (
        <div className="mx-4 mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 flex items-center gap-2">
          <Zap size={13} className="text-emerald-600 shrink-0" />
          <span className="text-xs font-semibold text-emerald-800">
            Dein Fahrer ist weniger als 500m entfernt!
          </span>
        </div>
      )}
    </div>
  );
}
