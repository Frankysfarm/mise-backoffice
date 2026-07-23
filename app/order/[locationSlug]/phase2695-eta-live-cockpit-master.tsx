'use client';

import { useEffect, useState } from 'react';
import { Clock, MapPin, CheckCircle2, Star, AlertTriangle } from 'lucide-react';

type OrderPhase = 'bestellt' | 'bestaetigt' | 'in_zubereitung' | 'unterwegs' | 'geliefert';

interface EtaLive {
  order_id: string;
  status: OrderPhase;
  eta_min: number | null;
  delay_min: number | null;
  konfidenz: number;
  fahrer_name: string | null;
  fahrer_rating: number | null;
  fahrer_distanz_km: number | null;
  bestellt_am: string | null;
  delivered_at: string | null;
}

const MOCK: EtaLive = {
  order_id: 'mock',
  status: 'unterwegs',
  eta_min: 11,
  delay_min: null,
  konfidenz: 91,
  fahrer_name: 'Kai W.',
  fahrer_rating: 4.8,
  fahrer_distanz_km: 1.9,
  bestellt_am: new Date(Date.now() - 16 * 60_000).toISOString(),
  delivered_at: null,
};

const PHASE_DEF: { key: OrderPhase; label: string; emoji: string }[] = [
  { key: 'bestellt',       label: 'Bestellt',   emoji: '📋' },
  { key: 'bestaetigt',     label: 'Bestätigt',  emoji: '✅' },
  { key: 'in_zubereitung', label: 'In Küche',   emoji: '🍳' },
  { key: 'unterwegs',      label: 'Unterwegs',  emoji: '🚴' },
  { key: 'geliefert',      label: 'Geliefert',  emoji: '🎉' },
];

function phaseIdx(s: OrderPhase): number {
  return PHASE_DEF.findIndex(p => p.key === s);
}

function konfidenzColor(k: number): string {
  if (k >= 85) return '#10b981';
  if (k >= 65) return '#f59e0b';
  return '#ef4444';
}

function KonfidenzRing({ value }: { value: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value / 100);
  const color = konfidenzColor(value);
  return (
    <svg width="44" height="44" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${circ} ${circ}`} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 22 22)" />
      <text x="22" y="27" textAnchor="middle" style={{ fontSize: 10, fontWeight: 800, fill: color }}>{value}%</text>
    </svg>
  );
}

interface Props {
  orderId: string | null;
  locationSlug?: string;
}

export function StorefrontPhase2695EtaLiveCockpitMaster({ orderId, locationSlug }: Props) {
  const [data, setData] = useState<EtaLive>(MOCK);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!orderId || orderId === '') return;
      try {
        const r = await fetch(`/api/delivery/customer/eta?order_id=${orderId}`, { cache: 'no-store' });
        if (r.ok) setData(await r.json());
      } catch {}
    };
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [orderId]);

  if (data.status === 'geliefert') {
    return (
      <div className="rounded-xl border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 p-4 text-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1" />
        <div className="font-bold text-emerald-700 dark:text-emerald-300">Geliefert! Guten Appetit 🎉</div>
      </div>
    );
  }

  const etaSec = data.eta_min !== null ? data.eta_min * 60 - tick : null;
  const etaMin = etaSec !== null ? Math.max(0, Math.ceil(etaSec / 60)) : null;
  const curIdx = phaseIdx(data.status);

  return (
    <div className="rounded-xl border bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      {/* ETA Hero */}
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs opacity-80 uppercase tracking-wide">Noch ca.</div>
            <div className="text-5xl font-bold font-mono tabular-nums leading-none">
              {etaMin !== null ? etaMin : '—'}
            </div>
            <div className="text-xs opacity-80 mt-0.5">Minuten</div>
          </div>
          <div className="text-right">
            <KonfidenzRing value={data.konfidenz} />
            <div className="text-[10px] opacity-70 mt-0.5">Genauigkeit</div>
          </div>
        </div>

        {/* Delay-Warnung */}
        {data.delay_min && data.delay_min > 0 && (
          <div className="mt-2 flex items-center gap-1.5 bg-white/20 rounded-lg px-2.5 py-1.5 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Verzögerung von ca. {data.delay_min} Min — wir entschuldigen uns!
          </div>
        )}
      </div>

      {/* Phasen-Timeline */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-0">
          {PHASE_DEF.map((p, i) => {
            const done = i < curIdx;
            const active = i === curIdx;
            const isLast = i === PHASE_DEF.length - 1;
            return (
              <div key={p.key} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center flex-1 min-w-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                    done   ? 'bg-emerald-100 text-emerald-700' :
                    active ? 'bg-emerald-500 text-white shadow-md ring-2 ring-emerald-300' :
                             'bg-gray-100 text-gray-400'
                  }`}>
                    {p.emoji}
                  </div>
                  <div className={`text-[9px] mt-1 text-center leading-tight truncate w-full ${
                    active ? 'text-emerald-600 font-semibold' : done ? 'text-emerald-500' : 'text-gray-400'
                  }`}>
                    {p.label}
                  </div>
                </div>
                {!isLast && (
                  <div className={`h-0.5 flex-1 mx-0.5 rounded-full ${i < curIdx ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Fahrer-Info */}
      {data.fahrer_name && (
        <div className="border-t px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm">
              🚴
            </div>
            <div>
              <div className="text-xs font-semibold">{data.fahrer_name}</div>
              {data.fahrer_rating && (
                <div className="flex items-center gap-0.5 text-[10px] text-yellow-600">
                  <Star className="w-2.5 h-2.5 fill-yellow-400 stroke-yellow-400" />
                  {data.fahrer_rating.toFixed(1)}
                </div>
              )}
            </div>
          </div>
          {data.fahrer_distanz_km !== null && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <MapPin className="w-3 h-3" />
              {data.fahrer_distanz_km.toFixed(1)} km entfernt
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="border-t px-4 py-1.5 flex items-center gap-1 text-[10px] text-gray-400">
        <Clock className="w-3 h-3" />
        Echtzeit-Update alle 20 Sek.
      </div>
    </div>
  );
}
