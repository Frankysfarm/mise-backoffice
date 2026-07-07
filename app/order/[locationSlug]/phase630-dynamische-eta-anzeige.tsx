'use client';

import { useEffect, useState } from 'react';
import { Clock, RefreshCw, Zap } from 'lucide-react';

interface Props {
  orderId: string;
  initialEtaMin?: number | null;
  status?: string;
}

const STATUS_LABELS: Record<string, string> = {
  neu: 'Bestellung eingegangen',
  bestätigt: 'Bestätigt',
  in_zubereitung: 'Wird zubereitet',
  bereit: 'Bereit zur Abholung',
  unterwegs: 'Fahrer unterwegs',
  geliefert: 'Geliefert',
};

function EtaRing({ pct, color }: { pct: number; color: string }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <svg className="h-24 w-24 -rotate-90" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" className="text-gray-100 dark:text-gray-800" strokeWidth="6" />
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        stroke="currentColor"
        className={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
    </svg>
  );
}

export function Phase630DynamischeEtaAnzeige({ orderId, initialEtaMin, status }: Props) {
  const [etaMin, setEtaMin] = useState(initialEtaMin ?? null);
  const [elapsed, setElapsed] = useState(0);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const sec = Math.round((Date.now() - startTime) / 1_000);
      setElapsed(sec);
      if (etaMin !== null) {
        const remainMin = Math.max(0, (etaMin * 60 - sec) / 60);
        setEtaMin(Math.round(remainMin));
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [startTime, etaMin]);

  const total = initialEtaMin ?? 30;
  const remain = etaMin ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round(((total - remain) / total) * 100)) : 100;

  const ringColor =
    pct >= 90
      ? 'text-matcha-500'
      : pct >= 60
      ? 'text-amber-400'
      : 'text-blue-500';

  const statusLabel = status ? (STATUS_LABELS[status] ?? status) : 'In Bearbeitung';
  const isDelivered = status === 'geliefert';

  return (
    <div className="rounded-2xl border border-matcha-200 dark:border-matcha-800 bg-gradient-to-b from-matcha-50 to-white dark:from-matcha-950/30 dark:to-gray-900/10 p-5 shadow-sm">
      <div className="flex flex-col items-center gap-3">
        <div className="relative flex items-center justify-center">
          <EtaRing pct={isDelivered ? 100 : pct} color={isDelivered ? 'text-matcha-500' : ringColor} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {isDelivered ? (
              <span className="text-2xl">✓</span>
            ) : (
              <>
                <span className="text-2xl font-black tabular-nums text-gray-900 dark:text-gray-100">
                  {remain}
                </span>
                <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase">
                  Min
                </span>
              </>
            )}
          </div>
        </div>

        <div className="text-center">
          <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{statusLabel}</p>
          {!isDelivered && remain > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center justify-center gap-1">
              <Zap className="h-3 w-3 text-amber-400" />
              Noch ca. {remain} Minuten
            </p>
          )}
          {isDelivered && (
            <p className="text-xs text-matcha-600 dark:text-matcha-400 mt-0.5 font-semibold">
              Bestellung wurde geliefert 🎉
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
