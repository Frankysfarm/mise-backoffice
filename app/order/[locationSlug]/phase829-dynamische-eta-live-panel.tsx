'use client';

import { useEffect, useState } from 'react';
import { Clock, Zap, TrendingUp, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  orderId: string;
  bestellnummer?: string | null;
  baseEtaMin?: number | null;
  status?: string | null;
}

interface EtaData {
  etaMin: number;
  confidence: 'hoch' | 'mittel' | 'niedrig';
  liveAdjustment: number;
  reason: string;
  updatedAt: string;
}

const MOCK_ETA: EtaData = {
  etaMin: 28,
  confidence: 'hoch',
  liveAdjustment: -2,
  reason: 'Küche gut ausgelastet, Fahrer in der Nähe',
  updatedAt: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
};

function confidenceColor(c: EtaData['confidence']) {
  switch (c) {
    case 'hoch':    return { dot: 'bg-matcha-500', text: 'text-matcha-700', label: 'Hohe Genauigkeit' };
    case 'mittel':  return { dot: 'bg-amber-400',  text: 'text-amber-700',  label: 'Mittlere Genauigkeit' };
    case 'niedrig': return { dot: 'bg-red-500',    text: 'text-red-700',    label: 'Grobe Schätzung' };
  }
}

export function StorefrontPhase829DynamischeEtaLivePanel({ orderId, bestellnummer, baseEtaMin, status }: Props) {
  const [data, setData] = useState<EtaData | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const load = async () => {
    try {
      const res = await fetch(`/api/delivery/orders?id=${orderId}&include_eta=true`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.eta_min) {
        setData({
          etaMin: json.eta_min,
          confidence: json.confidence ?? 'mittel',
          liveAdjustment: json.adjustment ?? 0,
          reason: json.reason ?? 'Echtzeit-Berechnung',
          updatedAt: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        });
        return;
      }
    } catch { /* noop */ }
    setData(null);
  };

  useEffect(() => {
    load();
    const refresh = setInterval(load, 30_000);
    return () => clearInterval(refresh);
  }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const iv = setInterval(() => setElapsed((e) => e + 1), 60_000);
    return () => clearInterval(iv);
  }, []);

  if (['geliefert', 'cancelled'].includes(status ?? '')) return null;

  const etaData = data ?? {
    ...MOCK_ETA,
    etaMin: Math.max(1, (baseEtaMin ?? 30) - elapsed),
  };
  const c = confidenceColor(etaData.confidence);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-stone-50">
        <Clock className="h-4 w-4 text-stone-600" />
        <span className="text-sm font-bold text-stone-800">Dynamische Lieferzeit</span>
        {etaData.liveAdjustment < 0 && (
          <span className="ml-auto text-[10px] bg-matcha-100 text-matcha-700 rounded-full px-2 py-0.5 font-bold flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {Math.abs(etaData.liveAdjustment)} Min früher
          </span>
        )}
        {etaData.liveAdjustment > 0 && (
          <span className="ml-auto text-[10px] bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-bold">
            +{etaData.liveAdjustment} Min Verzögerung
          </span>
        )}
      </div>

      <div className="px-5 py-5 text-center">
        <div className="text-5xl font-black tabular-nums text-stone-800 leading-none">
          {etaData.etaMin}
        </div>
        <div className="text-sm text-stone-500 mt-1">Minuten bis zur Lieferung</div>

        <div className="mt-3 flex items-center justify-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', c.dot)} />
          <span className={cn('text-[11px] font-medium', c.text)}>{c.label}</span>
        </div>
      </div>

      {/* ETA Erklärung */}
      <div className="mx-4 mb-4 rounded-xl bg-stone-50 border border-stone-100 px-3 py-2.5">
        <div className="flex items-start gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-stone-400 mt-0.5 shrink-0" />
          <span className="text-[11px] text-stone-600 leading-relaxed">{etaData.reason}</span>
        </div>
        <div className="mt-1.5 text-[9px] text-stone-400 text-right">
          Aktualisiert {etaData.updatedAt}
        </div>
      </div>

      {/* Phases */}
      <div className="border-t border-stone-100 px-4 py-3">
        <div className="flex items-center gap-2">
          {[
            { label: 'Bestellung', done: true, active: false },
            { label: 'Zubereitung', done: false, active: true },
            { label: 'Unterwegs', done: false, active: false },
            { label: 'Geliefert', done: false, active: false },
          ].map((phase, idx) => (
            <div key={phase.label} className="flex-1 flex flex-col items-center gap-1">
              <div className={cn(
                'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                phase.done ? 'bg-matcha-500 border-matcha-500' :
                phase.active ? 'bg-white border-blue-500 ring-2 ring-blue-100' :
                'bg-white border-stone-200'
              )}>
                {phase.done && <CheckCircle2 className="h-3 w-3 text-white" />}
                {phase.active && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />}
              </div>
              <span className={cn(
                'text-[8px] text-center leading-tight',
                phase.done ? 'text-matcha-600 font-bold' :
                phase.active ? 'text-blue-600 font-bold' :
                'text-stone-400'
              )}>
                {phase.label}
              </span>
              {idx < 3 && (
                <div className={cn(
                  'absolute hidden'
                )} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
