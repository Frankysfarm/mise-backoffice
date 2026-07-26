'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, MapPin, CheckCircle2, Bike, ChefHat, Package, Navigation } from 'lucide-react';

interface PhaseStep {
  key: 'bestellt' | 'zubereitung' | 'abholung' | 'unterwegs' | 'geliefert';
  label: string;
  icon: React.ReactNode;
  done: boolean;
  aktiv: boolean;
  eta_min: number | null;
}

interface EtaData {
  eta_min: number;
  eta_min_max: number;
  phase: PhaseStep['key'];
  distanz_km: number | null;
  fahrer_name: string | null;
  on_time: boolean;
  confidence_pct: number;
}

const MOCK: EtaData = {
  eta_min: 18,
  eta_min_max: 24,
  phase: 'unterwegs',
  distanz_km: 1.4,
  fahrer_name: 'Max K.',
  on_time: true,
  confidence_pct: 87,
};

function buildSteps(phase: PhaseStep['key']): Omit<PhaseStep, 'icon'>[] {
  const order: PhaseStep['key'][] = ['bestellt', 'zubereitung', 'abholung', 'unterwegs', 'geliefert'];
  const currentIdx = order.indexOf(phase);
  return order.map((key, i) => ({
    key,
    label: key === 'bestellt' ? 'Bestätigt' : key === 'zubereitung' ? 'In Zubereitung' : key === 'abholung' ? 'Abgeholt' : key === 'unterwegs' ? 'Unterwegs' : 'Geliefert',
    done: i < currentIdx,
    aktiv: i === currentIdx,
    eta_min: null,
  }));
}

export function Phase2725DynamischeEtaLiveTrackingSupreme({
  bestellnummer,
  locationId,
}: {
  bestellnummer: string;
  locationId: string | null;
}) {
  const [data, setData] = useState<EtaData>(MOCK);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    if (!bestellnummer || !locationId) return;
    try {
      const res = await fetch(`/api/delivery/customer/eta?bestellnummer=${bestellnummer}&location_id=${locationId}`);
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } catch { /* Mock-Fallback */ }
  }, [bestellnummer, locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []);

  const steps = buildSteps(data.phase);

  const phaseIcons: Record<PhaseStep['key'], React.ReactNode> = {
    bestellt:    <Package className="h-3.5 w-3.5" />,
    zubereitung: <ChefHat className="h-3.5 w-3.5" />,
    abholung:    <Package className="h-3.5 w-3.5" />,
    unterwegs:   <Bike className="h-3.5 w-3.5" />,
    geliefert:   <CheckCircle2 className="h-3.5 w-3.5" />,
  };

  const isDone = data.phase === 'geliefert';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
      {/* ETA-Hero */}
      <div className="text-center">
        {isDone ? (
          <div className="flex flex-col items-center gap-1">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <span className="text-lg font-bold text-emerald-700">Geliefert!</span>
            <span className="text-xs text-slate-500">Guten Appetit 🍽️</span>
          </div>
        ) : (
          <>
            <div className="text-xs text-slate-500 mb-0.5">Voraussichtliche Lieferzeit</div>
            <div className="text-3xl font-black text-slate-800">
              {data.eta_min}–{data.eta_min_max}<span className="text-lg font-medium text-slate-500 ml-1">min</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <span className={`h-2 w-2 rounded-full ${data.on_time ? 'bg-emerald-500' : 'bg-orange-400'}`} />
              <span className={`text-[10px] font-medium ${data.on_time ? 'text-emerald-700' : 'text-orange-600'}`}>
                {data.on_time ? 'Pünktlich' : 'Leichte Verzögerung'}
              </span>
              <span className="text-[10px] text-slate-400">· {data.confidence_pct}% Konfidenz</span>
            </div>
          </>
        )}
      </div>

      {/* Phasen-Timeline */}
      <div className="flex items-center justify-between px-1">
        {steps.map((s, i) => (
          <div key={s.key} className="flex flex-col items-center" style={{ flex: 1 }}>
            <div className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all
              ${s.done  ? 'border-emerald-500 bg-emerald-500 text-white'
              : s.aktiv ? 'border-blue-500 bg-blue-500 text-white animate-pulse'
              : 'border-slate-200 bg-slate-100 text-slate-400'}`}>
              {phaseIcons[s.key]}
            </div>
            <span className={`text-[8px] mt-0.5 text-center leading-tight
              ${s.done ? 'text-emerald-600' : s.aktiv ? 'text-blue-600 font-semibold' : 'text-slate-400'}`}>
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div className={`absolute hidden`} />
            )}
          </div>
        ))}
      </div>

      {/* Verbindungslinien zwischen Steps */}
      <div className="relative -mt-8 mb-2 px-4">
        <div className="flex items-center">
          {steps.map((s, i) => (
            i < steps.length - 1 ? (
              <div key={`line-${i}`} className="flex-1 flex items-center justify-center">
                <div className={`h-0.5 w-full ${s.done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
              </div>
            ) : null
          ))}
        </div>
      </div>

      {/* Fahrer-Info & Distanz */}
      {data.phase === 'unterwegs' && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
          <div className="flex items-center gap-2">
            <Navigation className="h-4 w-4 text-blue-500" />
            <div className="flex-1">
              <div className="text-xs font-semibold text-blue-800">
                {data.fahrer_name ? `${data.fahrer_name} ist unterwegs` : 'Fahrer unterwegs'}
              </div>
              {data.distanz_km && (
                <div className="text-[10px] text-blue-600">Noch ca. {data.distanz_km}km entfernt</div>
              )}
            </div>
            <div className="flex items-center gap-1 text-blue-600">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-sm font-bold">{data.eta_min}min</span>
            </div>
          </div>
        </div>
      )}

      <div className="text-center text-[10px] text-slate-400">Live-Tracking · alle 30 Sek. aktualisiert</div>
    </div>
  );
}
