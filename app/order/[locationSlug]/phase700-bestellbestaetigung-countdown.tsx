'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Truck } from 'lucide-react';

interface Props {
  etaMinuten: number;
  bestelltAt: string;
  isDelivery: boolean;
}

type Phase = 'bestätigt' | 'zubereitung' | 'unterwegs' | 'geliefert';

function getCurrentPhase(elapsedMin: number, etaMin: number): Phase {
  if (elapsedMin >= etaMin) return 'geliefert';
  if (elapsedMin >= etaMin * 0.6) return 'unterwegs';
  if (elapsedMin >= 2) return 'zubereitung';
  return 'bestätigt';
}

function formatMinuten(ms: number): string {
  const min = Math.max(0, Math.ceil(ms / 60_000));
  if (min === 0) return 'gleich';
  if (min < 60) return `${min} Min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

const PHASEN: Array<{ id: Phase; label: string; sub: string }> = [
  { id: 'bestätigt', label: 'Bestätigt', sub: 'Bestellung angenommen' },
  { id: 'zubereitung', label: 'Zubereitung', sub: 'Küche bereitet zu' },
  { id: 'unterwegs', label: 'Unterwegs', sub: 'Fahrer auf dem Weg' },
  { id: 'geliefert', label: 'Geliefert', sub: 'Guten Appetit!' },
];

export function Phase700BestellbestaetigungCountdown({ etaMinuten, bestelltAt, isDelivery }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  const bestelltMs = new Date(bestelltAt).getTime();
  const etaMs = bestelltMs + etaMinuten * 60_000;
  const elapsedMin = (now - bestelltMs) / 60_000;
  const verbleibendMs = etaMs - now;
  const phase = getCurrentPhase(elapsedMin, etaMinuten);
  const phasIdx = PHASEN.findIndex((p) => p.id === phase);
  const pct = Math.min(100, (elapsedMin / etaMinuten) * 100);

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {phase === 'geliefert' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          ) : isDelivery ? (
            <Truck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          ) : (
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          )}
          <span className="text-base font-bold">
            {phase === 'geliefert' ? 'Geliefert!' : isDelivery ? 'Lieferung' : 'Abholung'}
          </span>
        </div>
        {phase !== 'geliefert' && (
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums leading-none text-indigo-700 dark:text-indigo-400">
              {formatMinuten(verbleibendMs)}
            </p>
            <p className="text-[10px] text-muted-foreground">noch ca.</p>
          </div>
        )}
      </div>

      <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-indigo-500 transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-4 gap-1">
        {PHASEN.map((p, i) => {
          const done = i < phasIdx;
          const active = i === phasIdx;
          return (
            <div key={p.id} className="flex flex-col items-center gap-1 text-center">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition ${
                done
                  ? 'bg-emerald-500 text-white'
                  : active
                  ? 'bg-indigo-500 text-white ring-2 ring-indigo-300 dark:ring-indigo-700'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {done ? '✓' : i + 1}
              </div>
              <p className={`text-[9px] font-semibold leading-tight ${
                active ? 'text-indigo-700 dark:text-indigo-400' :
                done ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
              }`}>{p.label}</p>
            </div>
          );
        })}
      </div>

      {phase !== 'geliefert' && (
        <p className="text-[11px] text-center text-muted-foreground">
          ETA: ca. {new Date(etaMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
        </p>
      )}
    </div>
  );
}
