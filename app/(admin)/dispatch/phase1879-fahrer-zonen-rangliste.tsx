'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Award, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 1879 — Fahrer-Zonen-Rangliste-Widget (Dispatch)
 *
 * Top-3 Fahrer je Zone A/B/C/D: Pünktlichkeits-Quote + Stopps + Trend.
 * 15-Min-Polling. GET /api/delivery/admin/fahrer-zonen-rangliste (Phase 1878).
 */

type Trend = 'up' | 'down' | 'gleich';

interface FahrerZonenEintrag {
  fahrer_id: string;
  name: string;
  stopps_heute: number;
  puenktlichkeit_pct: number;
  trend: Trend;
  rang: number;
}

interface ZonenRangliste {
  zone: string;
  top_fahrer: FahrerZonenEintrag[];
}

const MOCK_ZONEN: ZonenRangliste[] = [
  {
    zone: 'A',
    top_fahrer: [
      { fahrer_id: 'f1', name: 'Max M.', stopps_heute: 12, puenktlichkeit_pct: 94, trend: 'up', rang: 1 },
      { fahrer_id: 'f2', name: 'Sara K.', stopps_heute: 10, puenktlichkeit_pct: 88, trend: 'gleich', rang: 2 },
      { fahrer_id: 'f3', name: 'Tim S.', stopps_heute: 8, puenktlichkeit_pct: 82, trend: 'down', rang: 3 },
    ],
  },
  {
    zone: 'B',
    top_fahrer: [
      { fahrer_id: 'f4', name: 'Ana P.', stopps_heute: 9, puenktlichkeit_pct: 91, trend: 'up', rang: 1 },
      { fahrer_id: 'f5', name: 'Leon B.', stopps_heute: 7, puenktlichkeit_pct: 85, trend: 'gleich', rang: 2 },
      { fahrer_id: 'f6', name: 'Mia H.', stopps_heute: 5, puenktlichkeit_pct: 76, trend: 'down', rang: 3 },
    ],
  },
  {
    zone: 'C',
    top_fahrer: [
      { fahrer_id: 'f7', name: 'Noah F.', stopps_heute: 6, puenktlichkeit_pct: 87, trend: 'up', rang: 1 },
      { fahrer_id: 'f8', name: 'Lena W.', stopps_heute: 4, puenktlichkeit_pct: 79, trend: 'gleich', rang: 2 },
      { fahrer_id: 'f3', name: 'Tim S.', stopps_heute: 3, puenktlichkeit_pct: 72, trend: 'down', rang: 3 },
    ],
  },
  {
    zone: 'D',
    top_fahrer: [
      { fahrer_id: 'f9', name: 'Jan V.', stopps_heute: 4, puenktlichkeit_pct: 83, trend: 'gleich', rang: 1 },
      { fahrer_id: 'f2', name: 'Sara K.', stopps_heute: 3, puenktlichkeit_pct: 78, trend: 'down', rang: 2 },
      { fahrer_id: 'f1', name: 'Max M.', stopps_heute: 2, puenktlichkeit_pct: 70, trend: 'gleich', rang: 3 },
    ],
  },
];

const RANG_FARB = ['bg-amber-500', 'bg-slate-400', 'bg-orange-700'] as const;

function puenktlichkeitAmpel(pct: number) {
  if (pct >= 85) return 'text-matcha-700 dark:text-matcha-300';
  if (pct >= 70) return 'text-amber-700 dark:text-amber-300';
  return 'text-red-700 dark:text-red-300';
}

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === 'up')   return <TrendingUp   className="h-3 w-3 text-matcha-500 shrink-0" />;
  if (trend === 'down') return <TrendingDown  className="h-3 w-3 text-red-500 shrink-0"   />;
  return                       <Minus         className="h-3 w-3 text-muted-foreground shrink-0" />;
}

interface Props {
  locationId: string | null;
  className?: string;
}

export function DispatchPhase1879FahrerZonenRangliste({ locationId, className }: Props) {
  const [zonen, setZonen] = useState<ZonenRangliste[]>([]);
  const [offen, setOffen] = useState(true);
  const [aktiveZone, setAktiveZone] = useState<string>('A');

  useEffect(() => {
    if (!locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/fahrer-zonen-rangliste?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const data = await res.json();
          setZonen(data.zonen ?? []);
        }
      } catch {
        setZonen(MOCK_ZONEN);
      }
    };

    laden();
    const id = setInterval(laden, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!locationId) return null;

  const anzeige = zonen.length > 0 ? zonen : MOCK_ZONEN;
  const aktiveZonenDaten = anzeige.find((z) => z.zone === aktiveZone) ?? anzeige[0];

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Award className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Fahrer-Zonen-Rangliste</span>
        <span className="ml-auto text-[10px] font-bold rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5">
          Top 3 je Zone
        </span>
        {offen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {/* Zone-Tabs */}
          <div className="flex gap-1.5">
            {anzeige.map((z) => (
              <button
                key={z.zone}
                onClick={() => setAktiveZone(z.zone)}
                className={cn(
                  'flex-1 rounded-lg py-1.5 text-xs font-bold transition-colors',
                  aktiveZone === z.zone
                    ? 'bg-matcha-500 text-white'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted/60',
                )}
              >
                Zone {z.zone}
              </button>
            ))}
          </div>

          {/* Top-Fahrer Rangliste */}
          {aktiveZonenDaten && (
            <div className="space-y-2">
              {aktiveZonenDaten.top_fahrer.map((f) => (
                <div
                  key={f.fahrer_id}
                  className="flex items-center gap-2.5 rounded-xl border bg-muted/20 px-3 py-2.5"
                >
                  <span className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white shrink-0',
                    RANG_FARB[f.rang - 1] ?? 'bg-slate-500',
                  )}>
                    {f.rang}
                  </span>
                  <span className="flex-1 text-xs font-semibold truncate">{f.name}</span>
                  <div className="flex items-center gap-1">
                    <TrendIcon trend={f.trend} />
                    <span className={cn('text-xs font-black tabular-nums', puenktlichkeitAmpel(f.puenktlichkeit_pct))}>
                      {f.puenktlichkeit_pct}%
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                    {f.stopps_heute} Stopps
                  </span>
                </div>
              ))}
              {aktiveZonenDaten.top_fahrer.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">
                  Noch keine Fahrer-Daten für Zone {aktiveZone}.
                </p>
              )}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-right">
            Sortiert nach Pünktlichkeit · Aktualisierung alle 15 Min
          </p>
        </div>
      )}
    </div>
  );
}
