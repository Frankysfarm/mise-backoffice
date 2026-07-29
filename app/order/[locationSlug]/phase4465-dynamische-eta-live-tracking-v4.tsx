'use client';

import { useEffect, useState } from 'react';
import { Clock, Navigation2, ChefHat, Package, CheckCircle2, Bike, Zap, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  orderId?: string;
  status: string;
  etaEarliest: string | null;
  etaLatest: string | null;
  createdAt: string;
}

interface LiveData {
  fahrer_name: string | null;
  fahrer_entfernung_km: number | null;
  confidence_pct: number;
  eta_updated_at: string;
  wetter_verzoegerung_min: number;
}

function secondsUntil(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtCountdown(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const PHASES = [
  { key: 'neu',             label: 'Eingang',      Icon: Package,    },
  { key: 'in_zubereitung',  label: 'Küche',        Icon: ChefHat,    },
  { key: 'fertig',          label: 'Bereit',       Icon: Package,    },
  { key: 'unterwegs',       label: 'Unterwegs',    Icon: Bike,       },
  { key: 'geliefert',       label: 'Geliefert',    Icon: CheckCircle2 },
];

const STATUS_PHASE_IDX: Record<string, number> = {
  neu: 0, bestätigt: 0, in_zubereitung: 1, fertig: 2, abgeholt: 3, unterwegs: 3, geliefert: 4,
};

export function Phase4465DynamischeEtaLiveTrackingV4({ orderId, status, etaEarliest, etaLatest, createdAt }: Props) {
  const [secs, setSecs] = useState(() => secondsUntil(etaEarliest));
  const [pct, setPct] = useState(0);
  const [live, setLive] = useState<LiveData | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    setSecs(secondsUntil(etaEarliest));
    if (etaEarliest && createdAt) {
      const total = new Date(etaEarliest).getTime() - new Date(createdAt).getTime();
      const elapsed = Date.now() - new Date(createdAt).getTime();
      setPct(total > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / total) * 100))) : 0);
    }
  }, [etaEarliest, createdAt, tick]);

  useEffect(() => {
    if (!orderId) return;
    async function loadLive() {
      try {
        const r = await fetch(`/api/delivery/tracking/live?order_id=${orderId}`);
        if (r.ok) setLive(await r.json());
      } catch { /* silent */ }
    }
    loadLive();
    const t = setInterval(loadLive, 15000);
    return () => clearInterval(t);
  }, [orderId]);

  if (status === 'storniert') return null;

  const phaseIdx = STATUS_PHASE_IDX[status] ?? 0;
  const isDelivered = status === 'geliefert';
  const isLate = pct >= 100 && !isDelivered;
  const isCountdown = secs <= 15 * 60 && secs > 0 && !isDelivered;
  const confidenceColor = (live?.confidence_pct ?? 100) >= 80 ? 'text-emerald-500' : (live?.confidence_pct ?? 100) >= 60 ? 'text-amber-500' : 'text-red-500';

  return (
    <div className={cn(
      'rounded-2xl border p-4 space-y-4 shadow-sm bg-white',
      isDelivered ? 'border-green-200' : isLate ? 'border-amber-200' : 'border-matcha-100',
    )}>
      {/* Live badge */}
      {!isDelivered && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-matcha-700">Echtzeit-Tracking</span>
          <div className="flex items-center gap-1 text-[10px] font-semibold text-matcha-600 bg-matcha-50 border border-matcha-200 rounded-full px-2 py-0.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-matcha-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-matcha-500" />
            </span>
            Live
          </div>
        </div>
      )}

      {/* Phase Progress */}
      <div className="flex items-center justify-between">
        {PHASES.map((phase, i) => {
          const done = i < phaseIdx;
          const active = i === phaseIdx;
          const { Icon } = phase;
          return (
            <div key={phase.key} className="flex flex-col items-center gap-1 flex-1">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all',
                done ? 'bg-matcha-500 border-matcha-500' : active ? 'bg-white border-matcha-500 shadow-md' : 'bg-gray-50 border-gray-200',
              )}>
                <Icon className={cn('w-4 h-4', done ? 'text-white' : active ? 'text-matcha-600' : 'text-gray-300')} />
              </div>
              <span className={cn('text-[9px] text-center leading-tight', done ? 'text-matcha-600 font-semibold' : active ? 'text-matcha-700 font-bold' : 'text-gray-400')}>
                {phase.label}
              </span>
              {i < PHASES.length - 1 && (
                <div className={cn('h-0.5 w-full mt-1', done ? 'bg-matcha-400' : 'bg-gray-200')} style={{ position: 'absolute', display: 'none' }} />
              )}
            </div>
          );
        })}
      </div>

      {/* ETA / Countdown */}
      {isDelivered ? (
        <div className="text-center text-green-700 font-bold text-lg py-2">✅ Erfolgreich geliefert!</div>
      ) : isCountdown ? (
        <div className="text-center py-2">
          <div className={cn('font-mono text-4xl font-black tabular-nums', secs <= 120 ? 'text-amber-500 animate-pulse' : 'text-matcha-800')}>
            {fmtCountdown(secs)}
          </div>
          <p className="text-xs text-matcha-500 flex items-center justify-center gap-1 mt-1">
            <Zap className="w-3 h-3 text-yellow-400" /> Echtzeit-Countdown bis zur Ankunft
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 text-matcha-700 py-2">
          <Clock className="w-4 h-4 text-matcha-500" />
          <span className="text-base font-semibold">
            {etaEarliest
              ? etaLatest
                ? `${fmtTime(etaEarliest)} – ${fmtTime(etaLatest)} Uhr`
                : `${fmtTime(etaEarliest)} Uhr`
              : 'Wird berechnet…'
            }
          </span>
        </div>
      )}

      {/* Progress Bar */}
      {!isDelivered && etaEarliest && (
        <div>
          <div className="h-2.5 rounded-full bg-matcha-100 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-1000',
                isLate ? 'bg-amber-400 animate-pulse' : 'bg-gradient-to-r from-matcha-400 to-matcha-600',
              )}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-matcha-400 mt-1">
            <span>Bestellung aufgegeben</span>
            <span className={isLate ? 'text-amber-500 font-semibold' : ''}>{isLate ? 'Gleich da!' : `${pct}%`}</span>
            <span>Ankunft</span>
          </div>
        </div>
      )}

      {/* Driver Info + Confidence */}
      {live && !isDelivered && (
        <div className="rounded-xl bg-matcha-50 border border-matcha-100 p-3 space-y-2">
          {live.fahrer_name && (
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-matcha-700">
                <Bike className="w-3.5 h-3.5" />
                <span className="font-semibold">{live.fahrer_name}</span>
              </div>
              {live.fahrer_entfernung_km !== null && (
                <div className="flex items-center gap-1 text-matcha-600">
                  <MapPin className="w-3 h-3" />
                  <span>{live.fahrer_entfernung_km.toFixed(1)} km entfernt</span>
                </div>
              )}
            </div>
          )}
          <div className="flex items-center justify-between text-[10px] text-matcha-500">
            <span>ETA-Konfidenz</span>
            <span className={`font-bold ${confidenceColor}`}>{live.confidence_pct}%</span>
          </div>
          {live.wetter_verzoegerung_min > 0 && (
            <div className="text-[10px] text-amber-600">
              🌧 Wetterbedingte Verzögerung: +{live.wetter_verzoegerung_min} min
            </div>
          )}
        </div>
      )}
    </div>
  );
}
