'use client';
import { useEffect, useRef, useState } from 'react';
import { Bike, CheckCircle2, ChefHat, Clock, Package, Zap } from 'lucide-react';

type OrderStatus =
  | 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig'
  | 'abgeholt' | 'unterwegs' | 'geliefert' | 'cancelled';

interface TrackData {
  status: OrderStatus;
  etaMin: number | null;
  driverName: string | null;
  driverDistanceKm: number | null;
}

interface Props {
  orderId?: string | null;
  locationId?: string | null;
  initialEtaMin?: number | null;
  bestellnummer?: string | null;
  orderedAt?: string | null;
}

const STEPS: { statuses: OrderStatus[]; label: string; icon: React.ReactNode }[] = [
  { statuses: ['neu', 'bestätigt'],              label: 'Bestätigt',   icon: <CheckCircle2 className="h-4 w-4" /> },
  { statuses: ['in_zubereitung', 'fertig'],      label: 'Zubereitung', icon: <ChefHat className="h-4 w-4" /> },
  { statuses: ['abgeholt', 'unterwegs'],         label: 'Unterwegs',   icon: <Bike className="h-4 w-4" /> },
  { statuses: ['geliefert'],                     label: 'Geliefert',   icon: <Package className="h-4 w-4" /> },
];

function stepIndex(status: OrderStatus): number {
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS[i].statuses.includes(status)) return i;
  }
  return 0;
}

function pad2(n: number): string { return n.toString().padStart(2, '0'); }

export function Phase2660DynamischeEtaLiveTrackingFinal({ orderId, locationId, initialEtaMin, bestellnummer, orderedAt }: Props) {
  const [data, setData] = useState<TrackData>({
    status: 'bestätigt',
    etaMin: initialEtaMin ?? 30,
    driverName: null,
    driverDistanceKm: null,
  });
  const [countdownSec, setCountdownSec] = useState((initialEtaMin ?? 30) * 60);
  const [pulse, setPulse] = useState(false);
  const etaSetAt = useRef(Date.now());
  const baseEtaSec = useRef((initialEtaMin ?? 30) * 60);

  useEffect(() => {
    if (!orderId || !locationId) return;
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/track?order_id=${orderId}&location_id=${locationId}`);
        if (!res.ok) return;
        const json: TrackData = await res.json();
        if (!active) return;
        setData(json);
        if (json.etaMin !== null) {
          baseEtaSec.current = json.etaMin * 60;
          etaSetAt.current = Date.now();
        }
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 30_000);
    return () => { active = false; clearInterval(iv); };
  }, [orderId, locationId]);

  useEffect(() => {
    const iv = setInterval(() => {
      const elapsed = Math.round((Date.now() - etaSetAt.current) / 1000);
      setCountdownSec(Math.max(0, baseEtaSec.current - elapsed));
      setPulse(p => !p);
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const current = stepIndex(data.status);
  const isDelivered = data.status === 'geliefert';
  const isCancelled = data.status === 'cancelled';
  const mm = pad2(Math.floor(countdownSec / 60));
  const ss = pad2(countdownSec % 60);

  const pct = initialEtaMin
    ? Math.min(100, ((initialEtaMin * 60 - countdownSec) / (initialEtaMin * 60)) * 100)
    : 0;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-matcha-600 px-4 py-3 flex items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 transition-transform ${pulse && !isDelivered ? 'scale-110' : ''}`}>
          <Bike className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-black text-sm">Live-Tracking</div>
          {bestellnummer && <div className="text-matcha-200 text-[11px]">Bestellung #{bestellnummer}</div>}
        </div>
        {!isDelivered && !isCancelled && (
          <div className="flex items-center gap-1 text-[10px] text-white/70">
            <div className={`h-1.5 w-1.5 rounded-full bg-white transition-opacity ${pulse ? 'opacity-100' : 'opacity-30'}`} />
            Live
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Step Progress */}
        <div className="flex items-start gap-0">
          {STEPS.map((step, idx) => {
            const isDone = idx < current;
            const isActive = idx === current;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center relative">
                {idx > 0 && (
                  <div className={`absolute left-0 right-[50%] top-4 h-0.5 -translate-y-px ${isDone || isActive ? 'bg-matcha-500' : 'bg-muted'}`} />
                )}
                {idx < STEPS.length - 1 && (
                  <div className={`absolute left-[50%] right-0 top-4 h-0.5 -translate-y-px ${isDone ? 'bg-matcha-500' : 'bg-muted'}`} />
                )}
                <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                  isDone ? 'bg-matcha-500 border-matcha-500 text-white' :
                  isActive ? `bg-white border-matcha-500 text-matcha-600 ${pulse ? 'shadow-lg shadow-matcha-200' : ''}` :
                  'bg-white border-muted text-muted-foreground'
                }`}>
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : step.icon}
                </div>
                <div className={`mt-1.5 text-[10px] text-center font-medium leading-tight ${
                  isActive ? 'text-matcha-700 font-bold' : idx > current ? 'text-muted-foreground' : 'text-matcha-600'
                }`}>
                  {step.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress Bar */}
        {!isDelivered && !isCancelled && (
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-matcha-500 rounded-full transition-all duration-1000"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        {/* Countdown */}
        {!isDelivered && !isCancelled && countdownSec > 0 && (
          <div className="flex justify-center">
            <div className="flex items-center gap-1.5 bg-matcha-50 border border-matcha-200 rounded-2xl px-6 py-3">
              <Clock className="h-4 w-4 text-matcha-600 shrink-0" />
              <div className="flex items-end gap-0.5">
                <span className="font-mono text-3xl font-black tabular-nums text-matcha-800">{mm}</span>
                <span className={`font-mono text-2xl font-black tabular-nums text-matcha-600 mb-0.5 transition-opacity ${pulse ? 'opacity-100' : 'opacity-0'}`}>:</span>
                <span className="font-mono text-3xl font-black tabular-nums text-matcha-800">{ss}</span>
              </div>
              <span className="text-[11px] text-matcha-600 ml-1">Min</span>
            </div>
          </div>
        )}

        {/* Driver info */}
        {data.driverName && ['unterwegs', 'abgeholt'].includes(data.status) && (
          <div className="flex items-center gap-3 rounded-xl bg-muted/30 border border-border px-3 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 border border-matcha-200 shrink-0">
              <Bike className="h-4 w-4 text-matcha-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold">{data.driverName}</div>
              <div className="text-[11px] text-muted-foreground">Dein Fahrer</div>
            </div>
            {data.driverDistanceKm !== null && (
              <div className="shrink-0 text-right">
                <div className="text-sm font-black text-matcha-700">{data.driverDistanceKm.toFixed(1)} km</div>
                <div className="text-[10px] text-muted-foreground">entfernt</div>
              </div>
            )}
          </div>
        )}

        {/* Delivered */}
        {isDelivered && (
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-matcha-100 border-2 border-matcha-300">
              <Package className="h-7 w-7 text-matcha-600" />
            </div>
            <div className="text-base font-black text-matcha-700">Guten Hunger! 🎉</div>
          </div>
        )}

        {/* Cancelled */}
        {isCancelled && (
          <div className="text-center text-sm font-semibold text-red-500">Bestellung storniert.</div>
        )}

        {/* Live pulse */}
        {!isDelivered && !isCancelled && (
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
            <div className={`h-2 w-2 rounded-full bg-matcha-500 transition-opacity ${pulse ? 'opacity-100' : 'opacity-40'}`} />
            Live-Tracking aktiv
            <Zap className="h-3 w-3 text-matcha-500" />
          </div>
        )}
      </div>
    </div>
  );
}
