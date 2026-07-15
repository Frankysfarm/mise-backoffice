'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, ChevronDown, ChevronUp, Navigation } from 'lucide-react';

/**
 * Phase 1730 — Zonen-Tipp-Karte (Fahrer-App)
 *
 * Welche Zone hat aktuell die höchste Bestelldichte + wenigste Fahrer?
 * Empfehlung + Zonen-Ranking; isOnline-Guard; 10-Min-Polling.
 * API: /api/delivery/admin/liefergebiet-auslastung (Phase 809/1717)
 */

interface ZoneData {
  name: string;
  auslastungPct: number;
  status: 'ok' | 'hoch' | 'kritisch';
  aktiveFahrer: number;
}

interface AuslastungResponse {
  zonen: ZoneData[];
  alarm: boolean;
  generiert_am: string;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

const MOCK_ZONEN: AuslastungResponse = {
  zonen: [
    { name: 'Zone A', auslastungPct: 85, status: 'kritisch', aktiveFahrer: 1 },
    { name: 'Zone B', auslastungPct: 60, status: 'hoch', aktiveFahrer: 2 },
    { name: 'Zone C', auslastungPct: 30, status: 'ok', aktiveFahrer: 3 },
    { name: 'Zone D', auslastungPct: 50, status: 'ok', aktiveFahrer: 2 },
  ],
  alarm: true,
  generiert_am: new Date().toISOString(),
};

function tippZone(zonen: ZoneData[]): ZoneData | null {
  // highest demand (auslastungPct) with fewest drivers
  return [...zonen].sort((a, b) => {
    const scoreA = a.auslastungPct / Math.max(1, a.aktiveFahrer);
    const scoreB = b.auslastungPct / Math.max(1, b.aktiveFahrer);
    return scoreB - scoreA;
  })[0] ?? null;
}

const statusLabel: Record<string, string> = {
  ok: 'Niedrig',
  hoch: 'Hoch',
  kritisch: 'Sehr hoch',
};

const statusColor: Record<string, string> = {
  ok: 'text-green-600 dark:text-green-400',
  hoch: 'text-amber-600 dark:text-amber-400',
  kritisch: 'text-red-600 dark:text-red-400',
};

const barColor: Record<string, string> = {
  ok: 'bg-green-500',
  hoch: 'bg-amber-500',
  kritisch: 'bg-red-500',
};

export function FahrerPhase1730ZonenTippKarte({ driverId, locationId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<AuslastungResponse | null>(null);

  useEffect(() => {
    if (!isOnline || !locationId) return;
    const load = () =>
      fetch(`/api/delivery/admin/liefergebiet-auslastung?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: AuslastungResponse) => setData(d))
        .catch(() => setData(MOCK_ZONEN));
    load();
    const id = setInterval(load, 10 * 60_000);
    return () => clearInterval(id);
  }, [isOnline, locationId]);

  if (!isOnline) return null;

  const d = data ?? MOCK_ZONEN;
  const tipp = tippZone(d.zonen);

  return (
    <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/30 dark:bg-sky-950/10 p-3 mb-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-sky-700 dark:text-sky-300">
          <MapPin className="h-4 w-4" />
          Zonen-Tipp
          {tipp && (
            <span className="rounded-full bg-sky-500 px-2 py-0.5 text-xs font-black text-white">
              {tipp.name}
            </span>
          )}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {tipp && (
            <div className="flex items-center gap-3 rounded-xl border border-sky-300 dark:border-sky-700 bg-sky-100/60 dark:bg-sky-900/30 px-3 py-2.5">
              <Navigation className="h-5 w-5 text-sky-600 dark:text-sky-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-sky-800 dark:text-sky-200">
                  Empfehlung: Fahre zu {tipp.name}
                </p>
                <p className="text-[10px] text-sky-600 dark:text-sky-400">
                  Nachfrage {statusLabel[tipp.status]} · {tipp.aktiveFahrer} Fahrer aktiv · {tipp.auslastungPct}% Auslastung
                </p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            {d.zonen.map(z => (
              <div key={z.name} className="space-y-0.5">
                <div className="flex justify-between text-[10px]">
                  <span className={cn(
                    'font-semibold',
                    tipp?.name === z.name ? 'text-sky-700 dark:text-sky-300' : 'text-foreground',
                  )}>
                    {z.name}
                    {tipp?.name === z.name && (
                      <span className="ml-1 text-[9px] font-black text-sky-600 dark:text-sky-400">← TIPP</span>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    <span className={statusColor[z.status]}>{statusLabel[z.status]}</span>
                    {' · '}{z.aktiveFahrer} Fahrer
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', barColor[z.status])}
                    style={{ width: `${z.auslastungPct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground">
            Höchste Nachfrage ÷ wenigste Fahrer · 10-Min-Polling
          </p>
        </div>
      )}
    </div>
  );
}
