'use client';

import { useEffect, useState, useRef } from 'react';
import { Clock, MapPin, ChefHat, Bike, CheckCircle2, Loader2, Zap, AlertTriangle, Star } from 'lucide-react';

// Phase 5167 — Dynamische ETA Live Tracking V12
// Neu: Phasen-Timeline Küche→Fahrer→Zustellung animiert;
// ETA-Ring mit Sekundengenauigkeit + Konfidenz-Indikator;
// Fahrer-Annäherungs-Fortschrittsbalken;
// Qualitäts-Score-Badge; Wetter-Verzögerungs-Hinweis;
// 10-Sek-Polling; Mock-Fallback

type Phase = 'kueche' | 'fahrer' | 'unterwegs' | 'ankunft' | 'geliefert';

interface OrderTracking {
  order_id: string;
  bestellnummer: string;
  phase: Phase;
  eta_min: number;
  eta_sec_remain: number;
  konfidenz: number;
  fahrer_name: string | null;
  fahrer_distanz_km: number | null;
  fahrer_naehe_pct: number;
  qualitaets_score: number;
  wetter_delay_min: number;
  kueche_start_at: string | null;
  kueche_fertig_at: string | null;
  abholung_at: string | null;
}

const MOCK: OrderTracking = {
  order_id: 'ord_demo',
  bestellnummer: '#1099',
  phase: 'unterwegs',
  eta_min: 8,
  eta_sec_remain: 495,
  konfidenz: 91,
  fahrer_name: 'Max M.',
  fahrer_distanz_km: 1.4,
  fahrer_naehe_pct: 62,
  qualitaets_score: 4.7,
  wetter_delay_min: 0,
  kueche_start_at: new Date(Date.now() - 20 * 60_000).toISOString(),
  kueche_fertig_at: new Date(Date.now() - 8 * 60_000).toISOString(),
  abholung_at: new Date(Date.now() - 6 * 60_000).toISOString(),
};

const PHASES: { key: Phase; label: string; icon: React.ElementType }[] = [
  { key: 'kueche',    label: 'Küche',     icon: ChefHat      },
  { key: 'fahrer',    label: 'Abholung',  icon: Loader2      },
  { key: 'unterwegs', label: 'Unterwegs', icon: Bike         },
  { key: 'ankunft',   label: 'Fast da',   icon: MapPin       },
  { key: 'geliefert', label: 'Geliefert', icon: CheckCircle2 },
];

const PHASE_ORDER: Phase[] = ['kueche', 'fahrer', 'unterwegs', 'ankunft', 'geliefert'];

function phaseIndex(p: Phase) { return PHASE_ORDER.indexOf(p); }

function fmt(sec: number) {
  if (sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function konfidenzColor(k: number) {
  if (k >= 85) return 'text-green-400';
  if (k >= 65) return 'text-yellow-400';
  return 'text-red-400';
}

function ringOffset(secRemain: number, etaMin: number) {
  const total = etaMin * 60;
  if (total <= 0) return 0;
  const pct = Math.max(0, Math.min(1, 1 - secRemain / total));
  const circumference = 2 * Math.PI * 42;
  return circumference * (1 - pct);
}

export function Phase5167DynamischeEtaLiveTrackingV12({
  orderId,
  locationSlug,
}: {
  orderId: string | null;
  locationSlug: string;
}) {
  const [data, setData] = useState<OrderTracking | null>(null);
  const [secRemain, setSecRemain] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    if (!orderId) { setData(MOCK); setSecRemain(MOCK.eta_sec_remain); return; }
    try {
      const res = await fetch(`/api/delivery/order-tracking?order_id=${orderId}&slug=${locationSlug}`);
      if (!res.ok) throw new Error();
      const d = await res.json();
      setData(d);
      setSecRemain(d.eta_sec_remain);
    } catch {
      setData(MOCK);
      setSecRemain(MOCK.eta_sec_remain);
    }
  }

  useEffect(() => {
    load();
    const pollId = setInterval(load, 10_000);
    tickRef.current = setInterval(() => setSecRemain(s => Math.max(0, s - 1)), 1_000);
    return () => { clearInterval(pollId); if (tickRef.current) clearInterval(tickRef.current); };
  }, [orderId]);

  if (!data) return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
    </div>
  );

  const circumference = 2 * Math.PI * 42;
  const dashOffset = ringOffset(secRemain, data.eta_min);
  const currentPhaseIdx = phaseIndex(data.phase);
  const isDelivered = data.phase === 'geliefert';

  return (
    <div className="bg-white rounded-2xl shadow-lg p-5 space-y-5 max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">Bestellung {data.bestellnummer}</p>
          <p className="text-sm font-semibold text-gray-800">
            {isDelivered ? 'Zugestellt!' : 'Wird geliefert…'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
          <span className="text-xs font-semibold text-gray-700">{data.qualitaets_score.toFixed(1)}</span>
        </div>
      </div>

      {/* ETA-Ring */}
      <div className="flex items-center justify-center">
        <div className="relative w-28 h-28">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#f3f4f6" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="42" fill="none"
              stroke={isDelivered ? '#22c55e' : '#f97316'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={isDelivered ? 0 : dashOffset}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {isDelivered ? (
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            ) : (
              <>
                <span className="text-xl font-bold text-gray-800 font-mono">{fmt(secRemain)}</span>
                <span className="text-[10px] text-gray-500">≈ {data.eta_min} min</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Konfidenz + Wetter */}
      <div className="flex items-center justify-between text-xs">
        <span className={`font-medium ${konfidenzColor(data.konfidenz)}`}>
          {data.konfidenz}% Konfidenz
        </span>
        {data.wetter_delay_min > 0 && (
          <span className="flex items-center gap-1 text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" /> +{data.wetter_delay_min}min Wetter
          </span>
        )}
      </div>

      {/* Phasen-Timeline */}
      <div className="flex items-start gap-0">
        {PHASES.map((ph, i) => {
          const done = i < currentPhaseIdx;
          const active = i === currentPhaseIdx;
          const Icon = ph.icon;
          return (
            <div key={ph.key} className="flex-1 flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center
                ${done ? 'bg-orange-500' : active ? 'bg-orange-100 ring-2 ring-orange-400' : 'bg-gray-100'}`}>
                <Icon className={`w-3.5 h-3.5 ${done || active ? (done ? 'text-white' : 'text-orange-500') : 'text-gray-400'} ${active && ph.key !== 'unterwegs' ? 'animate-spin' : ''}`} />
              </div>
              <p className={`text-[9px] mt-1 text-center ${done ? 'text-orange-600' : active ? 'text-gray-800 font-semibold' : 'text-gray-400'}`}>
                {ph.label}
              </p>
              {i < PHASES.length - 1 && (
                <div className={`absolute mt-3.5 h-0.5 w-full ${done ? 'bg-orange-400' : 'bg-gray-200'}`}
                  style={{ transform: 'translateX(50%)', width: `calc(100% - 0px)` }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Fahrer-Annäherungs-Balken */}
      {data.fahrer_name && data.phase !== 'kueche' && (
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="flex items-center gap-1 text-gray-600">
              <Bike className="w-3.5 h-3.5 text-orange-400" />
              {data.fahrer_name}
            </span>
            <span className="text-gray-500">
              {data.fahrer_distanz_km !== null ? `${data.fahrer_distanz_km.toFixed(1)} km` : ''}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-1000"
              style={{ width: `${data.fahrer_naehe_pct}%` }}
            />
          </div>
          <p className="text-[9px] text-gray-400 text-right mt-0.5">{data.fahrer_naehe_pct}% der Strecke</p>
        </div>
      )}
    </div>
  );
}
