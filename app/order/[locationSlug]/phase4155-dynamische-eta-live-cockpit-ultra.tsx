'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Clock, Bike, CheckCircle, Package, ChefHat, Truck, Phone } from 'lucide-react';

type Phase = 'eingang' | 'zubereitung' | 'bereit' | 'unterwegs' | 'geliefert';

interface EtaData {
  order_id: string | null;
  status: Phase;
  eta_min: number | null;
  eta_min_low: number | null;
  eta_min_high: number | null;
  fahrer_name: string | null;
  fahrer_telefon: string | null;
  fahrer_distanz_km: number | null;
  bestellnummer: string | null;
  letzte_aktualisierung: string | null;
}

const PHASE_CONFIG: { key: Phase; label: string; icon: React.ElementType; desc: string }[] = [
  { key: 'eingang', label: 'Eingang', icon: Package, desc: 'Bestellung eingegangen' },
  { key: 'zubereitung', label: 'Zubereitung', icon: ChefHat, desc: 'Wird zubereitet' },
  { key: 'bereit', label: 'Bereit', icon: CheckCircle, desc: 'Wartet auf Fahrer' },
  { key: 'unterwegs', label: 'Unterwegs', icon: Bike, desc: 'Fahrer ist unterwegs' },
  { key: 'geliefert', label: 'Geliefert', icon: MapPin, desc: 'Erfolgreich geliefert!' },
];
const PHASE_ORDER: Phase[] = ['eingang', 'zubereitung', 'bereit', 'unterwegs', 'geliefert'];

const MOCK: EtaData = {
  order_id: null,
  status: 'unterwegs',
  eta_min: 7,
  eta_min_low: 5,
  eta_min_high: 10,
  fahrer_name: 'Max M.',
  fahrer_telefon: null,
  fahrer_distanz_km: 1.4,
  bestellnummer: '#1042',
  letzte_aktualisierung: new Date().toISOString(),
};

interface Props { orderId: string | null; }

export function Phase4155DynamischeEtaLiveCockpitUltra({ orderId }: Props) {
  const [data, setData] = useState<EtaData>({ ...MOCK, order_id: orderId });
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/delivery/tracking?order_id=${orderId}`);
      if (res.ok) { const j = await res.json(); if (!j.error) setData(j); }
    } catch { /* Mock */ }
  }, [orderId]);

  useEffect(() => { load(); const iv = setInterval(load, 20_000); return () => clearInterval(iv); }, [load]);
  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 1000); return () => clearInterval(t); }, []);

  const currentIdx = PHASE_ORDER.indexOf(data.status);
  const isGeliefert = data.status === 'geliefert';

  const ringPct = isGeliefert ? 100
    : data.eta_min !== null && data.eta_min > 0 ? Math.max(5, Math.round((1 - data.eta_min / 60) * 100))
    : 50;
  const R = 44, circ = 2 * Math.PI * R;
  const dashOffset = circ * (1 - ringPct / 100);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-stone-900 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-white font-black text-sm">Live-Tracking Ultra</p>
          {data.bestellnummer && <p className="text-stone-400 text-[10px]">Bestellung {data.bestellnummer}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-stone-400">Echtzeit</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* ETA-Ring + Info */}
        {!isGeliefert && data.eta_min !== null ? (
          <div className="flex items-center gap-4">
            {/* Ring */}
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r={R} fill="none" stroke="#e5e7eb" strokeWidth="7" />
                <circle
                  cx="50" cy="50" r={R} fill="none" stroke="#3b82f6" strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  strokeDashoffset={dashOffset}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-gray-900 tabular-nums leading-none">{data.eta_min}</span>
                <span className="text-[9px] text-gray-500 font-medium">min</span>
              </div>
            </div>
            {/* Info */}
            <div className="flex-1 space-y-1.5">
              <p className="text-base font-black text-gray-900">
                Noch ca. {data.eta_min_low !== null ? `${data.eta_min_low}–${data.eta_min_high}` : data.eta_min} min
              </p>
              {data.fahrer_name && (
                <div className="flex items-center gap-1.5">
                  <Bike className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-xs text-gray-600">{data.fahrer_name}</span>
                  {data.fahrer_distanz_km !== null && (
                    <span className="text-[10px] text-gray-400">· {data.fahrer_distanz_km}km entfernt</span>
                  )}
                </div>
              )}
              {data.fahrer_telefon && (
                <a href={`tel:${data.fahrer_telefon}`} className="inline-flex items-center gap-1 text-[10px] text-blue-600 font-medium">
                  <Phone className="w-3 h-3" /> Fahrer anrufen
                </a>
              )}
              {data.letzte_aktualisierung && (
                <p className="text-[9px] text-gray-400 flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  Aktualisiert {new Date(data.letzte_aktualisierung).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
        ) : isGeliefert ? (
          <div className="flex flex-col items-center py-4 gap-2">
            <CheckCircle className="w-12 h-12 text-emerald-500" />
            <p className="text-lg font-black text-gray-900">Geliefert!</p>
            <p className="text-sm text-gray-500">Guten Appetit!</p>
          </div>
        ) : null}

        {/* Phasen-Timeline */}
        <div className="relative">
          <div className="absolute left-4 top-3 bottom-3 w-0.5 bg-gray-200" />
          <div className="space-y-3">
            {PHASE_CONFIG.map((p, i) => {
              const done = i < currentIdx;
              const active = i === currentIdx;
              const pending = i > currentIdx;
              const Icon = p.icon;
              return (
                <div key={p.key} className="flex items-center gap-3 relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 transition-all ${
                    done ? 'bg-emerald-500' : active ? 'bg-blue-600 ring-4 ring-blue-100 animate-pulse' : 'bg-gray-200'
                  }`}>
                    <Icon className={`w-4 h-4 ${done || active ? 'text-white' : 'text-gray-400'}`} />
                  </div>
                  <div className={`flex-1 ${pending ? 'opacity-40' : ''}`}>
                    <p className={`text-xs font-bold ${active ? 'text-blue-700' : done ? 'text-emerald-700' : 'text-gray-500'}`}>{p.label}</p>
                    <p className="text-[10px] text-gray-400">{p.desc}</p>
                  </div>
                  {done && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
