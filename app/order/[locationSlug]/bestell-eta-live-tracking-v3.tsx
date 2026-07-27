'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, MapPin, CheckCircle2, Truck, ChefHat, Package, Zap } from 'lucide-react';

/**
 * Bestell-ETA Live-Tracking V3 (Storefront)
 *
 * Dynamische ETA mit Live-Phasen-Anzeige:
 * Bestellt → Bestätigt → In Zubereitung → Fahrer unterwegs → Geliefert
 * ETA-Countdown (1-Sek-Tick)
 * Fahrer-Name + Progress-Ring
 * 30-Sek-Polling
 */

type OrderPhase = 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

interface TrackingData {
  order_id: string;
  bestellnummer: string;
  phase: OrderPhase;
  eta_min: number;
  fahrer_name: string | null;
  fahrer_distanz_km: number | null;
  prep_fertig_in_min: number | null;
}

const PHASES: { key: OrderPhase; label: string; icon: typeof Clock; short: string }[] = [
  { key: 'neu',            label: 'Bestellt',        icon: Package,    short: 'Bestellt'    },
  { key: 'bestätigt',      label: 'Bestätigt',       icon: CheckCircle2, short: 'Bestätigt' },
  { key: 'in_zubereitung', label: 'In Zubereitung',  icon: ChefHat,    short: 'Zubereitung' },
  { key: 'unterwegs',      label: 'Fahrer unterwegs',icon: Truck,      short: 'Unterwegs'   },
  { key: 'geliefert',      label: 'Geliefert!',      icon: CheckCircle2, short: 'Geliefert' },
];

const PHASE_ORDER: OrderPhase[] = ['neu', 'bestätigt', 'in_zubereitung', 'unterwegs', 'geliefert'];

const MOCK: TrackingData = {
  order_id: 'ord-demo',
  bestellnummer: '0099',
  phase: 'in_zubereitung',
  eta_min: 22,
  fahrer_name: null,
  fahrer_distanz_km: null,
  prep_fertig_in_min: 8,
};

export function BestellEtaLiveTrackingV3({
  orderId,
  bestellnummer,
}: {
  orderId?: string | null;
  bestellnummer?: string | null;
}) {
  const [data, setData] = useState<TrackingData>(MOCK);
  const [etaSec, setEtaSec] = useState(MOCK.eta_min * 60);
  const [useMock, setUseMock] = useState(true);

  const fetchData = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/delivery/tracking?order_id=${orderId}`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error();
      const d = await res.json();
      if (d?.phase) {
        setData(d);
        setEtaSec(d.eta_min * 60);
        setUseMock(false);
      }
    } catch {
      setUseMock(true);
    }
  }, [orderId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (!orderId) return;
    const iv = setInterval(fetchData, 30_000);
    return () => clearInterval(iv);
  }, [fetchData, orderId]);

  useEffect(() => {
    const t = setInterval(() => setEtaSec(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const currentPhaseIdx = PHASE_ORDER.indexOf(data.phase === 'fertig' ? 'unterwegs' : data.phase);
  const etaMin = Math.floor(etaSec / 60);
  const etaSecRest = etaSec % 60;

  const isGeliefert = data.phase === 'geliefert';

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* ETA-Hero */}
      <div className={`p-4 text-white ${isGeliefert ? 'bg-green-600' : 'bg-indigo-600 dark:bg-indigo-700'}`}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-sm font-medium opacity-80">
              {isGeliefert ? '🎉 Bestellung angekommen!' : 'Voraussichtliche Lieferzeit'}
            </div>
            {useMock && <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">Demo</span>}
          </div>
          {!isGeliefert && (
            <div className="text-right">
              <div className="text-3xl font-bold tabular-nums">{etaMin}:{String(etaSecRest).padStart(2, '0')}</div>
              <div className="text-xs opacity-70">Min</div>
            </div>
          )}
          {isGeliefert && (
            <CheckCircle2 className="h-8 w-8 opacity-80" />
          )}
        </div>

        {/* Fahrer-Info */}
        {data.fahrer_name && (
          <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5 mt-2">
            <Truck className="h-4 w-4" />
            <span className="text-sm">{data.fahrer_name}</span>
            {data.fahrer_distanz_km !== null && (
              <span className="text-xs opacity-70 ml-auto">{data.fahrer_distanz_km.toFixed(1)} km entfernt</span>
            )}
          </div>
        )}

        {/* Zubereitungszeit */}
        {data.phase === 'in_zubereitung' && data.prep_fertig_in_min !== null && (
          <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5 mt-2">
            <ChefHat className="h-4 w-4" />
            <span className="text-sm">Fertig in ~{data.prep_fertig_in_min} Min.</span>
          </div>
        )}
      </div>

      {/* Phasen-Timeline */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          {PHASES.map((phase, idx) => {
            const isCurrent = idx === currentPhaseIdx;
            const isDone    = idx < currentPhaseIdx;
            const Icon = phase.icon;
            return (
              <div key={phase.key} className="flex flex-col items-center flex-1">
                {/* Connector */}
                {idx > 0 && (
                  <div className={`h-0.5 w-full -mt-4 mb-4 ${isDone || isCurrent ? 'bg-indigo-500' : 'bg-muted'}`}
                    style={{ position: 'relative', top: '1.25rem', marginLeft: '-50%', marginRight: '50%', zIndex: 0 }}
                  />
                )}
                {/* Icon */}
                <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                  isCurrent ? 'border-indigo-500 bg-indigo-500 text-white scale-110 shadow-lg' :
                  isDone    ? 'border-green-500 bg-green-500 text-white' :
                              'border-border bg-card text-muted-foreground'
                }`}>
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                </div>
                {/* Label */}
                <div className={`mt-1.5 text-[10px] text-center font-medium ${isCurrent ? 'text-indigo-600 dark:text-indigo-400' : isDone ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                  {phase.short}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bestellnummer */}
      <div className="px-4 pb-3 flex items-center justify-between text-[10px] text-muted-foreground border-t border-border pt-2">
        <span>Bestellung #{bestellnummer ?? data.bestellnummer}</span>
        <span className="flex items-center gap-1"><Zap className="h-3 w-3" />Live-Tracking aktiv</span>
      </div>
    </div>
  );
}
