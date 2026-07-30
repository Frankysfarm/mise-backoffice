'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, MapPin, CheckCircle2, Bike, ChefHat, Package, Zap } from 'lucide-react';

interface EtaPhase {
  id: string;
  label: string;
  status: 'abgeschlossen' | 'aktiv' | 'ausstehend';
  eta_min: number | null;
  icon: 'kitchen' | 'package' | 'bike' | 'check';
}

interface LiveEtaData {
  order_id: string;
  bestellnummer: string;
  status: string;
  eta_gesamt_min: number;
  eta_verbleibend_min: number;
  fahrer_name: string | null;
  fahrer_km: number | null;
  phasen: EtaPhase[];
  fortschritt_pct: number;
  dynamisch: boolean;
  wetter_einfluss: boolean;
}

function phaseIcon(icon: string) {
  switch (icon) {
    case 'kitchen': return <ChefHat className="w-4 h-4" />;
    case 'package': return <Package className="w-4 h-4" />;
    case 'bike': return <Bike className="w-4 h-4" />;
    default: return <CheckCircle2 className="w-4 h-4" />;
  }
}

function phaseFarbe(status: string) {
  if (status === 'abgeschlossen') return 'bg-green-500 border-green-500 text-white';
  if (status === 'aktiv') return 'bg-amber-500 border-amber-500 text-white animate-pulse';
  return 'bg-slate-800 border-slate-700 text-slate-500';
}

function lineFarbe(status: string) {
  return status === 'abgeschlossen' ? 'bg-green-500' : 'bg-slate-700';
}

const MOCK: LiveEtaData = {
  order_id: 'o1',
  bestellnummer: '#1042',
  status: 'unterwegs',
  eta_gesamt_min: 32,
  eta_verbleibend_min: 8,
  fahrer_name: 'Jonas',
  fahrer_km: 1.2,
  fortschritt_pct: 75,
  dynamisch: true,
  wetter_einfluss: false,
  phasen: [
    { id: '1', label: 'Bestellung erhalten', status: 'abgeschlossen', eta_min: null, icon: 'check' },
    { id: '2', label: 'Küche kocht', status: 'abgeschlossen', eta_min: null, icon: 'kitchen' },
    { id: '3', label: 'Fahrer holt ab', status: 'abgeschlossen', eta_min: null, icon: 'package' },
    { id: '4', label: 'Unterwegs zu dir', status: 'aktiv', eta_min: 8, icon: 'bike' },
    { id: '5', label: 'Geliefert!', status: 'ausstehend', eta_min: null, icon: 'check' },
  ],
};

export function BestellEtaLiveCockpit({ orderId }: { orderId: string }) {
  const [data, setData] = useState<LiveEtaData | null>(null);
  const [tick, setTick] = useState(0);
  const [localMin, setLocalMin] = useState<number | null>(null);
  const tickRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  async function load() {
    if (!orderId) { setData(MOCK); setLocalMin(MOCK.eta_verbleibend_min); return; }
    try {
      const res = await fetch(`/api/delivery/order/eta?order_id=${orderId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLocalMin(json.eta_verbleibend_min);
      } else {
        setData(MOCK); setLocalMin(MOCK.eta_verbleibend_min);
      }
    } catch {
      setData(MOCK); setLocalMin(MOCK.eta_verbleibend_min);
    }
  }

  useEffect(() => {
    load();
    tickRef.current = setInterval(() => {
      setTick(t => t + 1);
      setLocalMin(prev => (prev !== null && prev > 0 ? prev - (1 / 60) : prev));
    }, 1000);
    pollRef.current = setInterval(load, 30_000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (!data) return null;
  if (data.status === 'geliefert' || data.status === 'abgeholt') return null;

  const verbleibend = localMin !== null ? Math.max(0, Math.round(localMin)) : data.eta_verbleibend_min;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-4 space-y-4">
      {/* ETA Kopf */}
      <div className="text-center">
        <div className="text-sm text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-center gap-1.5">
          <Clock className="w-4 h-4" />
          <span>Voraussichtliche Lieferzeit</span>
          {data.dynamisch && (
            <span className="text-xs text-amber-500 flex items-center gap-0.5">
              <Zap className="w-3 h-3" /> Live
            </span>
          )}
        </div>
        <div className="text-4xl font-bold text-slate-900 dark:text-slate-100">
          {verbleibend} <span className="text-2xl font-medium text-slate-500">min</span>
        </div>
        {data.wetter_einfluss && (
          <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">🌧️ Wetter verlangsamt leicht die Lieferung</div>
        )}
      </div>

      {/* Phasen-Timeline */}
      <div className="relative">
        <div className="flex items-start justify-between">
          {data.phasen.map((phase, i) => (
            <div key={phase.id} className="flex flex-col items-center flex-1">
              {/* Verbindungslinie links */}
              <div className="flex items-center w-full mb-2">
                {i > 0 && (
                  <div className={`flex-1 h-0.5 ${lineFarbe(phase.status)}`} />
                )}
                {/* Icon-Kreis */}
                <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 ${phaseFarbe(phase.status)}`}>
                  {phaseIcon(phase.icon)}
                </div>
                {i < data.phasen.length - 1 && (
                  <div className={`flex-1 h-0.5 ${lineFarbe(data.phasen[i + 1]?.status ?? 'ausstehend')}`} />
                )}
              </div>
              {/* Label + ETA */}
              <div className="text-center px-1">
                <div className={`text-xs font-medium leading-tight ${
                  phase.status === 'aktiv' ? 'text-amber-600 dark:text-amber-400' :
                  phase.status === 'abgeschlossen' ? 'text-green-600 dark:text-green-400' :
                  'text-slate-400 dark:text-slate-500'
                }`}>
                  {phase.label}
                </div>
                {phase.status === 'aktiv' && phase.eta_min !== null && (
                  <div className="text-xs text-amber-500 font-mono mt-0.5">~{phase.eta_min} min</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fortschrittsbalken */}
      <div>
        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-1000"
            style={{ width: `${data.fortschritt_pct}%` }}
          />
        </div>
      </div>

      {/* Fahrer-Info */}
      {data.fahrer_name && (
        <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <Bike className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{data.fahrer_name}</div>
              <div className="text-xs text-slate-500">Dein Fahrer</div>
            </div>
          </div>
          {data.fahrer_km !== null && (
            <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{data.fahrer_km.toFixed(1)} km</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
