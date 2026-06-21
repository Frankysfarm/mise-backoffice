'use client';

/**
 * FahrerTourZeitfensterKarte
 *
 * Zeigt die Lieferzeitfenster aller offenen Stopps in einer Tour als
 * visuelle Timeline mit Countdown, Farbkodierung und Dringlichkeitshinweis.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, MapPin, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';

interface Stop {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    id: string;
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    eta_earliest?: string | null;
    eta_latest?: string | null;
  } | null;
}

interface Props {
  stops: Stop[];
}

type TimeHealth = 'ok' | 'knapp' | 'kritisch' | 'verspätet' | 'fertig';

interface StopEntry {
  stopId: string;
  reihenfolge: number;
  bestellnummer: string;
  kundeName: string;
  adresse: string | null;
  geliefert: boolean;
  health: TimeHealth;
  etaLatestMin: number | null;
  etaEarliestMin: number | null;
  windowWidthMin: number | null;
}

function computeHealth(etaLatestMin: number | null, geliefert: boolean): TimeHealth {
  if (geliefert) return 'fertig';
  if (etaLatestMin === null) return 'ok';
  if (etaLatestMin < -5) return 'verspätet';
  if (etaLatestMin < 5) return 'kritisch';
  if (etaLatestMin < 15) return 'knapp';
  return 'ok';
}

const HEALTH_CONFIG: Record<TimeHealth, {
  bg: string; ring: string; dot: string; text: string; label: string;
}> = {
  ok:        { bg: 'bg-matcha-50',  ring: 'ring-matcha-200',  dot: 'bg-matcha-500',  text: 'text-matcha-700',  label: 'Pünktlich'  },
  knapp:     { bg: 'bg-amber-50',   ring: 'ring-amber-200',   dot: 'bg-amber-400',   text: 'text-amber-700',   label: 'Knapp'      },
  kritisch:  { bg: 'bg-red-50',     ring: 'ring-red-300',     dot: 'bg-red-500',     text: 'text-red-700',     label: 'Kritisch'   },
  verspätet: { bg: 'bg-red-100',    ring: 'ring-red-400',     dot: 'bg-red-600',     text: 'text-red-800',     label: 'Verspätet'  },
  fertig:    { bg: 'bg-gray-50',    ring: 'ring-gray-200',    dot: 'bg-gray-300',    text: 'text-gray-400',    label: 'Geliefert'  },
};

export function FahrerTourZeitfensterKarte({ stops }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(iv);
  }, []);

  if (!stops.length) return null;

  const entries: StopEntry[] = stops
    .filter((s) => s.order)
    .map((s): StopEntry => {
      const etaEarliestMin = s.order?.eta_earliest
        ? Math.round((new Date(s.order.eta_earliest).getTime() - now) / 60_000)
        : null;
      const etaLatestMin = s.order?.eta_latest
        ? Math.round((new Date(s.order.eta_latest).getTime() - now) / 60_000)
        : null;
      const windowWidthMin =
        etaEarliestMin !== null && etaLatestMin !== null
          ? etaLatestMin - etaEarliestMin
          : null;
      const geliefert = !!s.geliefert_am;
      return {
        stopId: s.id,
        reihenfolge: s.reihenfolge,
        bestellnummer: s.order!.bestellnummer,
        kundeName: s.order!.kunde_name,
        adresse: s.order!.kunde_adresse,
        geliefert,
        health: computeHealth(etaLatestMin, geliefert),
        etaLatestMin,
        etaEarliestMin,
        windowWidthMin,
      };
    })
    .sort((a, b) => a.reihenfolge - b.reihenfolge);

  const nextOpen = entries.find((e) => !e.geliefert);
  const urgentCount = entries.filter(
    (e) => !e.geliefert && (e.health === 'kritisch' || e.health === 'verspätet'),
  ).length;

  return (
    <div className="rounded-2xl bg-white/10 border border-white/20 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <Clock className="h-4 w-4 text-blue-300 shrink-0" />
        <span className="text-sm font-bold text-white">Zeitfenster</span>
        {urgentCount > 0 && (
          <span className="ml-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white flex items-center gap-1">
            <Zap className="h-2.5 w-2.5" />{urgentCount} kritisch
          </span>
        )}
        <span className="ml-auto text-[10px] text-blue-200/70">
          {entries.filter((e) => e.geliefert).length}/{entries.length} ✓
        </span>
      </div>

      <div className="divide-y divide-white/10">
        {entries.map((entry) => {
          const cfg = HEALTH_CONFIG[entry.health];
          const isNext = !entry.geliefert && entry.stopId === nextOpen?.stopId;
          return (
            <div
              key={entry.stopId}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5',
                entry.geliefert ? 'opacity-50' : '',
                isNext ? 'bg-white/10' : '',
              )}
            >
              {/* Stopp-Nr */}
              <div className={cn(
                'h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ring-2',
                cfg.dot, cfg.ring,
                entry.geliefert ? 'opacity-60' : '',
              )}>
                <span className="text-white">{entry.reihenfolge}</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    'text-[11px] font-bold truncate',
                    entry.geliefert ? 'text-white/50 line-through' : 'text-white',
                  )}>
                    #{entry.bestellnummer}
                  </span>
                  <span className="text-[10px] text-blue-200/70 truncate max-w-[120px]">
                    {entry.kundeName}
                  </span>
                </div>
                {entry.adresse && (
                  <div className="flex items-center gap-1 text-[9px] text-blue-200/50 truncate max-w-[200px]">
                    <MapPin className="h-2.5 w-2.5 shrink-0" />
                    {entry.adresse}
                  </div>
                )}
              </div>

              {/* ETA / Status */}
              <div className="shrink-0 text-right">
                {entry.geliefert ? (
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                ) : entry.etaLatestMin !== null ? (
                  <>
                    <div className={cn(
                      'text-xs font-bold tabular-nums',
                      entry.health === 'verspätet' || entry.health === 'kritisch'
                        ? 'text-red-300'
                        : entry.health === 'knapp'
                        ? 'text-amber-300'
                        : 'text-green-300',
                    )}>
                      {entry.etaLatestMin > 0
                        ? `noch ${entry.etaLatestMin} Min`
                        : `${Math.abs(entry.etaLatestMin)} Min über`}
                    </div>
                    <div className="text-[9px] text-blue-200/50">{cfg.label}</div>
                  </>
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
