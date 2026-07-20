'use client';
import { useEffect, useState } from 'react';
import { Clock, Bike, MapPin, CheckCircle2, ChefHat, Package, TrendingDown, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type Phase = 'bestaetigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

interface EtaData {
  order_id: string;
  phase: Phase;
  eta_min: number | null;
  eta_confidence: number;
  prep_remaining_min: number | null;
  fahrer_name: string | null;
  fahrer_distance_km: number | null;
  fahrer_eta_min: number | null;
  restaurant_name: string;
}

const PHASE_LABELS: Record<Phase, string> = {
  bestaetigt: 'Bestätigt',
  in_zubereitung: 'In Zubereitung',
  fertig: 'Fertig',
  unterwegs: 'Unterwegs',
  geliefert: 'Geliefert',
};

const PHASE_ORDER: Phase[] = ['bestaetigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'];

const MOCK: EtaData = {
  order_id: 'ord-demo',
  phase: 'unterwegs',
  eta_min: 12,
  eta_confidence: 85,
  prep_remaining_min: null,
  fahrer_name: 'Tom K.',
  fahrer_distance_km: 1.8,
  fahrer_eta_min: 12,
  restaurant_name: 'Mise Kitchen',
};

function etaColor(confidence: number) {
  if (confidence >= 80) return 'text-matcha-700';
  if (confidence >= 60) return 'text-amber-600';
  return 'text-stone-500';
}

export function SmartEtaLiveTracker({ orderId, locationSlug }: { orderId?: string | null; locationSlug?: string }) {
  const [data, setData] = useState<EtaData | null>(null);
  const [etaCountdown, setEtaCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!orderId) { setData(MOCK); setEtaCountdown(MOCK.eta_min ? MOCK.eta_min * 60 : null); return; }

    const load = () =>
      fetch(`/api/order/eta?order_id=${orderId}`)
        .then(r => r.json())
        .then((d: EtaData) => {
          setData(d);
          setEtaCountdown(d.eta_min ? d.eta_min * 60 : null);
        })
        .catch(() => { setData(MOCK); setEtaCountdown(MOCK.eta_min ? MOCK.eta_min * 60 : null); });

    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [orderId]);

  useEffect(() => {
    if (etaCountdown === null || etaCountdown <= 0) return;
    const iv = setInterval(() => setEtaCountdown(c => (c !== null && c > 0 ? c - 1 : c)), 1_000);
    return () => clearInterval(iv);
  }, [etaCountdown]);

  if (!data) return null;
  if (data.phase === 'geliefert') return null;

  const phaseIdx = PHASE_ORDER.indexOf(data.phase);
  const mins = etaCountdown !== null ? Math.ceil(etaCountdown / 60) : data.eta_min;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* ETA Header */}
      <div className="px-5 py-5 bg-gradient-to-br from-matcha-50 to-white">
        <div className="flex items-center gap-4">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-matcha-600 text-white">
            {data.phase === 'unterwegs' ? <Bike className="h-7 w-7" /> : data.phase === 'in_zubereitung' ? <ChefHat className="h-7 w-7" /> : <Package className="h-7 w-7" />}
            {data.phase === 'unterwegs' && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-matcha-400 opacity-75" />
                <span className="relative inline-flex h-4 w-4 rounded-full bg-matcha-500" />
              </span>
            )}
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">{PHASE_LABELS[data.phase]}</div>
            {mins !== null ? (
              <div className={cn('text-4xl font-black tabular-nums leading-none mt-0.5', etaColor(data.eta_confidence))}>
                {mins}<span className="text-lg font-semibold ml-1">Min</span>
              </div>
            ) : (
              <div className="text-2xl font-black text-stone-400 mt-0.5">—</div>
            )}
            <div className="mt-1 text-xs text-stone-400">
              {data.eta_confidence >= 80 ? (
                <span className="flex items-center gap-1 text-matcha-600"><Zap className="h-3 w-3" />Hohe ETA-Genauigkeit</span>
              ) : data.eta_confidence >= 60 ? (
                <span className="flex items-center gap-1 text-amber-600"><Clock className="h-3 w-3" />Ungefähre Ankunftszeit</span>
              ) : (
                <span className="flex items-center gap-1 text-stone-400"><Clock className="h-3 w-3" />Schätzung</span>
              )}
            </div>
          </div>
          {data.eta_confidence > 0 && (
            <div className="shrink-0 text-right">
              <div className="text-[10px] text-stone-400 mb-1">Genauigkeit</div>
              <div className="relative h-10 w-10">
                <svg className="h-10 w-10 -rotate-90" viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r="15" fill="none" stroke="#e7e5e4" strokeWidth="3" />
                  <circle cx="20" cy="20" r="15" fill="none" strokeWidth="3"
                    className={data.eta_confidence >= 80 ? 'stroke-matcha-500' : data.eta_confidence >= 60 ? 'stroke-amber-400' : 'stroke-stone-400'}
                    strokeDasharray={`${(data.eta_confidence / 100) * 2 * Math.PI * 15} ${2 * Math.PI * 15}`}
                    strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-stone-600">
                  {data.eta_confidence}%
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fahrer info */}
        {data.phase === 'unterwegs' && data.fahrer_name && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/70 border border-matcha-100 px-3 py-2">
            <Bike className="h-4 w-4 text-matcha-600 shrink-0" />
            <span className="text-sm font-semibold text-stone-700">{data.fahrer_name}</span>
            {data.fahrer_distance_km !== null && (
              <span className="flex items-center gap-0.5 text-xs text-stone-400 ml-auto">
                <MapPin className="h-3 w-3" />{data.fahrer_distance_km.toFixed(1)} km entfernt
              </span>
            )}
          </div>
        )}

        {/* Prep remaining */}
        {data.phase === 'in_zubereitung' && data.prep_remaining_min !== null && (
          <div className="mt-3 flex items-center gap-2 text-xs text-stone-500">
            <ChefHat className="h-3.5 w-3.5 text-matcha-600" />
            Noch ca. {data.prep_remaining_min} Min Zubereitung
          </div>
        )}
      </div>

      {/* Phase progress */}
      <div className="px-5 py-4 border-t border-stone-100">
        <div className="relative flex items-center justify-between">
          <div className="absolute left-0 right-0 top-4 h-0.5 bg-stone-100" />
          <div
            className="absolute left-0 top-4 h-0.5 bg-matcha-500 transition-all duration-500"
            style={{ width: `${(phaseIdx / (PHASE_ORDER.length - 1)) * 100}%` }}
          />
          {PHASE_ORDER.map((phase, i) => {
            const done = i < phaseIdx;
            const active = i === phaseIdx;
            return (
              <div key={phase} className="relative flex flex-col items-center gap-1.5 z-10">
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
                  done ? 'bg-matcha-500 border-matcha-500' :
                  active ? 'bg-white border-matcha-500 shadow-sm' :
                  'bg-white border-stone-200'
                )}>
                  {done ? <CheckCircle2 className="h-4 w-4 text-white" /> : (
                    i === 0 ? <Package className={cn('h-3.5 w-3.5', active ? 'text-matcha-600' : 'text-stone-300')} /> :
                    i === 1 ? <ChefHat className={cn('h-3.5 w-3.5', active ? 'text-matcha-600' : 'text-stone-300')} /> :
                    i === 2 ? <CheckCircle2 className={cn('h-3.5 w-3.5', active ? 'text-matcha-600' : 'text-stone-300')} /> :
                    i === 3 ? <Bike className={cn('h-3.5 w-3.5', active ? 'text-matcha-600' : 'text-stone-300')} /> :
                    <MapPin className={cn('h-3.5 w-3.5', active ? 'text-matcha-600' : 'text-stone-300')} />
                  )}
                </div>
                <div className={cn('text-[9px] font-semibold text-center max-w-12 leading-tight', done ? 'text-matcha-600' : active ? 'text-char' : 'text-stone-300')}>
                  {PHASE_LABELS[phase]}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
