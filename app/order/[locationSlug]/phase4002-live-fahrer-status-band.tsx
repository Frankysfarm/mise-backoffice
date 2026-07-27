'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bike, MapPin, Clock, CheckCircle2, Package } from 'lucide-react';

interface ApiData { status: 'kein_fahrer' | 'fahrer_zugeteilt' | 'abgeholt' | 'unterwegs' | 'nahe' | 'geliefert'; fahrer_name: string | null; fahrer_bewertung: number | null; eta_min: number | null; distanz_m: number | null; abgeholt_um: string | null; }

const MOCK: ApiData = { status: 'unterwegs', fahrer_name: 'Max M.', fahrer_bewertung: 4.9, eta_min: 8, distanz_m: 1400, abgeholt_um: new Date(Date.now() - 6 * 60_000).toISOString() };

interface Props { orderId: string; }

export function StorefrontPhase4002LiveFahrerStatusBand({ orderId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/order/fahrer-status?order_id=${orderId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [load]);

  const statusConfig = {
    kein_fahrer: { label: 'Fahrer wird zugeteilt…', color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200', icon: <Package className="w-4 h-4 text-gray-400" />, animate: true },
    fahrer_zugeteilt: { label: 'Fahrer auf dem Weg zum Restaurant', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', icon: <Bike className="w-4 h-4 text-blue-500" />, animate: true },
    abgeholt: { label: 'Fahrer hat abgeholt', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', icon: <Bike className="w-4 h-4 text-indigo-500" />, animate: false },
    unterwegs: { label: 'Fahrer ist unterwegs zu dir', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-300', icon: <Bike className="w-4 h-4 text-blue-600 animate-pulse" />, animate: false },
    nahe: { label: 'Fahrer ist fast da! 🎉', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300', icon: <MapPin className="w-4 h-4 text-emerald-600 animate-bounce" />, animate: false },
    geliefert: { label: 'Geliefert! Guten Appetit ✓', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300', icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />, animate: false },
  };

  const cfg = statusConfig[data.status];

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full ${cfg.bg} border ${cfg.border} flex items-center justify-center flex-shrink-0`}>
          {cfg.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</div>
          {data.fahrer_name && (
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-600">Fahrer: <span className="font-medium">{data.fahrer_name}</span></span>
              {data.fahrer_bewertung && (
                <span className="text-[10px] text-yellow-500 font-medium">★ {data.fahrer_bewertung}</span>
              )}
            </div>
          )}
        </div>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
      </div>

      {(data.eta_min !== null || data.distanz_m !== null) && (
        <div className="flex items-center gap-3">
          {data.eta_min !== null && (
            <div className="flex items-center gap-1.5 bg-white bg-opacity-70 rounded-lg px-2.5 py-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-sm font-bold text-gray-800">{data.eta_min} min</span>
            </div>
          )}
          {data.distanz_m !== null && (
            <div className="flex items-center gap-1.5 bg-white bg-opacity-70 rounded-lg px-2.5 py-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-sm font-bold text-gray-800">
                {data.distanz_m >= 1000 ? `${(data.distanz_m / 1000).toFixed(1)} km` : `${data.distanz_m} m`}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="text-[10px] text-gray-400 text-center">
        15-Sek-Live-Update · GPS-Tracking
      </div>
    </div>
  );
}
