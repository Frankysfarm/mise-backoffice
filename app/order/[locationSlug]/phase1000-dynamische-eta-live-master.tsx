'use client';
import { useEffect, useState } from 'react';
import { Clock, MapPin, Package, Truck, ChefHat, CheckCircle2 } from 'lucide-react';

interface EtaPhase {
  phase: 'bestellung' | 'zubereitung' | 'abholung' | 'lieferung' | 'geliefert';
  label: string;
  icon: 'bestellung' | 'zubereitung' | 'abholung' | 'lieferung' | 'geliefert';
  eta_min: number | null;
  aktiv: boolean;
  fertig: boolean;
}

interface ApiData {
  order_id: string;
  order_number: string;
  status: string;
  eta_min_gesamt: number | null;
  eta_min_verbleibend: number | null;
  eta_verlass: 'hoch' | 'mittel' | 'niedrig';
  fahrer_name: string | null;
  fahrer_distanz_km: number | null;
  fortschritt_pct: number;
  phasen: EtaPhase[];
}

const MOCK: ApiData = {
  order_id: 'o1',
  order_number: '#3001',
  status: 'in_zubereitung',
  eta_min_gesamt: 32,
  eta_min_verbleibend: 22,
  eta_verlass: 'hoch',
  fahrer_name: null,
  fahrer_distanz_km: null,
  fortschritt_pct: 35,
  phasen: [
    { phase: 'bestellung', label: 'Bestellung eingegangen', icon: 'bestellung', eta_min: null, aktiv: false, fertig: true },
    { phase: 'zubereitung', label: 'In Zubereitung', icon: 'zubereitung', eta_min: 15, aktiv: true, fertig: false },
    { phase: 'abholung', label: 'Abholung durch Fahrer', icon: 'abholung', eta_min: 18, aktiv: false, fertig: false },
    { phase: 'lieferung', label: 'Unterwegs zu dir', icon: 'lieferung', eta_min: 10, aktiv: false, fertig: false },
    { phase: 'geliefert', label: 'Geliefert', icon: 'geliefert', eta_min: null, aktiv: false, fertig: false },
  ],
};

function PhaseIcon({ type, className }: { type: string; className?: string }) {
  if (type === 'zubereitung') return <ChefHat className={className} />;
  if (type === 'abholung' || type === 'lieferung') return <Truck className={className} />;
  if (type === 'geliefert') return <CheckCircle2 className={className} />;
  if (type === 'bestellung') return <Package className={className} />;
  return <Clock className={className} />;
}

function verlassCls(v: string) {
  if (v === 'hoch')   return 'text-green-500';
  if (v === 'mittel') return 'text-amber-500';
  return 'text-red-500';
}

export function StorefrontPhase1000DynamischeEtaLiveMaster({
  orderId,
  locationSlug,
}: {
  orderId?: string;
  locationSlug?: string;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const load = () => {
      if (!orderId) { setData(MOCK); return; }
      fetch(`/api/order/eta?order_id=${orderId}&location=${locationSlug ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    };
    load();
    const poll = setInterval(load, 30_000);
    return () => clearInterval(poll);
  }, [orderId, locationSlug]);

  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const d = data ?? MOCK;

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg bg-white dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-500 px-4 py-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-green-100">Bestellung {d.order_number}</span>
          <span className={`text-xs font-bold ${verlassCls(d.eta_verlass)} bg-white/20 rounded-full px-2 py-0.5`}>
            {d.eta_verlass === 'hoch' ? '✓ Zuverlässige ETA' : d.eta_verlass === 'mittel' ? '~ Ungefähre ETA' : '⚠ ETA variabel'}
          </span>
        </div>
        {d.eta_min_verbleibend != null ? (
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-white tabular-nums">{d.eta_min_verbleibend}</span>
            <span className="text-lg text-green-200">Min</span>
            <span className="text-sm text-green-100 ml-1">verbleibend</span>
          </div>
        ) : (
          <div className="text-2xl font-black text-white">Bald bei dir!</div>
        )}
        {/* Fortschritts-Balken */}
        <div className="mt-3 h-2 rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-white transition-all duration-1000"
            style={{ width: `${d.fortschritt_pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-green-200">
          <span>Bestellung</span>
          <span>{d.fortschritt_pct}%</span>
          <span>Geliefert</span>
        </div>
      </div>

      {/* Phasen-Timeline */}
      <div className="px-4 py-4">
        <div className="space-y-0">
          {d.phasen.map((ph, i) => (
            <div key={ph.phase} className="flex items-start gap-3">
              {/* Icon + Linie */}
              <div className="flex flex-col items-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                  ph.fertig
                    ? 'bg-green-500 border-green-500 text-white'
                    : ph.aktiv
                    ? 'bg-green-50 border-green-500 text-green-600 dark:bg-green-900/30 dark:border-green-400 dark:text-green-400'
                    : 'bg-gray-100 border-gray-300 text-gray-400 dark:bg-gray-800 dark:border-gray-600'
                }`}>
                  <PhaseIcon type={ph.icon} className={`h-4 w-4 ${ph.aktiv ? 'animate-pulse' : ''}`} />
                </div>
                {i < d.phasen.length - 1 && (
                  <div className={`w-0.5 h-8 mt-0.5 transition-colors ${ph.fertig ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
                )}
              </div>

              {/* Text */}
              <div className="flex-1 pb-4 pt-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-semibold ${ph.fertig ? 'text-green-600 dark:text-green-400' : ph.aktiv ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>
                    {ph.label}
                  </span>
                  {ph.aktiv && ph.eta_min != null && (
                    <span className="flex items-center gap-1 text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded-full px-2 py-0.5 shrink-0">
                      <Clock className="h-2.5 w-2.5" />~{ph.eta_min} Min
                    </span>
                  )}
                  {ph.fertig && (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  )}
                </div>
                {ph.aktiv && d.fahrer_name && (
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    <MapPin className="h-3 w-3 shrink-0" />
                    Fahrer: <span className="font-semibold">{d.fahrer_name}</span>
                    {d.fahrer_distanz_km != null && <span className="ml-1">· {d.fahrer_distanz_km.toFixed(1)} km entfernt</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gesamt-ETA */}
      {d.eta_min_gesamt != null && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span className="text-[11px] text-gray-500">Gesamte Lieferzeit: <span className="font-bold text-gray-700 dark:text-gray-300">~{d.eta_min_gesamt} Min</span></span>
        </div>
      )}
    </div>
  );
}
