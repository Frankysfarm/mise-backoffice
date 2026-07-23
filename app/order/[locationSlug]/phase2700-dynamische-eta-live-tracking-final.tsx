'use client';

import { useState, useEffect } from 'react';
import { Clock, MapPin, CheckCircle2, AlertTriangle, Bike } from 'lucide-react';

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
  eta_min: 14,
  delay_min: null,
  konfidenz: 88,
  fahrer_name: 'Kai W.',
  fahrer_distanz_km: 2.3,
  bestellt_am: new Date(Date.now() - 18 * 60_000).toISOString(),
};

const PHASES: { key: Phase; label: string; icon: string }[] = [
  { key: 'bestellt', label: 'Bestellt', icon: '📋' },
  { key: 'bestaetigt', label: 'Angenommen', icon: '✅' },
  { key: 'in_zubereitung', label: 'In Küche', icon: '👨‍🍳' },
  { key: 'unterwegs', label: 'Unterwegs', icon: '🚴' },
  { key: 'geliefert', label: 'Geliefert', icon: '🎉' },
];

function phaseIdx(s: Phase) {
  return PHASES.findIndex(p => p.key === s);
}

function elapsedMin(since: string | null) {
  if (!since) return null;
  return Math.floor((Date.now() - new Date(since).getTime()) / 60_000);
}

interface Props {
  orderId: string | null;
  locationSlug?: string;
}

export function StorefrontPhase2700DynamischeEtaLiveTrackingFinal({ orderId, locationSlug }: Props) {
  const [data, setData] = useState<EtaData>(MOCK);
  const [tick, setTick] = useState(0);

  // Sekunden-Tick für den Countdown
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Polling
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
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [orderId]);

  if (data.status === 'geliefert') {
    return (
      <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 p-6 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
        <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">Geliefert! 🎉</div>
        <div className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">Guten Appetit!</div>
      </div>
    );
  }

  const curIdx = phaseIdx(data.status);
  const etaSecsLeft = data.eta_min !== null ? data.eta_min * 60 - tick : null;
  const etaMinLeft = etaSecsLeft !== null ? Math.max(0, Math.floor(etaSecsLeft / 60)) : null;
  const etaSecLeft = etaSecsLeft !== null ? Math.max(0, Math.floor(etaSecsLeft % 60)) : null;
  const elapsed = elapsedMin(data.bestellt_am);

  const etaColor = data.eta_min !== null
    ? data.eta_min > 40 ? 'text-red-500' : data.eta_min > 25 ? 'text-amber-500' : 'text-emerald-500'
    : 'text-gray-400';

  return (
    <div className="rounded-2xl border bg-white dark:bg-gray-900 shadow-lg overflow-hidden">
      {/* ETA Hero */}
      <div className="bg-gradient-to-br from-matcha-600 to-matcha-700 p-5 text-white">
        <div className="text-xs uppercase tracking-widest opacity-70 mb-1">Deine Lieferung</div>
        <div className="flex items-end gap-3">
          <div>
            <div className="text-[11px] opacity-70 mb-1">Noch ca.</div>
            <div className="text-6xl font-black font-mono tabular-nums leading-none">
              {etaMinLeft !== null ? etaMinLeft : '—'}
            </div>
            <div className="text-sm opacity-80 mt-1">Minuten</div>
          </div>

          {etaSecsLeft !== null && etaMinLeft === 0 && etaSecLeft !== null && (
            <div className="mb-1">
              <div className="text-2xl font-bold font-mono tabular-nums">:{etaSecLeft.toString().padStart(2, '0')}</div>
            </div>
          )}

          <div className="ml-auto text-right">
            {data.delay_min && data.delay_min > 0 ? (
              <div className="flex items-center gap-1 text-xs bg-red-500/30 rounded-lg px-2 py-1">
                <AlertTriangle className="w-3 h-3" />
                +{data.delay_min} Min Verzögerung
              </div>
            ) : (
              <div className="text-xs bg-white/20 rounded-lg px-2 py-1">
                {data.konfidenz}% Genauigkeit
              </div>
            )}
            {elapsed !== null && (
              <div className="text-[10px] opacity-60 mt-1">Bestellt vor {elapsed} Min</div>
            )}
          </div>
        </div>
      </div>

      {/* Phase Timeline */}
      <div className="px-4 py-4 border-b">
        <div className="flex items-center">
          {PHASES.map((p, i) => {
            const done = i < curIdx;
            const active = i === curIdx;
            const isLast = i === PHASES.length - 1;
            return (
              <div key={p.key} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center flex-1 min-w-0">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0
                    ${done ? 'bg-matcha-100 text-matcha-700' :
                      active ? 'bg-matcha-500 text-white shadow-md ring-2 ring-matcha-300 ring-offset-1 scale-110' :
                               'bg-gray-100 text-gray-400'}
                    transition-all duration-300
                  `}>
                    {done ? '✓' : p.icon}
                  </div>
                  <div className={`text-[9px] mt-1.5 text-center leading-tight px-0.5 ${
                    active ? 'text-matcha-600 font-bold' : done ? 'text-matcha-500' : 'text-gray-400'
                  }`}>
                    {p.label}
                  </div>
                </div>
                {!isLast && (
                  <div className={`h-0.5 flex-shrink-0 w-2 mx-0.5 rounded-full ${
                    i < curIdx ? 'bg-matcha-400' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Driver Info */}
      {data.fahrer_name && data.status === 'unterwegs' && (
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-matcha-100 flex items-center justify-center text-lg shrink-0">
            🚴
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">{data.fahrer_name}</div>
            <div className="text-xs text-gray-500">Dein Fahrer ist unterwegs</div>
          </div>
          {data.fahrer_distanz_km !== null && (
            <div className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
              <MapPin className="w-3 h-3 text-matcha-500" />
              <span className="font-medium text-matcha-600">{data.fahrer_distanz_km.toFixed(1)} km</span>
              <span>entfernt</span>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="border-t px-4 py-2 flex items-center gap-1.5 text-[10px] text-gray-400">
        <Clock className="w-3 h-3" />
        Echtzeit-Update alle 20 Sek. · Genauigkeit {data.konfidenz}%
      </div>
    </div>
  );
}
