'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, MapPin, CheckCircle2, ChevronRight, Bike, Package, Flame, Star } from 'lucide-react';

interface Phase {
  id: string;
  label: string;
  icon: string;
  done: boolean;
  aktiv: boolean;
  eta_label: string | null;
}

interface ApiResponse {
  order_id: string;
  status: string;
  eta_min_low: number;
  eta_min_high: number;
  eta_label: string;
  konfidenz_pct: number;
  fahrer_name: string | null;
  fahrer_distanz_km: number | null;
  phasen: Phase[];
  bewertung_prompt: boolean;
  delivered_at: string | null;
  live_update_secs: number;
}

const MOCK: ApiResponse = {
  order_id: 'mock-001',
  status: 'unterwegs',
  eta_min_low: 8,
  eta_min_high: 14,
  eta_label: '8–14 Min',
  konfidenz_pct: 82,
  fahrer_name: 'Kai B.',
  fahrer_distanz_km: 1.4,
  bewertung_prompt: false,
  delivered_at: null,
  live_update_secs: 20,
  phasen: [
    { id: 'bestaetigt', label: 'Bestätigt', icon: '✅', done: true, aktiv: false, eta_label: null },
    { id: 'kueche', label: 'In Zubereitung', icon: '👨‍🍳', done: true, aktiv: false, eta_label: null },
    { id: 'fertig', label: 'Abholbereit', icon: '📦', done: true, aktiv: false, eta_label: null },
    { id: 'unterwegs', label: 'Unterwegs', icon: '🚲', done: false, aktiv: true, eta_label: '~11 Min' },
    { id: 'geliefert', label: 'Geliefert', icon: '🎉', done: false, aktiv: false, eta_label: null },
  ],
};

function EtaRing({ low, high, konfidenz }: { low: number; high: number; konfidenz: number }) {
  const mid = Math.round((low + high) / 2);
  const r = 40;
  const circ = 2 * Math.PI * r;
  const filled = (konfidenz / 100) * circ;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
      <svg width={100} height={100} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={50} cy={50} r={r} fill="none" stroke="#1F2937" strokeWidth={8} />
        <circle
          cx={50} cy={50} r={r} fill="none"
          stroke={konfidenz >= 80 ? '#10B981' : konfidenz >= 60 ? '#F59E0B' : '#EF4444'}
          strokeWidth={8}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.7s ease' }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-2xl font-black text-white">{mid}</p>
        <p className="text-[9px] text-gray-400 -mt-1">Min</p>
      </div>
    </div>
  );
}

export function Phase4470DynamischeEtaLiveTrackingV5({ orderId }: { orderId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    if (!orderId) { setData(MOCK); return; }
    try {
      const r = await fetch(`/api/delivery/customer/tracking?order_id=${orderId}`);
      if (r.ok) setData(await r.json());
      else setData(MOCK);
    } catch { setData(MOCK); }
  }

  useEffect(() => {
    load();
    timerRef.current = setInterval(() => setTick(t => t + 1), 1000);
    pollRef.current = setInterval(load, 20000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [orderId]);

  if (!data) return (
    <div className="rounded-2xl bg-stone-800 p-6 text-stone-400 text-sm animate-pulse flex items-center gap-2">
      <Clock className="w-4 h-4" />
      Lade Live-Tracking…
    </div>
  );

  const isDelivered = data.status === 'geliefert';

  if (isDelivered) {
    return (
      <div className="rounded-2xl bg-emerald-900 border border-emerald-600 p-6 text-center space-y-3">
        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
        <p className="text-xl font-black text-white">Geliefert! 🎉</p>
        <p className="text-sm text-emerald-300">Guten Appetit von mise</p>
        {data.bewertung_prompt && (
          <div className="mt-3 rounded-xl bg-emerald-800/60 border border-emerald-700 p-3">
            <p className="text-xs text-emerald-200 mb-2">Wie war deine Lieferung?</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} className="text-2xl hover:scale-110 transition-transform">
                  <Star className={`w-6 h-6 ${s <= 4 ? 'text-amber-400' : 'text-amber-300'}`} fill="currentColor" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-stone-900 text-white p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-stone-100 text-sm">Live-Tracking</p>
          <p className="text-[10px] text-stone-500">Echtzeit-ETA · V5</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-stone-400">Live</span>
        </div>
      </div>

      {/* ETA Ring + Info */}
      <div className="flex items-center gap-5">
        <EtaRing low={data.eta_min_low} high={data.eta_min_high} konfidenz={data.konfidenz_pct} />
        <div className="flex-1 space-y-2">
          <div>
            <p className="text-sm font-bold text-white">Ankunft in</p>
            <p className="text-2xl font-black text-white">{data.eta_label}</p>
          </div>
          <p className="text-[10px] text-stone-400">Konfidenz {data.konfidenz_pct}%</p>
          {data.fahrer_name && (
            <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
              <Bike className="w-3.5 h-3.5 text-stone-500" />
              <span>{data.fahrer_name}</span>
              {data.fahrer_distanz_km !== null && (
                <span className="flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5" />
                  {data.fahrer_distanz_km} km
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Phase Timeline */}
      <div className="space-y-1">
        {data.phasen.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm transition-all ${
              p.done ? 'bg-emerald-700' : p.aktiv ? 'bg-blue-600 ring-2 ring-blue-400 ring-offset-1 ring-offset-stone-900' : 'bg-gray-700'
            }`}>
              {p.done ? '✓' : p.icon}
            </div>
            <div className="flex-1 flex items-center justify-between">
              <span className={`text-sm ${p.aktiv ? 'font-bold text-white' : p.done ? 'text-stone-400 line-through decoration-stone-600' : 'text-stone-500'}`}>
                {p.label}
              </span>
              {p.eta_label && (
                <span className="text-[10px] text-blue-400 font-semibold flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {p.eta_label}
                </span>
              )}
            </div>
            {i < data.phasen.length - 1 && (
              <ChevronRight className="w-3 h-3 text-stone-600 shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <p className="text-center text-[9px] text-stone-600">
        Aktualisiert alle {data.live_update_secs} Sek · mise Smart Delivery
      </p>
    </div>
  );
}
