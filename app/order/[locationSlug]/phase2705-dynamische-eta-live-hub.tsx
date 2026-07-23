'use client';

import { useState, useEffect } from 'react';
import { Clock, MapPin, CheckCircle2, AlertTriangle, Bike, ChefHat, Package } from 'lucide-react';

type Phase = 'bestellt' | 'bestaetigt' | 'in_zubereitung' | 'unterwegs' | 'geliefert';

interface EtaData {
  order_id: string;
  status: Phase;
  eta_min: number | null;
  delay_min: number | null;
  konfidenz: number;
  fahrer_name: string | null;
  fahrer_distanz_km: number | null;
  bestellt_am: string | null;
}

const MOCK: EtaData = {
  order_id: 'mock',
  status: 'unterwegs',
  eta_min: 12,
  delay_min: null,
  konfidenz: 91,
  fahrer_name: 'Tom R.',
  fahrer_distanz_km: 1.8,
  bestellt_am: new Date(Date.now() - 22 * 60_000).toISOString(),
};

const PHASES: { key: Phase; label: string; icon: React.ReactNode }[] = [
  { key: 'bestellt', label: 'Bestellt', icon: <Package className="w-4 h-4" /> },
  { key: 'bestaetigt', label: 'Angenommen', icon: <CheckCircle2 className="w-4 h-4" /> },
  { key: 'in_zubereitung', label: 'In Küche', icon: <ChefHat className="w-4 h-4" /> },
  { key: 'unterwegs', label: 'Unterwegs', icon: <Bike className="w-4 h-4" /> },
  { key: 'geliefert', label: 'Geliefert', icon: <CheckCircle2 className="w-4 h-4" /> },
];

function phaseIdx(s: Phase): number {
  return PHASES.findIndex(p => p.key === s);
}

interface Props {
  orderId: string | null;
  locationSlug?: string;
}

export function StorefrontPhase2705DynamischeEtaLiveHub({ orderId, locationSlug }: Props) {
  const [data, setData] = useState<EtaData>(MOCK);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!orderId || orderId === '') return;
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/customer/eta?order_id=${orderId}`, { cache: 'no-store' });
        if (r.ok) {
          const d = await r.json();
          if (d?.status) setData(d);
        }
      } catch {}
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [orderId]);

  if (data.status === 'geliefert') {
    return (
      <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 p-6 text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
        <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">Geliefert! 🎉</div>
        <div className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">Guten Appetit!</div>
      </div>
    );
  }

  const curIdx = phaseIdx(data.status);
  const etaSecsLeft = data.eta_min !== null ? data.eta_min * 60 - tick : null;
  const etaMinLeft = etaSecsLeft !== null ? Math.max(0, Math.floor(etaSecsLeft / 60)) : null;
  const etaSecLeft = etaSecsLeft !== null ? Math.max(0, etaSecsLeft % 60) : null;

  const etaColor = etaMinLeft === null
    ? 'text-gray-400'
    : etaMinLeft > 35 ? 'text-red-500' : etaMinLeft > 20 ? 'text-amber-500' : 'text-emerald-500';

  const konfidenzColor = data.konfidenz >= 85 ? 'bg-emerald-500' : data.konfidenz >= 65 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div className="rounded-2xl border bg-white dark:bg-gray-900 shadow-lg overflow-hidden">
      {/* Header mit ETA-Countdown */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-900 px-5 py-4 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium opacity-80 uppercase tracking-wide mb-1">Lieferzeit</div>
            {etaMinLeft !== null && etaSecLeft !== null ? (
              <div className={`text-4xl font-black tabular-nums ${etaColor}`} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                {String(etaMinLeft).padStart(2, '0')}
                <span className="text-2xl opacity-70">:</span>
                {String(Math.floor(etaSecLeft)).padStart(2, '0')}
                <span className="text-sm font-normal ml-1 opacity-80">Min</span>
              </div>
            ) : (
              <div className="text-2xl font-black text-white/60">Wird berechnet…</div>
            )}
          </div>

          {/* Konfidenz-Ring */}
          <div className="text-center">
            <div className="text-xs opacity-80 mb-1">Konfidenz</div>
            <div className={`text-lg font-bold ${data.konfidenz >= 85 ? 'text-emerald-300' : data.konfidenz >= 65 ? 'text-amber-300' : 'text-red-300'}`}>
              {data.konfidenz}%
            </div>
            <div className="w-12 h-1.5 bg-white/20 rounded-full mt-1">
              <div className={`h-1.5 rounded-full ${konfidenzColor}`} style={{ width: `${data.konfidenz}%` }} />
            </div>
          </div>
        </div>

        {/* Verzögerungs-Warnung */}
        {data.delay_min !== null && data.delay_min > 0 && (
          <div className="flex items-center gap-2 mt-3 py-1.5 px-2.5 rounded-lg bg-white/10 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-yellow-300" />
            <span>+{data.delay_min} Min Verzögerung — wir entschuldigen uns!</span>
          </div>
        )}
      </div>

      {/* Phasen-Timeline */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between relative">
          {/* Verbindungslinie */}
          <div className="absolute left-4 right-4 top-4 h-0.5 bg-gray-100 dark:bg-gray-800" />
          <div
            className="absolute left-4 top-4 h-0.5 bg-blue-500 transition-all duration-500"
            style={{ width: curIdx > 0 ? `${(curIdx / (PHASES.length - 1)) * (100 - 8)}%` : '0%' }}
          />

          {PHASES.map((ph, i) => {
            const done = i < curIdx;
            const active = i === curIdx;
            return (
              <div key={ph.key} className="flex flex-col items-center gap-1 relative z-10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  done ? 'bg-blue-500 text-white'
                    : active ? 'bg-blue-500 text-white ring-4 ring-blue-100 dark:ring-blue-900/50'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                }`}>
                  {done ? <CheckCircle2 className="w-4 h-4" /> : ph.icon}
                </div>
                <span className={`text-[9px] font-medium text-center leading-tight ${active ? 'text-blue-600 dark:text-blue-400' : done ? 'text-gray-500' : 'text-gray-400'}`}>
                  {ph.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fahrer-Info */}
      {data.fahrer_name && data.status === 'unterwegs' && (
        <div className="px-4 py-3 flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50">
          <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
            <Bike className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{data.fahrer_name}</div>
            <div className="text-xs text-gray-500">Dein Fahrer</div>
          </div>
          {data.fahrer_distanz_km !== null && (
            <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
              <MapPin className="w-3 h-3" />
              <span>{data.fahrer_distanz_km} km</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
