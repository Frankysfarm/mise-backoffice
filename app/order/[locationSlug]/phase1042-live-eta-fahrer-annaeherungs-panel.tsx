'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, Clock, MapPin, Package, Phone, Star, Zap } from 'lucide-react';

type TrackingData = {
  status: 'in_zubereitung' | 'bereit' | 'unterwegs' | 'fast_da' | 'geliefert';
  etaMin: number | null;
  fahrerName?: string | null;
  fahrerRating?: number | null;
  distanceM?: number | null;
  bestellnummer?: string;
};

type Phase = 'zubereitung' | 'bereit' | 'unterwegs' | 'fast_da' | 'geliefert';

function statusToPhase(status: TrackingData['status']): Phase {
  switch (status) {
    case 'in_zubereitung': return 'zubereitung';
    case 'bereit': return 'bereit';
    case 'unterwegs': return 'unterwegs';
    case 'fast_da': return 'fast_da';
    case 'geliefert': return 'geliefert';
    default: return 'zubereitung';
  }
}

const PHASE_ORDER: Phase[] = ['zubereitung', 'bereit', 'unterwegs', 'fast_da', 'geliefert'];

const PHASE_META: Record<Phase, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  zubereitung: { label: 'In Zubereitung', icon: Package, color: 'text-amber-600', bg: 'bg-amber-50' },
  bereit:      { label: 'Bereit zur Abholung', icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50' },
  unterwegs:   { label: 'Unterwegs', icon: Bike, color: 'text-matcha-600', bg: 'bg-matcha-50' },
  fast_da:     { label: 'Fast da!', icon: Zap, color: 'text-orange-600', bg: 'bg-orange-50' },
  geliefert:   { label: 'Geliefert', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
};

function ETACountdown({ etaMin }: { etaMin: number }) {
  const [secsLeft, setSecsLeft] = useState(etaMin * 60);
  const initial = useRef(etaMin * 60);

  useEffect(() => {
    initial.current = etaMin * 60;
    setSecsLeft(etaMin * 60);
  }, [etaMin]);

  useEffect(() => {
    const t = setInterval(() => {
      setSecsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const pct = initial.current > 0 ? 1 - secsLeft / initial.current : 0;
  const m = Math.floor(secsLeft / 60);
  const s = secsLeft % 60;
  const r = 40;
  const circ = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <svg width={96} height={96}>
          <circle cx={48} cy={48} r={r} fill="none" stroke="#e5e7eb" strokeWidth={6} />
          <circle
            cx={48} cy={48} r={r} fill="none"
            stroke="#16a34a" strokeWidth={6}
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
            strokeLinecap="round"
            transform="rotate(-90 48 48)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-xl font-black tabular-nums text-matcha-700">
            {secsLeft <= 0 ? '–' : m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`}
          </div>
          <div className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">ETA</div>
        </div>
      </div>
    </div>
  );
}

function ProximityDot({ distanceM }: { distanceM: number }) {
  const pct = Math.max(0, Math.min(1, 1 - distanceM / 3000));
  const color =
    distanceM < 300 ? 'bg-matcha-500 animate-ping' :
    distanceM < 800 ? 'bg-amber-400 animate-pulse' :
    'bg-blue-400';
  return (
    <div className="flex items-center gap-2">
      <span className={cn('h-2.5 w-2.5 rounded-full', color)} />
      <span className="text-xs text-muted-foreground">
        {distanceM < 1000 ? `${distanceM}m` : `${(distanceM / 1000).toFixed(1)} km`} entfernt
      </span>
    </div>
  );
}

const MOCK_DATA: TrackingData = {
  status: 'unterwegs',
  etaMin: 12,
  fahrerName: 'Ahmed K.',
  fahrerRating: 4.8,
  distanceM: 1400,
  bestellnummer: '1042',
};

export function Phase1042LiveEtaFahrerAnnaeherungsPanel({
  orderId,
  locationId,
}: {
  orderId?: string | null;
  locationId?: string | null;
}) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setData(MOCK_DATA);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = () => {
      fetch(`/api/delivery/customer/tracking?order_id=${encodeURIComponent(orderId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled) return;
          if (d) setData(d);
          else setData(MOCK_DATA);
        })
        .catch(() => { if (!cancelled) setData(MOCK_DATA); })
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [orderId]);

  if (loading) {
    return (
      <div className="rounded-2xl border animate-pulse bg-muted h-32" />
    );
  }

  if (!data) return null;

  const phase = statusToPhase(data.status);
  const phaseIdx = PHASE_ORDER.indexOf(phase);
  const meta = PHASE_META[phase];
  const Icon = meta.icon;

  return (
    <div className="rounded-2xl border overflow-hidden">
      {/* Phase timeline */}
      <div className="px-4 pt-3 pb-2 bg-gradient-to-r from-matcha-50 to-transparent">
        <div className="flex items-center gap-0">
          {PHASE_ORDER.map((p, i) => {
            const isDone = i < phaseIdx;
            const isCurrent = i === phaseIdx;
            const M = PHASE_META[p];
            const PMIcon = M.icon;
            return (
              <div key={p} className="flex items-center" style={{ flex: i < PHASE_ORDER.length - 1 ? 1 : 'none' }}>
                <div className="flex flex-col items-center">
                  <div className={cn(
                    'h-5 w-5 rounded-full flex items-center justify-center transition-colors',
                    isDone ? 'bg-matcha-500 text-white' :
                    isCurrent ? `${M.bg} ${M.color} ring-2 ring-offset-1 ring-matcha-400` :
                    'bg-muted text-muted-foreground',
                  )}>
                    <PMIcon size={10} />
                  </div>
                </div>
                {i < PHASE_ORDER.length - 1 && (
                  <div className={cn('h-0.5 flex-1 mx-0.5', isDone ? 'bg-matcha-400' : 'bg-muted')} />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-1 text-center">
          <span className={cn('text-[11px] font-bold', meta.color)}>{meta.label}</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Main ETA + driver info */}
        <div className="flex items-center gap-4">
          {data.etaMin !== null && phase !== 'geliefert' && (
            <ETACountdown etaMin={data.etaMin} />
          )}
          {phase === 'geliefert' && (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
          )}

          <div className="flex-1 space-y-2">
            {data.fahrerName && (
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-matcha-100 text-matcha-700 font-black text-sm">
                  {data.fahrerName.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-bold">{data.fahrerName}</div>
                  {data.fahrerRating !== undefined && data.fahrerRating !== null && (
                    <div className="flex items-center gap-0.5">
                      <Star size={10} className="text-amber-400 fill-amber-400" />
                      <span className="text-[11px] text-muted-foreground">{data.fahrerRating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {data.distanceM !== null && data.distanceM !== undefined && phase === 'unterwegs' && (
              <ProximityDot distanceM={data.distanceM} />
            )}

            {phase === 'fast_da' && (
              <div className="flex items-center gap-1.5 text-orange-600 font-bold text-sm animate-pulse">
                <Zap size={14} /> Dein Fahrer ist fast da!
              </div>
            )}

            {phase === 'geliefert' && (
              <div className="text-sm font-bold text-emerald-700">Deine Bestellung wurde geliefert!</div>
            )}
          </div>
        </div>

        {/* Bike animation when in transit */}
        {(phase === 'unterwegs' || phase === 'fast_da') && (
          <div className="relative h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="absolute top-0 h-full rounded-full bg-matcha-400 transition-all"
              style={{
                width: data.distanceM !== null && data.distanceM !== undefined
                  ? `${Math.min(100, Math.max(5, (1 - data.distanceM / 3000) * 100))}%`
                  : '50%',
              }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 transition-all"
              style={{
                left: data.distanceM !== null && data.distanceM !== undefined
                  ? `${Math.min(90, Math.max(2, (1 - data.distanceM / 3000) * 100))}%`
                  : '50%',
              }}
            >
              <Bike size={12} className="text-matcha-600 -mt-px" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
