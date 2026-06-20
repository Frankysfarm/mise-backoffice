'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Truck } from 'lucide-react';

interface Props {
  orderId: string;
  etaEarliest?: string | null;
  etaLatest?: string | null;
  status?: string | null;
}

const TERMINAL = new Set(['geliefert', 'delivered', 'completed', 'storniert', 'abgebrochen']);
const ENROUTE = new Set(['unterwegs', 'out_for_delivery', 'picked_up']);

function fmtMmSs(sec: number): { m: string; s: string } {
  const abs = Math.max(0, sec);
  return {
    m: String(Math.floor(abs / 60)),
    s: String(abs % 60).padStart(2, '0'),
  };
}

export function EtaLiveRing({ orderId, etaEarliest, etaLatest, status: initialStatus }: Props) {
  const [etaMs, setEtaMs] = useState<number | null>(() => {
    if (etaLatest) return new Date(etaLatest).getTime();
    if (etaEarliest) return new Date(etaEarliest).getTime();
    return null;
  });
  const [status, setStatus] = useState<string | null>(initialStatus ?? null);
  const [remainSec, setRemainSec] = useState<number>(0);
  const maxSecRef = useRef<number>(0);

  // Poll for ETA updates
  useEffect(() => {
    if (!orderId) return;
    let mounted = true;

    async function poll() {
      try {
        const r = await fetch(`/api/delivery/eta/${orderId}`);
        if (!r.ok || !mounted) return;
        const d = await r.json();
        if (d?.eta_min != null) {
          setEtaMs(Date.now() + d.eta_min * 60_000);
        }
        if (d?.status) setStatus(d.status);
      } catch {
        // ignore
      }
    }

    poll();
    const iv = setInterval(poll, 30_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [orderId]);

  // Per-second countdown
  useEffect(() => {
    if (!etaMs) return;
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((etaMs - now) / 1000));
    setRemainSec(remaining);
    if (maxSecRef.current === 0 && remaining > 0) {
      maxSecRef.current = remaining;
    }

    const iv = setInterval(() => {
      setRemainSec((p) => {
        const next = Math.max(0, p - 1);
        return next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [etaMs]);

  const isTerminal = status && TERMINAL.has(status);
  const isEnRoute = status && ENROUTE.has(status);
  const isDelivered = status === 'geliefert' || status === 'delivered' || status === 'completed';

  if (!etaMs && !isTerminal) return null;

  const maxSec = maxSecRef.current || 60 * 60;
  const pct = maxSec > 0 ? Math.max(0, Math.min(1, remainSec / maxSec)) : 0;
  const { m, s } = fmtMmSs(remainSec);

  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;

  const ringColor = isDelivered
    ? '#10b981'
    : remainSec < 120
    ? '#ef4444'
    : remainSec < 300
    ? '#f59e0b'
    : '#6b9c5a';

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      {/* Ring SVG */}
      <div className="relative">
        <svg width={120} height={120} className="drop-shadow-sm">
          {/* Background track */}
          <circle cx={60} cy={60} r={r} fill="none" stroke="#e5e7eb" strokeWidth={6} />
          {/* Progress arc */}
          {!isDelivered && (
            <circle
              cx={60} cy={60} r={r}
              fill="none"
              stroke={ringColor}
              strokeWidth={6}
              strokeDasharray={`${dash} ${circ}`}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
              style={{ transition: 'stroke-dasharray 1s linear, stroke 0.5s ease' }}
            />
          )}
          {isDelivered && (
            <circle cx={60} cy={60} r={r} fill="none" stroke="#10b981" strokeWidth={6} />
          )}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isDelivered ? (
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          ) : isEnRoute ? (
            <>
              <span className="font-display text-2xl font-black tabular-nums text-foreground leading-none">
                {m}
                <span className="text-base">:{s}</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-medium mt-0.5">Min</span>
            </>
          ) : (
            <>
              <Truck className="h-8 w-8 text-matcha-500" />
              <span className="text-[10px] text-muted-foreground mt-1">~{Math.ceil(remainSec / 60)} Min</span>
            </>
          )}
        </div>
      </div>

      {/* Label */}
      <div className="text-center">
        {isDelivered ? (
          <p className="text-sm font-bold text-emerald-600">Deine Bestellung wurde geliefert!</p>
        ) : isEnRoute ? (
          <p className="text-sm font-bold text-foreground">
            Dein Fahrer ist unterwegs
            {remainSec > 0 && (
              <span className="text-muted-foreground font-normal"> · noch ~{m} Min</span>
            )}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Voraussichtliche Lieferzeit</p>
        )}

        {etaLatest && !isDelivered && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            bis spätestens{' '}
            {new Date(etaLatest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
          </p>
        )}
      </div>

      {/* Pulse dot for live indicator */}
      {!isDelivered && (
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-matcha-500 animate-pulse" />
          <span className="text-[10px] text-muted-foreground">Live-ETA</span>
        </div>
      )}
    </div>
  );
}
