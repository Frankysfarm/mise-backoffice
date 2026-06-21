'use client';

/**
 * DispatchTourStopStatusMatrix — Echtzeit-Matrix aller aktiven Tour-Stopps.
 * Zeigt jeden Stopp mit Farbkodierung (pünktlich / knapp / verspätet) und ETA.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { MapPin, Clock, CheckCircle2, AlertTriangle, Bike, Route } from 'lucide-react';

type BatchStop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    eta_earliest: string | null;
    eta_latest: string | null;
  } | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: BatchStop[];
};

interface Props {
  batches: Batch[];
}

type StopHealth = 'pünktlich' | 'knapp' | 'verspätet' | 'geliefert' | 'offen';

interface StopRow {
  batchId: string;
  stopId: string;
  reihenfolge: number;
  driverName: string;
  bestellnummer: string;
  kundeName: string;
  adresse: string | null;
  health: StopHealth;
  etaLatestMin: number | null;
  geliefert: boolean;
}

function stopHealth(
  stop: BatchStop,
  now: number,
): StopHealth {
  if (stop.geliefert_am) return 'geliefert';
  const eta = stop.order?.eta_latest
    ? new Date(stop.order.eta_latest).getTime()
    : null;
  if (!eta) return 'offen';
  const remainSec = (eta - now) / 1000;
  if (remainSec < -120) return 'verspätet';
  if (remainSec < 300) return 'knapp';
  return 'pünktlich';
}

function etaMin(isoLatest: string | null | undefined, now: number): number | null {
  if (!isoLatest) return null;
  return Math.round((new Date(isoLatest).getTime() - now) / 60_000);
}

const HEALTH_STYLE: Record<StopHealth, {
  bg: string; dot: string; label: string; textColor: string;
}> = {
  pünktlich: { bg: 'bg-matcha-50',  dot: 'bg-matcha-500',  label: 'Pünktlich',  textColor: 'text-matcha-700'  },
  knapp:     { bg: 'bg-amber-50',   dot: 'bg-amber-400',   label: 'Knapp',      textColor: 'text-amber-700'   },
  verspätet: { bg: 'bg-red-50',     dot: 'bg-red-500',     label: 'Verspätet',  textColor: 'text-red-700'     },
  geliefert: { bg: 'bg-gray-50',    dot: 'bg-gray-400',    label: 'Geliefert',  textColor: 'text-gray-500'    },
  offen:     { bg: 'bg-blue-50',    dot: 'bg-blue-400',    label: 'Ausstehend', textColor: 'text-blue-700'    },
};

export function DispatchTourStopStatusMatrix({ batches }: Props) {
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(iv);
  }, []);

  const activeBatches = batches.filter((b) => b.status === 'unterwegs');
  if (!activeBatches.length) return null;

  const rows: StopRow[] = [];
  for (const batch of activeBatches) {
    const driverName = batch.fahrer
      ? `${batch.fahrer.vorname} ${batch.fahrer.nachname}`
      : 'Fahrer';
    for (const stop of batch.stops) {
      if (!stop.order) continue;
      rows.push({
        batchId: batch.id,
        stopId: stop.id,
        reihenfolge: stop.reihenfolge,
        driverName,
        bestellnummer: stop.order.bestellnummer,
        kundeName: stop.order.kunde_name,
        adresse: stop.order.kunde_adresse,
        health: stopHealth(stop, now),
        etaLatestMin: etaMin(stop.order.eta_latest, now),
        geliefert: !!stop.geliefert_am,
      });
    }
  }

  rows.sort((a, b) => {
    const order: StopHealth[] = ['verspätet', 'knapp', 'offen', 'pünktlich', 'geliefert'];
    return order.indexOf(a.health) - order.indexOf(b.health);
  });

  const late = rows.filter((r) => r.health === 'verspätet').length;
  const tight = rows.filter((r) => r.health === 'knapp').length;
  const delivered = rows.filter((r) => r.health === 'geliefert').length;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition"
      >
        <Route className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">
          Stopp-Status-Matrix
        </span>
        {late > 0 && (
          <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white">
            {late} verspätet
          </span>
        )}
        {tight > 0 && (
          <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-black text-white">
            {tight} knapp
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {delivered}/{rows.length} geliefert
        </span>
      </button>

      {open && (
        <div className="divide-y max-h-72 overflow-y-auto">
          {rows.map((row) => {
            const s = HEALTH_STYLE[row.health];
            return (
              <div
                key={row.stopId}
                className={cn('flex items-center gap-3 px-3 py-2', s.bg)}
              >
                <div className={cn('h-2 w-2 rounded-full shrink-0', s.dot)} />
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0 w-16">
                  <Bike className="h-3 w-3" />
                  <span className="truncate">{row.driverName.split(' ')[0]}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0 w-6 tabular-nums">
                  #{row.reihenfolge}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold truncate">
                      #{row.bestellnummer}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                      {row.kundeName}
                    </span>
                  </div>
                  {row.adresse && (
                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground truncate max-w-[200px]">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                      {row.adresse}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {row.geliefert ? (
                    <CheckCircle2 className="h-4 w-4 text-gray-400" />
                  ) : row.etaLatestMin !== null ? (
                    <div className={cn('text-xs font-bold tabular-nums', s.textColor)}>
                      {row.etaLatestMin > 0 ? `+${row.etaLatestMin}` : `${row.etaLatestMin}`} Min
                    </div>
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <div className={cn('text-[8px]', s.textColor)}>{s.label}</div>
                </div>
              </div>
            );
          })}
          {rows.length === 0 && (
            <div className="px-4 py-6 text-sm text-center text-muted-foreground">
              Keine aktiven Tour-Stopps.
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
