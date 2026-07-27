'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { CheckCircle2, ChefHat, Clock, MapPin, Package, Truck, Navigation, Zap } from 'lucide-react';

type OrderStatus = 'neu' | 'bestaetigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';
type EtaStufe = 'gruen' | 'gelb' | 'orange' | 'rot';

interface TrackingData {
  status: OrderStatus;
  eta_min: number | null;
  eta_sek: number | null;
  driver_name: string | null;
  driver_nearby: boolean;
  phase_idx: number;
  kueche_info: string | null;
}

const PHASES: { key: OrderStatus; label: string; icon: React.ElementType }[] = [
  { key: 'bestaetigt',     label: 'Bestätigt',   icon: Package },
  { key: 'in_zubereitung', label: 'In Zubereitung', icon: ChefHat },
  { key: 'unterwegs',      label: 'Unterwegs',   icon: Truck },
  { key: 'geliefert',      label: 'Geliefert',   icon: CheckCircle2 },
];

const MOCK: TrackingData = {
  status: 'in_zubereitung',
  eta_min: 18,
  eta_sek: 18 * 60,
  driver_name: null,
  driver_nearby: false,
  phase_idx: 1,
  kueche_info: 'Dein Burger wird gerade zubereitet 🍔',
};

function getEtaStufe(sek: number | null): EtaStufe {
  if (sek == null) return 'gruen';
  if (sek > 20 * 60) return 'gruen';
  if (sek > 10 * 60) return 'gelb';
  if (sek > 5 * 60) return 'orange';
  return 'rot';
}

const STUFE_STYLE: Record<EtaStufe, { bar: string; text: string; bg: string }> = {
  gruen:  { bar: 'bg-green-500',  text: 'text-green-700',  bg: 'bg-green-50'  },
  gelb:   { bar: 'bg-yellow-400', text: 'text-yellow-700', bg: 'bg-yellow-50' },
  orange: { bar: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50' },
  rot:    { bar: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50'    },
};

function formatCountdown(sek: number): string {
  if (sek <= 0) return '0:00';
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface Props {
  orderId: string;
  locationId?: string;
}

export function StorefrontPhase1000DynamischeEtaLiveTrackingV2({ orderId, locationId }: Props) {
  const [data, setData] = useState<TrackingData>(MOCK);
  const [countdown, setCountdown] = useState<number | null>(MOCK.eta_sek);
  const [loading, setLoading] = useState(false);
  const countdownRef = useRef(countdown);
  countdownRef.current = countdown;

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/customer/tracking?order_id=${orderId}`);
      if (r.ok) {
        const j = await r.json();
        if (!j.error) {
          setData(j);
          if (j.eta_sek != null) setCountdown(j.eta_sek);
        }
      }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => { load(); const id = setInterval(load, 20_000); return () => clearInterval(id); }, [load]);

  // 1-second tick
  useEffect(() => {
    if (data.status === 'geliefert') return;
    const id = setInterval(() => {
      setCountdown(c => (c != null && c > 0 ? c - 1 : c));
    }, 1000);
    return () => clearInterval(id);
  }, [data.status]);

  const stufe = getEtaStufe(countdown);
  const ss = STUFE_STYLE[stufe];
  const progressPct = data.eta_sek && countdown != null
    ? Math.max(0, Math.min(100, ((data.eta_sek - countdown) / data.eta_sek) * 100))
    : 0;

  if (data.status === 'geliefert') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-5 flex flex-col items-center gap-2 text-center">
        <CheckCircle2 className="w-10 h-10 text-green-500" />
        <p className="text-base font-bold text-green-700">Geliefert! Guten Appetit 🎉</p>
        <p className="text-xs text-green-600">Deine Bestellung wurde erfolgreich zugestellt.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border overflow-hidden ${ss.bg} border-${stufe === 'gruen' ? 'green' : stufe === 'gelb' ? 'yellow' : stufe === 'orange' ? 'orange' : 'red'}-200`}>
      {/* ETA Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Clock className={`w-4 h-4 ${ss.text}`} />
            <span className={`text-sm font-bold ${ss.text}`}>Lieferzeit</span>
            {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          </div>
          {data.driver_nearby && (
            <span className="flex items-center gap-1 bg-indigo-100 text-indigo-700 rounded-full px-2.5 py-0.5 text-[10px] font-bold animate-pulse">
              <Navigation className="w-2.5 h-2.5" />Fahrer ist nah!
            </span>
          )}
        </div>

        {countdown != null ? (
          <div className="flex items-baseline gap-2 mb-2">
            <span className={`text-4xl font-black tabular-nums ${ss.text}`}>
              {formatCountdown(countdown)}
            </span>
            <span className={`text-sm font-medium ${ss.text}`}>verbleibend</span>
          </div>
        ) : data.eta_min != null ? (
          <p className={`text-2xl font-black mb-2 ${ss.text}`}>~{data.eta_min} min</p>
        ) : (
          <p className="text-lg font-bold text-gray-500 mb-2">Wird berechnet…</p>
        )}

        {/* Fortschrittsbalken */}
        <div className="h-2 bg-white/60 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${ss.bar}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {data.kueche_info && (
          <p className="text-[10px] text-gray-600 bg-white/60 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
            <ChefHat className="w-3 h-3 text-gray-400 flex-shrink-0" />{data.kueche_info}
          </p>
        )}
      </div>

      {/* Phasenpfad */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-0">
          {PHASES.map((phase, idx) => {
            const done = idx < data.phase_idx;
            const active = idx === data.phase_idx;
            const Icon = phase.icon;
            return (
              <div key={phase.key} className="flex-1 flex flex-col items-center gap-1">
                <div className="flex items-center w-full">
                  {idx > 0 && (
                    <div className={`flex-1 h-0.5 ${done || active ? ss.bar : 'bg-gray-200'}`} />
                  )}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    done ? ss.bar + ' text-white' :
                    active ? 'border-2 border-current ' + ss.text + ' bg-white' :
                    'bg-gray-100 text-gray-300'
                  }`}>
                    {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  {idx < PHASES.length - 1 && (
                    <div className={`flex-1 h-0.5 ${done ? ss.bar : 'bg-gray-200'}`} />
                  )}
                </div>
                <span className={`text-[8px] font-medium text-center leading-tight ${active ? ss.text + ' font-bold' : done ? 'text-gray-500' : 'text-gray-300'}`}>
                  {phase.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fahrer */}
      {data.driver_name && data.status === 'unterwegs' && (
        <div className="border-t border-white/50 px-4 py-2 flex items-center gap-2 bg-white/40">
          <Truck className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-xs text-gray-600">
            <span className="font-semibold">{data.driver_name}</span> ist unterwegs zu dir
          </span>
          {data.driver_nearby && <Zap className="w-3 h-3 text-indigo-500 ml-auto animate-bounce" />}
        </div>
      )}
    </div>
  );
}
