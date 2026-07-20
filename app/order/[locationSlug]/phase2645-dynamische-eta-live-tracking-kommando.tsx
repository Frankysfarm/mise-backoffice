'use client';
import { useEffect, useRef, useState } from 'react';
import { Bike, ChefHat, CheckCircle2, Clock, MapPin, Package } from 'lucide-react';

interface Phase {
  key: string;
  label: string;
  icon: 'chef' | 'package' | 'bike' | 'check';
  abgeschlossen: boolean;
  aktuell: boolean;
}

interface ApiData {
  order_id: string;
  order_num: string;
  status: string;
  eta_min: number | null;
  eta_ts: number | null;
  fahrer_name: string | null;
  fahrer_distanz_m: number | null;
  phasen: Phase[];
  on_time_confidence_pct: number;
}

const MOCK: ApiData = {
  order_id: 'o1',
  order_num: '#1042',
  status: 'unterwegs',
  eta_min: 8,
  eta_ts: Date.now() / 1000 + 480,
  fahrer_name: 'Max M.',
  fahrer_distanz_m: 1200,
  on_time_confidence_pct: 91,
  phasen: [
    { key: 'bestellung',   label: 'Bestellt',        icon: 'check',   abgeschlossen: true,  aktuell: false },
    { key: 'zubereitung',  label: 'In Zubereitung',  icon: 'chef',    abgeschlossen: true,  aktuell: false },
    { key: 'abholbereit',  label: 'Abholbereit',     icon: 'package', abgeschlossen: true,  aktuell: false },
    { key: 'unterwegs',    label: 'Unterwegs',       icon: 'bike',    abgeschlossen: false, aktuell: true  },
    { key: 'geliefert',    label: 'Geliefert',       icon: 'check',   abgeschlossen: false, aktuell: false },
  ],
};

function PhaseIcon({ icon, size = 16, className = '' }: { icon: Phase['icon']; size?: number; className?: string }) {
  switch (icon) {
    case 'chef':    return <ChefHat   size={size} className={className} />;
    case 'package': return <Package   size={size} className={className} />;
    case 'bike':    return <Bike      size={size} className={className} />;
    default:        return <CheckCircle2 size={size} className={className} />;
  }
}

function fmtDist(m: number): string {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function Phase2645DynamischeEtaLiveTrackingKommando({ orderId }: { orderId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [now, setNow] = useState(() => Date.now() / 1000);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    const load = () => {
      if (!orderId) { setData(MOCK); return; }
      fetch(`/api/order/eta-live?order_id=${orderId}`)
        .then(r => r.ok ? r.json() : null)
        .then((d: ApiData | null) => setData(d ?? MOCK))
        .catch(() => setData(MOCK));
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [orderId]);

  if (!data) return null;

  const etaSecs = data.eta_ts ? data.eta_ts - now : null;
  const etaMins = etaSecs !== null ? Math.max(0, Math.ceil(etaSecs / 60)) : data.eta_min;
  const aktuellIdx = data.phasen.findIndex(p => p.aktuell);
  const phasePct = ((aktuellIdx + 1) / data.phasen.length) * 100;
  const isNear = data.fahrer_distanz_m !== null && data.fahrer_distanz_m < 500;

  return (
    <div className={`rounded-2xl border p-4 mb-3 ${isNear ? 'border-green-300 bg-green-50' : 'border-teal-200 bg-white'} shadow-sm`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bike size={16} className="text-teal-600" />
          <span className="text-sm font-bold text-gray-800">Live-Tracking</span>
          {isNear && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-200 text-green-800 font-semibold animate-pulse">
              Fast da!
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">{data.order_num}</span>
      </div>

      {/* ETA Countdown */}
      {etaMins !== null && (
        <div className="text-center py-3 mb-3">
          <div className={`text-4xl font-black ${etaMins <= 5 ? 'text-green-600' : etaMins <= 15 ? 'text-teal-600' : 'text-gray-700'}`}>
            {etaMins}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Minuten Lieferzeit</div>
          {data.on_time_confidence_pct >= 80 && (
            <div className="text-[10px] text-green-600 mt-0.5">
              Pünktlichkeit: {data.on_time_confidence_pct}% wahrscheinlich ✓
            </div>
          )}
        </div>
      )}

      {/* Phasen-Timeline */}
      <div className="relative mb-4">
        <div className="h-1.5 rounded-full bg-gray-200 absolute top-4 left-4 right-4" />
        <div
          className="h-1.5 rounded-full bg-teal-500 absolute top-4 left-4 transition-all"
          style={{ width: `calc((100% - 2rem) * ${phasePct / 100})` }}
        />
        <div className="flex justify-between relative">
          {data.phasen.map(p => (
            <div key={p.key} className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 ${p.abgeschlossen ? 'bg-teal-500' : p.aktuell ? 'bg-white border-2 border-teal-500' : 'bg-white border-2 border-gray-200'}`}>
                <PhaseIcon
                  icon={p.icon}
                  size={14}
                  className={p.abgeschlossen ? 'text-white' : p.aktuell ? 'text-teal-600' : 'text-gray-300'}
                />
              </div>
              <span className={`text-[9px] mt-1 text-center leading-tight ${p.aktuell ? 'text-teal-700 font-bold' : p.abgeschlossen ? 'text-gray-400' : 'text-gray-300'}`}>
                {p.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Fahrer-Info */}
      {data.fahrer_name && (
        <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
          <Bike size={13} className="text-teal-500" />
          <span className="font-medium">{data.fahrer_name}</span>
          {data.fahrer_distanz_m !== null && (
            <>
              <span className="text-gray-400">·</span>
              <MapPin size={11} className="text-gray-400" />
              <span className="text-gray-500">{fmtDist(data.fahrer_distanz_m)} entfernt</span>
            </>
          )}
          <Clock size={11} className="text-gray-400 ml-auto" />
          <span className="text-gray-500">~{etaMins} Min.</span>
        </div>
      )}
    </div>
  );
}
