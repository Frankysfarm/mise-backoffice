'use client';
import { useEffect, useRef, useState } from 'react';
import { Bike, CheckCircle2, Clock, MapPin, Package } from 'lucide-react';

type OrderPhase = 'bestätigt' | 'zubereitung' | 'bereit' | 'unterwegs' | 'geliefert';

interface EtaData {
  order_id: string;
  status: OrderPhase;
  eta_min: number | null;
  eta_sek: number | null;
  confidence: number;
  fahrer_name: string | null;
  fahrer_distanz_km: number | null;
  verzoegerung_min: number;
  phasen_ts: Partial<Record<OrderPhase, string>>;
}

const PHASES: { key: OrderPhase; label: string; icon: React.ReactNode }[] = [
  { key: 'bestätigt',  label: 'Bestätigt',   icon: <CheckCircle2 size={12} /> },
  { key: 'zubereitung', label: 'Zubereitung', icon: <Package size={12} /> },
  { key: 'bereit',    label: 'Fertig',        icon: <CheckCircle2 size={12} /> },
  { key: 'unterwegs', label: 'Unterwegs',     icon: <Bike size={12} /> },
  { key: 'geliefert', label: 'Geliefert',     icon: <CheckCircle2 size={12} /> },
];

const PHASE_ORDER: OrderPhase[] = ['bestätigt', 'zubereitung', 'bereit', 'unterwegs', 'geliefert'];

function phaseIdx(p: OrderPhase): number {
  return PHASE_ORDER.indexOf(p);
}

const MOCK: EtaData = {
  order_id: 'mock-001',
  status: 'unterwegs',
  eta_min: 8,
  eta_sek: 480,
  confidence: 85,
  fahrer_name: 'Ali M.',
  fahrer_distanz_km: 1.4,
  verzoegerung_min: 0,
  phasen_ts: {
    bestätigt:  new Date(Date.now() - 20 * 60_000).toISOString(),
    zubereitung: new Date(Date.now() - 15 * 60_000).toISOString(),
    bereit:     new Date(Date.now() - 3 * 60_000).toISOString(),
    unterwegs:  new Date(Date.now() - 1 * 60_000).toISOString(),
  },
};

function fmtCountdown(sek: number | null): string {
  if (sek === null) return '—';
  const m = Math.floor(Math.max(0, sek) / 60);
  const s = Math.max(0, sek) % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')} Min` : `${s}s`;
}

export function StorefrontPhase2650DynamischeEtaLiveTrackingMaster({ orderId }: { orderId?: string | null }) {
  const [data, setData] = useState<EtaData | null>(null);
  const [sek, setSek] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (sek === null) return;
    timerRef.current = setInterval(() => setSek(s => (s !== null && s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timerRef.current);
  }, [sek !== null]);

  useEffect(() => {
    const load = () => {
      if (!orderId) { setData(MOCK); setSek(MOCK.eta_sek); return; }
      fetch(`/api/delivery/public/eta?order_id=${orderId}`)
        .then(r => r.ok ? r.json() : null)
        .then((d: EtaData | null) => {
          const eff = d ?? MOCK;
          setData(eff);
          setSek(eff.eta_sek);
        })
        .catch(() => { setData(MOCK); setSek(MOCK.eta_sek); });
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [orderId]);

  if (!data) return null;

  const currentIdx = phaseIdx(data.status);
  const konfidenzColor = data.confidence >= 80 ? 'text-green-600' : data.confidence >= 60 ? 'text-amber-500' : 'text-red-500';
  const etaUrgent = (sek ?? 0) < 120;

  return (
    <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
      {/* ETA Hero */}
      <div className="text-center mb-4">
        <div className={`text-3xl font-black tabular-nums transition-colors ${etaUrgent ? 'text-amber-500 animate-pulse' : 'text-blue-600'}`}>
          {fmtCountdown(sek)}
        </div>
        <div className="text-xs text-gray-500 mt-0.5 flex items-center justify-center gap-1">
          <Clock size={10} />
          Geschätzte Ankunft · Konfidenz
          <span className={`font-semibold ${konfidenzColor}`}>{data.confidence}%</span>
        </div>
        {data.verzoegerung_min > 0 && (
          <div className="mt-1 text-[11px] font-semibold text-amber-600">
            +{data.verzoegerung_min} Min Verzögerung
          </div>
        )}
      </div>

      {/* Phasen-Timeline */}
      <div className="flex items-center justify-between mb-4">
        {PHASES.map((ph, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          const pending = i > currentIdx;
          return (
            <div key={ph.key} className="flex flex-col items-center flex-1">
              {/* Verbindungslinie links */}
              {i > 0 && (
                <div className={`absolute hidden`} />
              )}
              <div className={`flex flex-col items-center gap-1 relative ${i > 0 ? 'before:content-[""] before:absolute before:top-3 before:right-1/2 before:w-full before:h-0.5 before:bg-gray-200 ' + (done ? 'before:bg-blue-400' : '') : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10
                  ${done ? 'bg-blue-500 text-white' : active ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-400' : 'bg-gray-100 text-gray-300'}`}>
                  {ph.icon}
                </div>
                <span className={`text-[8px] font-medium ${active ? 'text-blue-600 font-bold' : done ? 'text-blue-400' : 'text-gray-300'}`}>
                  {ph.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Fahrer-Info */}
      {data.status === 'unterwegs' && data.fahrer_name && (
        <div className="flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
            {data.fahrer_name[0]}
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-800">{data.fahrer_name} ist unterwegs</div>
            {data.fahrer_distanz_km !== null && (
              <div className="flex items-center gap-1 text-[10px] text-gray-500">
                <MapPin size={9} />
                noch ~{data.fahrer_distanz_km.toFixed(1)} km
              </div>
            )}
          </div>
          <div className="ml-auto">
            <Bike size={20} className="text-blue-400 animate-pulse" />
          </div>
        </div>
      )}

      {data.status === 'geliefert' && (
        <div className="flex items-center gap-2 justify-center rounded-xl bg-green-50 border border-green-200 px-3 py-2.5">
          <CheckCircle2 size={16} className="text-green-500" />
          <span className="text-sm font-bold text-green-700">Geliefert — Guten Appetit! 🎉</span>
        </div>
      )}

      <div className="mt-2 text-[9px] text-gray-300 text-right">Live · 30-Sek-Polling</div>
    </div>
  );
}
