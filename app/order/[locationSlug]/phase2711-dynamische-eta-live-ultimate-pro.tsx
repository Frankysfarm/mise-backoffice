'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, MapPin, CheckCircle2, AlertTriangle, Bike, ChefHat, Package, Star } from 'lucide-react';

type Phase = 'bestellt' | 'bestaetigt' | 'in_zubereitung' | 'unterwegs' | 'geliefert';

interface EtaData {
  order_id: string;
  status: Phase;
  eta_min: number | null;
  eta_min_original: number | null;
  delay_min: number | null;
  konfidenz: number;
  fahrer_name: string | null;
  fahrer_bewertung: number | null;
  fahrer_distanz_km: number | null;
  bestellt_am: string | null;
}

const MOCK: EtaData = {
  order_id: 'mock',
  status: 'unterwegs',
  eta_min: 8,
  eta_min_original: 30,
  delay_min: null,
  konfidenz: 96,
  fahrer_name: 'Max M.',
  fahrer_bewertung: 4.9,
  fahrer_distanz_km: 0.9,
  bestellt_am: new Date(Date.now() - 22 * 60_000).toISOString(),
};

const PHASES: { key: Phase; label: string; icon: React.ReactNode }[] = [
  { key: 'bestellt', label: 'Bestellt', icon: <Package className="w-3.5 h-3.5" /> },
  { key: 'bestaetigt', label: 'Bestätigt', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  { key: 'in_zubereitung', label: 'In Küche', icon: <ChefHat className="w-3.5 h-3.5" /> },
  { key: 'unterwegs', label: 'Unterwegs', icon: <Bike className="w-3.5 h-3.5" /> },
  { key: 'geliefert', label: 'Geliefert', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
];

function phaseIdx(s: Phase): number {
  return PHASES.findIndex(p => p.key === s);
}

function formatCountdown(min: number | null, tick: number): string {
  if (min === null) return '—';
  const total = Math.max(0, min * 60 - tick);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0 && s === 0) return 'Jeden Moment';
  return `${m}:${s.toString().padStart(2, '0')} min`;
}

function etaColor(min: number | null, delay: number | null): string {
  if (min === null) return 'text-gray-500';
  if (delay && delay > 0) return 'text-red-600';
  if (min <= 5) return 'text-emerald-600';
  if (min <= 12) return 'text-yellow-600';
  return 'text-gray-800';
}

export function StorefrontPhase2711DynamischeEtaLiveUltimatePro({
  orderId,
  locationSlug,
}: {
  orderId: string | null;
  locationSlug?: string;
}) {
  const [data, setData] = useState<EtaData>(MOCK);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!orderId || orderId === 'mock') return;
    try {
      const r = await fetch(`/api/delivery/tracking?order_id=${orderId}`, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        if (d?.order_id) setData(d);
      }
    } catch {}
  }, [orderId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 15_000);
    const ticker = setInterval(() => setTick(t => t + 1), 1_000);
    return () => { clearInterval(poll); clearInterval(ticker); };
  }, [load]);

  const curIdx = phaseIdx(data.status);
  const delivered = data.status === 'geliefert';
  const color = etaColor(data.eta_min, data.delay_min);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3 flex items-center justify-between border-b border-orange-100">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-orange-500" />
          <span className="font-semibold text-sm text-gray-900">Live-Lieferzeit</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white/70 rounded-full px-2 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-gray-600">Live</span>
        </div>
      </div>

      <div className="p-4">
        {delivered ? (
          <div className="text-center py-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
            <p className="font-bold text-emerald-600 text-lg">Geliefert!</p>
            <p className="text-xs text-gray-400 mt-1">Guten Appetit!</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-4">
              <span className={`text-4xl font-black ${color} tabular-nums`}>
                {formatCountdown(data.eta_min, tick)}
              </span>
              {data.delay_min && data.delay_min > 0 && (
                <div className="flex items-center justify-center gap-1 mt-1 text-xs text-red-600">
                  <AlertTriangle className="w-3 h-3" />
                  <span>+{data.delay_min} Min Verzögerung</span>
                </div>
              )}
              <div className="mt-2 flex items-center justify-center gap-1">
                <span className="text-xs text-gray-400">Konfidenz:</span>
                <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full"
                    style={{ width: `${data.konfidenz}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">{data.konfidenz}%</span>
              </div>
            </div>

            <div className="flex items-center gap-0 mb-4">
              {PHASES.map((p, i) => {
                const done = i <= curIdx;
                const active = i === curIdx;
                return (
                  <div key={p.key} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                        done ? (active ? 'bg-orange-500 text-white ring-4 ring-orange-200' : 'bg-emerald-500 text-white') : 'bg-gray-100 text-gray-400'
                      }`}>
                        {p.icon}
                      </div>
                      <span className={`text-xs mt-1 font-medium ${done ? 'text-gray-700' : 'text-gray-300'}`}>
                        {p.label}
                      </span>
                    </div>
                    {i < PHASES.length - 1 && (
                      <div className={`h-0.5 flex-1 transition-all ${i < curIdx ? 'bg-emerald-400' : 'bg-gray-100'}`} />
                    )}
                  </div>
                );
              })}
            </div>

            {data.fahrer_name && (
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                  <Bike className="w-4 h-4 text-orange-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{data.fahrer_name}</div>
                  {data.fahrer_bewertung && (
                    <div className="flex items-center gap-0.5 text-xs text-yellow-600">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span>{data.fahrer_bewertung.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                {data.fahrer_distanz_km !== null && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <MapPin className="w-3 h-3" />
                    <span>{data.fahrer_distanz_km.toFixed(1)} km</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
