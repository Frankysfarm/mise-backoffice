'use client';

import { useEffect, useState } from 'react';
import { Clock, MapPin, Bike, CheckCircle2, Package, ChefHat, Zap } from 'lucide-react';

type Phase = 'bestaetigt' | 'zubereitung' | 'bereit' | 'unterwegs' | 'geliefert';

interface EtaData {
  phase: Phase;
  eta_min: number;
  eta_min_max: number;
  fahrer_name: string | null;
  distanz_m: number | null;
  on_time: boolean;
  bestellnummer: string;
}

const MOCK: EtaData = {
  phase: 'unterwegs',
  eta_min: 8,
  eta_min_max: 12,
  fahrer_name: 'Thomas K.',
  distanz_m: 1200,
  on_time: true,
  bestellnummer: '#2099',
};

const PHASE_CONFIG: Record<Phase, { label: string; icon: React.ReactNode; color: string; step: number }> = {
  bestaetigt:  { label: 'Bestätigt',    icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-blue-600',    step: 1 },
  zubereitung: { label: 'In Zubereitung', icon: <ChefHat className="w-4 h-4" />,  color: 'text-orange-500',  step: 2 },
  bereit:      { label: 'Abholbereit',  icon: <Package className="w-4 h-4" />,     color: 'text-yellow-500',  step: 3 },
  unterwegs:   { label: 'Unterwegs',    icon: <Bike className="w-4 h-4" />,        color: 'text-indigo-600',  step: 4 },
  geliefert:   { label: 'Geliefert',    icon: <CheckCircle2 className="w-4 h-4" />,color: 'text-emerald-600', step: 5 },
};

const PHASES_ORDER: Phase[] = ['bestaetigt', 'zubereitung', 'bereit', 'unterwegs', 'geliefert'];

export function Phase4455DynamischeEtaLiveHub({ bestellnummer }: { bestellnummer?: string }) {
  const [data, setData] = useState<EtaData | null>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const p = bestellnummer ? `?bestellnummer=${encodeURIComponent(bestellnummer)}` : '';
        const res = await fetch(`/api/delivery/storefront/eta-live${p}`);
        if (!res.ok) throw new Error();
        const json: EtaData = await res.json();
        if (!cancelled) { setData(json); setPulse(true); setTimeout(() => setPulse(false), 800); }
      } catch {
        if (!cancelled) setData(MOCK);
      }
    }

    load();
    const iv = setInterval(load, 20_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [bestellnummer]);

  if (!data) return <div className="rounded-2xl border border-gray-200 bg-white p-4 animate-pulse h-48" />;

  const config = PHASE_CONFIG[data.phase];
  const currentStep = config.step;
  const etaColor = data.on_time ? 'text-emerald-600' : 'text-orange-500';

  return (
    <div className={`rounded-2xl border-2 border-indigo-200 bg-white p-4 space-y-4 transition-all duration-300 ${pulse ? 'border-indigo-400 shadow-lg shadow-indigo-100' : ''}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-indigo-600" />
        <h3 className="font-bold text-gray-900">Live-Tracking {data.bestellnummer}</h3>
        {data.on_time && (
          <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-medium">Pünktlich</span>
        )}
      </div>

      {/* ETA */}
      <div className="text-center py-2">
        <div className={`text-4xl font-bold ${etaColor}`}>
          {data.eta_min}–{data.eta_min_max}
          <span className="text-lg ml-1 font-normal text-gray-500">min</span>
        </div>
        <p className="text-sm text-gray-500 mt-1">Voraussichtliche Ankunft</p>
      </div>

      {/* Fahrer */}
      {data.fahrer_name && data.phase === 'unterwegs' && (
        <div className="flex items-center gap-2 rounded-xl bg-indigo-50 border border-indigo-200 px-3 py-2">
          <Bike className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-medium text-indigo-700">{data.fahrer_name} ist unterwegs</span>
          {data.distanz_m && (
            <span className="ml-auto text-xs text-gray-400">{(data.distanz_m / 1000).toFixed(1)} km</span>
          )}
        </div>
      )}

      {/* Phasen-Leiste */}
      <div className="flex items-center justify-between">
        {PHASES_ORDER.map((phase, i) => {
          const cfg = PHASE_CONFIG[phase];
          const done = cfg.step <= currentStep;
          const active = cfg.step === currentStep;

          return (
            <div key={phase} className="flex items-center flex-1">
              <div className={`flex flex-col items-center gap-1 ${done ? cfg.color : 'text-gray-300'} ${active ? 'scale-110' : ''} transition-transform`}>
                {cfg.icon}
                <span className={`text-xs font-medium ${active ? 'text-gray-800' : done ? 'text-gray-600' : 'text-gray-300'}`} style={{ fontSize: '10px' }}>
                  {cfg.label}
                </span>
              </div>
              {i < PHASES_ORDER.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 rounded-full transition-colors ${cfg.step < currentStep ? 'bg-indigo-400' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1 text-xs text-gray-400">
        <Clock className="w-3.5 h-3.5" />
        <span>Aktualisiert alle 20 Sek.</span>
        {data.distanz_m && data.phase === 'unterwegs' && (
          <>
            <MapPin className="w-3.5 h-3.5 ml-2" />
            <span>Noch {(data.distanz_m / 1000).toFixed(1)} km entfernt</span>
          </>
        )}
      </div>
    </div>
  );
}
