'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, MapPin, Navigation, Package, Zap } from 'lucide-react';

interface EtaData {
  order_id: string;
  order_number: string;
  status: 'bestätigt' | 'in_zubereitung' | 'bereit' | 'unterwegs' | 'geliefert';
  eta_min: number | null;
  eta_confidence: number;
  fahrer_name: string | null;
  fahrer_eta_min: number | null;
  prep_pct: number;
  verspaetung_min: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

const STATUS_STEPS = ['bestätigt', 'in_zubereitung', 'bereit', 'unterwegs', 'geliefert'] as const;

const STATUS_LABEL: Record<string, string> = {
  bestätigt:      'Bestätigt',
  in_zubereitung: 'In Zubereitung',
  bereit:         'Fertig',
  unterwegs:      'Unterwegs',
  geliefert:      'Geliefert',
};

const MOCK: EtaData = {
  order_id: 'o1',
  order_number: '#6001',
  status: 'unterwegs',
  eta_min: 8,
  eta_confidence: 87,
  fahrer_name: 'Max M.',
  fahrer_eta_min: 8,
  prep_pct: 100,
  verspaetung_min: 0,
  ampel: 'gruen',
};

const AMP_COLOR = {
  gruen: 'text-green-400',
  gelb:  'text-amber-400',
  rot:   'text-red-400',
};

const AMP_BG = {
  gruen: 'bg-green-500',
  gelb:  'bg-amber-400',
  rot:   'bg-red-500',
};

export function StorefrontPhase2670DynamischeEtaLiveTrackingUltraPro({ orderId, locationSlug }: { orderId: string | null; locationSlug: string }) {
  const [data, setData] = useState<EtaData | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/eta?order_id=${orderId ?? ''}&location=${locationSlug}`)
        .then(r => r.json())
        .then((d: EtaData) => setData(d))
        .catch(() => setData(MOCK));
    if (orderId) load(); else setData(MOCK);
    const p = setInterval(load, 20_000);
    return () => clearInterval(p);
  }, [orderId, locationSlug]);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const d = data ?? MOCK;
  const stepIdx = STATUS_STEPS.indexOf(d.status as typeof STATUS_STEPS[number]);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-md overflow-hidden">
      {/* ETA Hero */}
      <div className="px-5 py-5 text-center border-b border-gray-100 dark:border-gray-800">
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Voraussichtliche Lieferung</p>
        {d.status === 'geliefert' ? (
          <div className="flex items-center justify-center gap-2 text-green-500">
            <CheckCircle2 className="h-8 w-8" />
            <span className="text-2xl font-black">Geliefert!</span>
          </div>
        ) : d.eta_min !== null ? (
          <>
            <p className={`text-5xl font-black tabular-nums ${AMP_COLOR[d.ampel]}`}>{d.eta_min}<span className="text-2xl font-medium ml-1">Min</span></p>
            <div className="flex items-center justify-center gap-2 mt-1.5">
              <Zap className="h-3 w-3 text-gray-400" />
              <span className="text-xs text-gray-500">Konfidenz <span className="font-bold text-gray-700 dark:text-gray-300">{d.eta_confidence}%</span></span>
              {d.verspaetung_min > 0 && (
                <span className="flex items-center gap-1 text-xs text-red-500">
                  <AlertTriangle className="h-3 w-3" />+{d.verspaetung_min}m Verzögerung
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="text-xl text-gray-500 dark:text-gray-400">Wird berechnet…</p>
        )}
      </div>

      {/* Status-Timeline */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-0">
          {STATUS_STEPS.map((step, i) => {
            const done = i < stepIdx;
            const current = i === stepIdx;
            return (
              <div key={step} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div className={`h-3 w-3 rounded-full border-2 transition-colors duration-500 ${
                    done    ? 'bg-green-500 border-green-500'
                    : current ? `${AMP_BG[d.ampel]} border-current animate-pulse`
                    : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                  }`} />
                  <span className={`text-[9px] leading-tight text-center w-14 ${
                    current ? `font-bold ${AMP_COLOR[d.ampel]}` : done ? 'text-green-500' : 'text-gray-400'
                  }`}>{STATUS_LABEL[step]}</span>
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mb-4 transition-colors duration-700 ${done ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Fahrer-Info */}
      {d.fahrer_name && d.status === 'unterwegs' && (
        <div className="px-5 pb-4">
          <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-4 py-3 flex items-center gap-3">
            <Navigation className="h-5 w-5 text-blue-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-blue-800 dark:text-blue-200">{d.fahrer_name} ist unterwegs</p>
              {d.fahrer_eta_min !== null && (
                <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3" />Ankunft in ca. {d.fahrer_eta_min} Minuten
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 text-blue-700 dark:text-blue-300">
              <MapPin className="h-4 w-4" />
              <Package className="h-4 w-4" />
            </div>
          </div>
        </div>
      )}

      {/* Prep-Fortschritt (wenn in Zubereitung) */}
      {d.status === 'in_zubereitung' && (
        <div className="px-5 pb-4">
          <div className="flex items-center justify-between mb-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span>Zubereitung</span><span>{d.prep_pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-amber-400 transition-all duration-1000" style={{ width: `${d.prep_pct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
