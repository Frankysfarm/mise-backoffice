'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Trophy, Award, Bike, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';

type FahrerScore = {
  fahrer_name: string;
  score: number;
  lieferungen: number;
  puenktlichkeit_pct: number;
  avg_lieferzeit_min: number;
  trinkgeld_eur: number;
};

const MOCK_DATA: FahrerScore[] = [
  { fahrer_name: 'Max M.', score: 94, lieferungen: 24, puenktlichkeit_pct: 96, avg_lieferzeit_min: 23, trinkgeld_eur: 18.50 },
  { fahrer_name: 'Lisa K.', score: 88, lieferungen: 21, puenktlichkeit_pct: 90, avg_lieferzeit_min: 26, trinkgeld_eur: 14.00 },
  { fahrer_name: 'Tom B.', score: 81, lieferungen: 19, puenktlichkeit_pct: 84, avg_lieferzeit_min: 29, trinkgeld_eur: 11.20 },
  { fahrer_name: 'Sara W.', score: 72, lieferungen: 17, puenktlichkeit_pct: 78, avg_lieferzeit_min: 32, trinkgeld_eur: 8.00 },
  { fahrer_name: 'Alex P.', score: 65, lieferungen: 14, puenktlichkeit_pct: 71, avg_lieferzeit_min: 35, trinkgeld_eur: 5.50 },
];

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
        <Trophy size={14} className="text-amber-600" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
        <Award size={14} className="text-slate-500" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="h-7 w-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
        <Award size={14} className="text-orange-600" />
      </div>
    );
  }
  return (
    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
      <span className="text-[11px] font-bold text-muted-foreground">{rank}</span>
    </div>
  );
}

function scoreTextColor(score: number) {
  if (score >= 80) return 'text-matcha-700';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function scoreBarColor(score: number) {
  if (score >= 80) return 'bg-matcha-500';
  if (score >= 60) return 'bg-amber-400';
  return 'bg-red-400';
}

export function LieferdienstPhase2004FahrerPerformanceStatistikenHub({
  locationId,
  className,
}: {
  locationId: string | null;
  className?: string;
}) {
  const [drivers, setDrivers] = useState<FahrerScore[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (!locationId) {
        setDrivers(MOCK_DATA);
        setLoading(false);
        return;
      }
      fetch(`/api/delivery/admin/fahrer-tages-score?location_id=${encodeURIComponent(locationId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled) return;
          if (Array.isArray(d)) setDrivers(d);
          else setDrivers(MOCK_DATA);
        })
        .catch(() => { if (!cancelled) setDrivers(MOCK_DATA); })
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  const fmtEur = (v: number) =>
    v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Bike className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Fahrer-Performance-Hub
          </span>
          {!loading && drivers && drivers.length > 0 && (
            <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
              Top: {drivers[0].fahrer_name} · {drivers[0].score} Pkt.
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t p-4 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lade Fahrer-Scores…
            </div>
          ) : !drivers || drivers.length === 0 ? (
            <div className="text-sm text-muted-foreground">Keine Fahrer-Daten verfügbar.</div>
          ) : (
            drivers.map((driver, idx) => (
              <div key={driver.fahrer_name} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2.5">
                  <RankBadge rank={idx + 1} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold truncate">{driver.fahrer_name}</span>
                      <span className={cn('text-sm font-black tabular-nums', scoreTextColor(driver.score))}>
                        {driver.score} Pkt.
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', scoreBarColor(driver.score))}
                        style={{ width: `${driver.score}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1 text-[10px] text-muted-foreground">
                  <div className="flex flex-col items-center rounded bg-muted/50 py-1 px-0.5">
                    <span className="font-bold text-foreground tabular-nums">{driver.lieferungen}</span>
                    <span>Lieferungen</span>
                  </div>
                  <div className="flex flex-col items-center rounded bg-muted/50 py-1 px-0.5">
                    <span className="font-bold text-foreground tabular-nums">{driver.puenktlichkeit_pct}%</span>
                    <span>Pünktlichkeit</span>
                  </div>
                  <div className="flex flex-col items-center rounded bg-muted/50 py-1 px-0.5">
                    <span className="font-bold text-foreground tabular-nums">{driver.avg_lieferzeit_min} min</span>
                    <span>Ø Zeit</span>
                  </div>
                  <div className="flex flex-col items-center rounded bg-muted/50 py-1 px-0.5">
                    <span className="font-bold text-foreground tabular-nums">{fmtEur(driver.trinkgeld_eur)}</span>
                    <span>Trinkgeld</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
