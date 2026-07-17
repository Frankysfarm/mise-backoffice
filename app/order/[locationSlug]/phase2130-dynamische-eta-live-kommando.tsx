'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock, Bike, CheckCircle2, ChefHat, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Phase = 'bestaetigt' | 'in_zubereitung' | 'bereit' | 'unterwegs' | 'angekommen' | 'geliefert';

interface EtaData {
  phase: Phase;
  eta_min: number;
  eta_min_range_bis?: number;
  fahrer_name?: string;
  fahrer_distanz_m?: number;
  kuechen_auslastung_pct?: number;
  bestellnummer: string;
}

const MOCK: EtaData = {
  phase: 'unterwegs',
  eta_min: 8,
  eta_min_range_bis: 12,
  fahrer_name: 'Max M.',
  fahrer_distanz_m: 1200,
  kuechen_auslastung_pct: 70,
  bestellnummer: '#1042',
};

const PHASEN: { key: Phase; label: string; icon: React.ReactNode }[] = [
  { key: 'bestaetigt',    label: 'Bestätigt',      icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  { key: 'in_zubereitung', label: 'In Zubereitung', icon: <ChefHat className="h-3.5 w-3.5" /> },
  { key: 'unterwegs',    label: 'Unterwegs',       icon: <Bike className="h-3.5 w-3.5" /> },
  { key: 'geliefert',    label: 'Geliefert',       icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
];

const PHASEN_ORDER: Phase[] = ['bestaetigt', 'in_zubereitung', 'bereit', 'unterwegs', 'angekommen', 'geliefert'];

interface Props {
  orderId: string;
}

export function Phase2130DynamischeEtaLiveKommando({ orderId }: Props) {
  const [data, setData] = useState<EtaData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(Date.now());

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/order/${orderId}/eta-live`, { cache: 'no-store' });
      if (r.ok) { setData(await r.json()); setLastUpdated(Date.now()); }
    } catch { /* use mock */ } finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [load]);

  const currentStep = PHASEN_ORDER.indexOf(data.phase);
  const isDelivered = data.phase === 'geliefert';
  const secsAgo = Math.floor((Date.now() - lastUpdated) / 1_000);

  const etaLabel = data.eta_min_range_bis
    ? `${data.eta_min}–${data.eta_min_range_bis} Min`
    : `${data.eta_min} Min`;

  return (
    <div className="rounded-2xl border bg-white overflow-hidden shadow-md">
      {/* Header */}
      <div className={cn(
        'px-4 py-3 flex items-center gap-2',
        isDelivered ? 'bg-matcha-500' : 'bg-saffron/10 border-b border-saffron/20'
      )}>
        {isDelivered
          ? <CheckCircle2 className="h-5 w-5 text-white shrink-0" />
          : <Bike className="h-5 w-5 text-saffron shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm font-bold', isDelivered ? 'text-white' : 'text-char')}>
            {isDelivered ? 'Lieferung angekommen!' : `ETA: ${etaLabel}`}
          </div>
          <div className={cn('text-[10px]', isDelivered ? 'text-white/80' : 'text-muted-foreground')}>
            {data.bestellnummer}
            {data.fahrer_name && !isDelivered && ` · Fahrer: ${data.fahrer_name}`}
          </div>
        </div>
        {loading
          ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
          : <span className="text-[9px] text-muted-foreground shrink-0">vor {secsAgo}s</span>
        }
      </div>

      {/* Phase-Timeline */}
      <div className="px-4 py-3">
        <div className="relative flex items-center justify-between">
          {/* Connecting line */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-stone-200 -z-0" />
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-saffron transition-all duration-700 -z-0"
            style={{ width: `${Math.min(100, (currentStep / (PHASEN_ORDER.length - 1)) * 100)}%` }}
          />

          {PHASEN.map((p, i) => {
            const pStep = PHASEN_ORDER.indexOf(p.key);
            const isDone = pStep < currentStep;
            const isCurrent = pStep === currentStep;
            return (
              <div key={p.key} className="flex flex-col items-center gap-1 z-10">
                <div className={cn(
                  'h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all',
                  isDone    ? 'bg-saffron border-saffron text-white'
                  : isCurrent ? 'bg-white border-saffron text-saffron shadow-md animate-pulse'
                  : 'bg-white border-stone-200 text-stone-400'
                )}>
                  {p.icon}
                </div>
                <span className={cn(
                  'text-[8px] font-medium text-center leading-tight max-w-[48px]',
                  isCurrent ? 'text-saffron font-bold' : isDone ? 'text-matcha-600' : 'text-stone-400'
                )}>
                  {p.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Extras */}
      {!isDelivered && (data.fahrer_distanz_m || data.kuechen_auslastung_pct) && (
        <div className="px-4 pb-3 flex gap-3">
          {data.fahrer_distanz_m !== undefined && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-stone-50 rounded-lg px-2.5 py-1.5 border">
              <Bike className="h-3 w-3 text-saffron" />
              {data.fahrer_distanz_m >= 1000
                ? `${(data.fahrer_distanz_m / 1000).toFixed(1)} km entfernt`
                : `${data.fahrer_distanz_m} m entfernt`
              }
            </div>
          )}
          {data.kuechen_auslastung_pct !== undefined && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-stone-50 rounded-lg px-2.5 py-1.5 border">
              <Clock className="h-3 w-3 text-amber-500" />
              Küche {data.kuechen_auslastung_pct}% ausgelastet
            </div>
          )}
        </div>
      )}
    </div>
  );
}
