'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, MapPin, CheckCircle2, AlertTriangle, Bike, ChefHat, Package, Zap, Star } from 'lucide-react';

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
  eta_min: 9,
  eta_min_original: 30,
  delay_min: null,
  konfidenz: 94,
  fahrer_name: 'Max M.',
  fahrer_bewertung: 4.9,
  fahrer_distanz_km: 1.2,
  bestellt_am: new Date(Date.now() - 21 * 60_000).toISOString(),
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

function formatEta(min: number | null, tick: number): string {
  if (min === null) return '—';
  const total = Math.max(0, min * 60 - tick);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m > 0) return `${m}:${s.toString().padStart(2, '0')} Min`;
  return `${s} Sek`;
}

function konfidenzColor(k: number): string {
  if (k >= 85) return 'bg-emerald-500';
  if (k >= 65) return 'bg-yellow-400';
  return 'bg-red-400';
}

interface Props {
  orderId: string | null;
  locationSlug?: string;
}

export function StorefrontPhase2710DynamischeEtaLiveCockpitPro({ orderId, locationSlug }: Props) {
  const [data, setData] = useState<EtaData>(MOCK);
  const [tick, setTick] = useState(0);

  // 1-Sek-Tick für Countdown
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    if (!orderId || orderId === 'mock') return;
    try {
      const r = await fetch(`/api/delivery/customer/eta?order_id=${orderId}`, { cache: 'no-store' });
      if (r.ok) { const d = await r.json(); if (d?.status) setData(d); }
    } catch {}
  }, [orderId]);

  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [load]);

  const curIdx = phaseIdx(data.status);
  const isDelivered = data.status === 'geliefert';

  if (isDelivered) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 text-center space-y-2 shadow-sm">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
        <div className="text-lg font-bold text-emerald-700">Geliefert!</div>
        <div className="text-sm text-gray-500">Guten Appetit!</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* ETA-Hero */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 px-4 pt-4 pb-5 text-white">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-xs opacity-80 uppercase tracking-wide">Noch ca.</div>
            <div className="text-4xl font-black tabular-nums leading-none">
              {formatEta(data.eta_min, tick)}
            </div>
          </div>
          {data.delay_min && data.delay_min > 0 && (
            <div className="flex items-center gap-1 bg-red-500/30 border border-red-400/40 rounded-lg px-2 py-1 text-xs">
              <AlertTriangle className="w-3 h-3" />
              +{data.delay_min} Min Verzögerung
            </div>
          )}
        </div>

        {/* Konfidenz-Balken */}
        <div>
          <div className="flex items-center justify-between text-xs opacity-70 mb-1">
            <span>ETA-Genauigkeit</span>
            <span>{data.konfidenz}%</span>
          </div>
          <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${konfidenzColor(data.konfidenz)}`}
              style={{ width: `${data.konfidenz}%` }}
            />
          </div>
        </div>
      </div>

      {/* Phasen-Timeline */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          {PHASES.map((ph, i) => (
            <div key={ph.key} className="flex flex-col items-center flex-1">
              <div className="relative flex items-center w-full">
                {i > 0 && (
                  <div className={`h-0.5 flex-1 ${i <= curIdx ? 'bg-indigo-500' : 'bg-gray-200'} transition-colors`} />
                )}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all
                  ${i < curIdx ? 'bg-emerald-500 text-white' : i === curIdx ? 'bg-indigo-600 text-white ring-2 ring-indigo-200' : 'bg-gray-100 text-gray-400'}`}>
                  {ph.icon}
                </div>
                {i < PHASES.length - 1 && (
                  <div className={`h-0.5 flex-1 ${i < curIdx ? 'bg-indigo-500' : 'bg-gray-200'} transition-colors`} />
                )}
              </div>
              <div className={`text-xs mt-1 text-center leading-tight
                ${i === curIdx ? 'text-indigo-600 font-semibold' : i < curIdx ? 'text-emerald-600' : 'text-gray-400'}`}>
                {ph.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fahrer-Info */}
      {data.fahrer_name && data.status === 'unterwegs' && (
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <Bike className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-sm">{data.fahrer_name}</span>
              {data.fahrer_bewertung && (
                <span className="flex items-center gap-0.5 text-xs text-amber-500 font-medium">
                  <Star className="w-3 h-3 fill-amber-400" />{data.fahrer_bewertung.toFixed(1)}
                </span>
              )}
            </div>
            {data.fahrer_distanz_km !== null && (
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <MapPin className="w-3 h-3" />{data.fahrer_distanz_km.toFixed(1)} km entfernt
              </div>
            )}
          </div>
          <div className="text-xs text-gray-400 flex items-center gap-1">
            <Zap className="w-3 h-3 text-yellow-400" />Live
          </div>
        </div>
      )}
    </div>
  );
}
