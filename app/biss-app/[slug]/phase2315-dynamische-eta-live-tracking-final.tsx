'use client';

import { useState, useEffect } from 'react';
import { Clock, MapPin, CheckCircle2, AlertTriangle } from 'lucide-react';

type Phase = 'bestellt' | 'bestaetigt' | 'in_zubereitung' | 'unterwegs' | 'geliefert';

interface EtaData {
  order_id: string;
  status: Phase;
  eta_min: number | null;
  delay_min: number | null;
  konfidenz: number;
  fahrer_name: string | null;
  fahrer_distanz_km: number | null;
}

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

interface Props {
  orderId: string;
  bestellnummer?: string;
}

export function BissPhase2315DynamischeEtaLiveTrackingFinal({ orderId, bestellnummer }: Props) {
  const [data, setData] = useState<EtaData | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!orderId) return;
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

  if (!data) return null;

  if (data.status === 'geliefert') {
    return (
      <div className="rounded-2xl border-2 border-matcha-400 bg-matcha-50 p-4 text-center">
        <CheckCircle2 className="w-8 h-8 text-matcha-500 mx-auto mb-1" />
        <div className="font-bold text-matcha-700">Geliefert! Guten Appetit 🎉</div>
      </div>
    );
  }

  const curIdx = phaseIdx(data.status);
  const etaSecsLeft = data.eta_min !== null ? data.eta_min * 60 - tick : null;
  const etaMinLeft = etaSecsLeft !== null ? Math.max(0, Math.floor(etaSecsLeft / 60)) : null;
  const etaSecLeft = etaSecsLeft !== null ? Math.max(0, Math.floor(etaSecsLeft % 60)) : null;

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {/* ETA Hero */}
      <div className="bg-gradient-to-br from-matcha-600 to-matcha-700 p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            {bestellnummer && <div className="text-[10px] opacity-60 mb-1">Bestellung {bestellnummer}</div>}
            <div className="text-[10px] opacity-70 uppercase tracking-wide">Noch ca.</div>
            <div className="flex items-end gap-1">
              <span className="text-5xl font-black font-mono tabular-nums leading-none">
                {etaMinLeft !== null ? etaMinLeft : '—'}
              </span>
              <span className="text-sm opacity-80 mb-1">Min</span>
              {etaMinLeft === 0 && etaSecLeft !== null && (
                <span className="text-2xl font-bold font-mono tabular-nums mb-0.5">:{etaSecLeft.toString().padStart(2, '0')}</span>
              )}
            </div>
          </div>
          <div className="text-right">
            {data.delay_min && data.delay_min > 0 ? (
              <div className="flex items-center gap-1 text-xs bg-red-500/30 rounded-lg px-2 py-1">
                <AlertTriangle className="w-3 h-3" /> +{data.delay_min} Min
              </div>
            ) : (
              <div className="text-xs bg-white/20 rounded-lg px-2 py-1.5 text-center">
                <div className="font-bold text-lg">{data.konfidenz}%</div>
                <div className="opacity-70 text-[9px]">Genauigkeit</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Phase Timeline */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center">
          {PHASES.map((p, i) => {
            const done = i < curIdx;
            const active = i === curIdx;
            return (
              <div key={p.key} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center flex-1 min-w-0">
                  <div className={`
                    w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0
                    ${done ? 'bg-matcha-100 text-matcha-700' :
                      active ? 'bg-matcha-500 text-white shadow ring-2 ring-matcha-200 ring-offset-1' :
                               'bg-gray-100 text-gray-400'}
                  `}>
                    {done ? '✓' : p.icon}
                  </div>
                  <div className={`text-[9px] mt-1 text-center leading-tight ${
                    active ? 'text-matcha-600 font-bold' : done ? 'text-matcha-400' : 'text-gray-400'
                  }`}>{p.label}</div>
                </div>
                {i < PHASES.length - 1 && (
                  <div className={`h-0.5 w-2 mx-0.5 rounded-full ${i < curIdx ? 'bg-matcha-400' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Driver Info */}
      {data.fahrer_name && data.status === 'unterwegs' && (
        <div className="px-4 py-2.5 flex items-center gap-2">
          <span className="text-xl">🚴</span>
          <div className="flex-1">
            <div className="text-xs font-semibold">{data.fahrer_name}</div>
            <div className="text-[10px] text-gray-500">Dein Fahrer ist unterwegs</div>
          </div>
          {data.fahrer_distanz_km !== null && (
            <div className="flex items-center gap-1 text-xs text-matcha-600 font-medium">
              <MapPin className="w-3 h-3" /> {data.fahrer_distanz_km.toFixed(1)} km
            </div>
          )}
        </div>
      )}

      <div className="border-t px-4 py-1.5 flex items-center gap-1 text-[10px] text-gray-400">
        <Clock className="w-3 h-3" /> Live · Update alle 20 Sek.
      </div>
    </div>
  );
}
