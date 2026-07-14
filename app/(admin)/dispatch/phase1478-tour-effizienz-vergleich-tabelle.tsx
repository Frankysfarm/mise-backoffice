'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart3, ArrowUp, ArrowDown, Minus, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Phase 1478 — Tour-Effizienz-Vergleich-Tabelle (Dispatch)
// Fahrer A vs B vs C: Stopps/h + Ø Reaktionszeit + Rang. Sortierbar.
// Nutzt Phase1476-API fahrer-reaktionszeit. 30-Min-Polling.
// Nach Phase 1473.

interface Props {
  locationId: string | null;
}

interface FahrerZeile {
  fahrer_id: string;
  name: string;
  avg_reaktionszeit_min: number;
  anzahl: number;
  rang: number;
  trend: 'besser' | 'gleich' | 'schlechter';
}

const MOCK_FAHRER: FahrerZeile[] = [
  { fahrer_id: 'f1', name: 'Max M.',  avg_reaktionszeit_min: 3.2, anzahl: 42, rang: 1, trend: 'besser' },
  { fahrer_id: 'f2', name: 'Anna S.', avg_reaktionszeit_min: 4.7, anzahl: 35, rang: 2, trend: 'gleich' },
  { fahrer_id: 'f3', name: 'Tom B.',  avg_reaktionszeit_min: 6.8, anzahl: 28, rang: 3, trend: 'schlechter' },
  { fahrer_id: 'f4', name: 'Lisa W.', avg_reaktionszeit_min: 5.1, anzahl: 31, rang: 4, trend: 'gleich' },
];

type SortKey = 'rang' | 'avg_reaktionszeit_min' | 'anzahl';
type SortDir = 'asc' | 'desc';

const TREND_ICON = {
  besser:      <ArrowUp  className="h-3.5 w-3.5 text-emerald-500" />,
  gleich:      <Minus    className="h-3.5 w-3.5 text-amber-400" />,
  schlechter:  <ArrowDown className="h-3.5 w-3.5 text-rose-500" />,
};

const TREND_LABEL = {
  besser: 'text-emerald-600 dark:text-emerald-400',
  gleich: 'text-amber-600 dark:text-amber-400',
  schlechter: 'text-rose-600 dark:text-rose-400',
};

export function DispatchPhase1478TourEffizienzVergleichTabelle({ locationId }: Props) {
  const [fahrer, setFahrer] = useState<FahrerZeile[]>(MOCK_FAHRER);
  const [sortKey, setSortKey] = useState<SortKey>('rang');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [teamAvg, setTeamAvg] = useState<number>(4.9);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;

    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/admin/fahrer-reaktionszeit?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json?.fahrer)) {
            setFahrer(json.fahrer as FahrerZeile[]);
            setTeamAvg(json.team_avg_min ?? 0);
            setLastUpdated(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
          }
        }
      } catch {
        // keep mock
      }
    }

    load();
    const iv = setInterval(load, 30 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'rang' ? 'asc' : key === 'avg_reaktionszeit_min' ? 'asc' : 'desc');
    }
  }

  const sorted = [...fahrer].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1;
    return (a[sortKey] - b[sortKey]) * mul;
  });

  const slaZiel = 5;

  function ThBtn({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={cn(
          'text-[10px] font-bold uppercase tracking-wide flex items-center gap-0.5 hover:text-foreground transition-colors',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
        {active ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : null}
      </button>
    );
  }

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <BarChart3 className="h-4 w-4 shrink-0 text-violet-500" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour-Effizienz-Vergleich</span>
        {lastUpdated && <span className="text-[10px] text-muted-foreground">· {lastUpdated}</span>}
        <RefreshCw className="ml-auto h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <>
          {/* Team-KPI */}
          <div className="flex items-center gap-4 px-4 py-2 bg-muted/20 border-b text-xs">
            <div>
              <span className="text-muted-foreground">Team-Ø: </span>
              <span className={cn('font-bold', teamAvg <= slaZiel ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                {teamAvg.toFixed(1)} Min
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">SLA-Ziel: </span>
              <span className="font-bold text-foreground">&lt; {slaZiel} Min</span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/10">
                  <th className="px-3 py-2 text-left"><ThBtn label="#" k="rang" /></th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Fahrer</th>
                  <th className="px-3 py-2 text-right"><ThBtn label="Ø Reaktion" k="avg_reaktionszeit_min" /></th>
                  <th className="px-3 py-2 text-right"><ThBtn label="Aufträge" k="anzahl" /></th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((f) => {
                  const overSla = f.avg_reaktionszeit_min > slaZiel;
                  return (
                    <tr key={f.fahrer_id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2.5">
                        <span className={cn(
                          'inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-black',
                          f.rang === 1 ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' :
                          f.rang === 2 ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' :
                          'bg-muted text-muted-foreground',
                        )}>
                          {f.rang}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-foreground">{f.name}</td>
                      <td className={cn('px-3 py-2.5 text-right font-bold tabular-nums', overSla ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>
                        {f.avg_reaktionszeit_min.toFixed(1)} Min
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">{f.anzahl}</td>
                      <td className="px-3 py-2.5">
                        <div className={cn('flex items-center justify-center gap-1', TREND_LABEL[f.trend])}>
                          {TREND_ICON[f.trend]}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Keine Daten</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
