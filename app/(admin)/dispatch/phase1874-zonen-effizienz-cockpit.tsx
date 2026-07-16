'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart2, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

/**
 * Phase 1874 — Zonen-Effizienz-Cockpit (Dispatch)
 *
 * Tabelle A/B/C/D: SLA-Quote / Ø Wartezeit / Umsatz + Trend.
 * Kritisch-Badge wenn SLA < 70%. 15-Min-Polling.
 * GET /api/delivery/admin/zonen-effizienz (Phase 1873).
 */

type Trend = 'up' | 'down' | 'gleich';

interface ZonenEffizienz {
  zone: string;
  sla_quote: number;
  sla_quote_woche: number;
  avg_wartezeit_min: number;
  avg_wartezeit_min_woche: number;
  umsatz_cents: number;
  bestellungen_heute: number;
  kritisch: boolean;
  trend_sla: Trend;
  trend_wartezeit: Trend;
}

const MOCK_ZONEN: ZonenEffizienz[] = [
  { zone: 'A', sla_quote: 91, sla_quote_woche: 88, avg_wartezeit_min: 22, avg_wartezeit_min_woche: 24, umsatz_cents: 84_00, bestellungen_heute: 14, kritisch: false, trend_sla: 'up',   trend_wartezeit: 'down' },
  { zone: 'B', sla_quote: 78, sla_quote_woche: 80, avg_wartezeit_min: 31, avg_wartezeit_min_woche: 30, umsatz_cents: 62_00, bestellungen_heute: 9,  kritisch: false, trend_sla: 'down', trend_wartezeit: 'up' },
  { zone: 'C', sla_quote: 65, sla_quote_woche: 68, avg_wartezeit_min: 39, avg_wartezeit_min_woche: 37, umsatz_cents: 41_00, bestellungen_heute: 6,  kritisch: true,  trend_sla: 'down', trend_wartezeit: 'up' },
  { zone: 'D', sla_quote: 52, sla_quote_woche: 55, avg_wartezeit_min: 47, avg_wartezeit_min_woche: 49, umsatz_cents: 18_00, bestellungen_heute: 2,  kritisch: true,  trend_sla: 'down', trend_wartezeit: 'down' },
];

function slaAmpel(quote: number) {
  if (quote < 70) return 'rot';
  if (quote < 80) return 'amber';
  return 'gruen';
}

const SLA_FARB = {
  gruen: 'text-matcha-700 dark:text-matcha-300',
  amber: 'text-amber-700 dark:text-amber-300',
  rot:   'text-red-700 dark:text-red-300',
} as const;

function TrendPfeil({ trend }: { trend: Trend }) {
  if (trend === 'up')   return <TrendingUp   className="h-3 w-3 text-red-500 shrink-0"            />;
  if (trend === 'down') return <TrendingDown  className="h-3 w-3 text-matcha-500 shrink-0"        />;
  return                       <Minus         className="h-3 w-3 text-muted-foreground shrink-0"  />;
}

function TrendPfeilSla({ trend }: { trend: Trend }) {
  if (trend === 'up')   return <TrendingUp   className="h-3 w-3 text-matcha-500 shrink-0"         />;
  if (trend === 'down') return <TrendingDown  className="h-3 w-3 text-red-500 shrink-0"           />;
  return                       <Minus         className="h-3 w-3 text-muted-foreground shrink-0"  />;
}

function eurosFormat(cents: number) {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

interface Props {
  locationId: string | null;
  className?: string;
}

export function DispatchPhase1874ZonenEffizienzCockpit({ locationId, className }: Props) {
  const [zonen, setZonen] = useState<ZonenEffizienz[]>([]);
  const [offen, setOffen] = useState(true);

  useEffect(() => {
    if (!locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/zonen-effizienz?location_id=${locationId}`,
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
  const kritischZonen = anzeige.filter((z) => z.kritisch);

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <BarChart2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Zonen-Effizienz-Cockpit</span>
        {kritischZonen.length > 0 && (
          <span className="ml-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
            {kritischZonen.length} Kritisch
          </span>
        )}
        {offen ? (
          <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {kritischZonen.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                Zone{kritischZonen.length > 1 ? 'n' : ''}{' '}
                {kritischZonen.map((z) => z.zone).join(', ')} — SLA unter 70% — sofort Fahrer umrouten oder Kapazität erhöhen.
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-2 text-left font-semibold">Zone</th>
                  <th className="pb-2 text-right font-semibold">SLA-Quote</th>
                  <th className="pb-2 text-right font-semibold">Ø Wartezeit</th>
                  <th className="pb-2 text-right font-semibold">Umsatz</th>
                  <th className="pb-2 text-right font-semibold">Bstlg.</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {anzeige.map((z) => {
                  const amp = slaAmpel(z.sla_quote);
                  return (
                    <tr key={z.zone} className={cn(z.kritisch && 'bg-red-50/50 dark:bg-red-950/10')}>
                      <td className="py-2.5 pr-2 font-bold">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white',
                            z.kritisch ? 'bg-red-500' : z.sla_quote >= 80 ? 'bg-matcha-500' : 'bg-amber-500',
                          )}>
                            {z.zone}
                          </span>
                          {z.kritisch && (
                            <span className="rounded-full bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 text-[9px] font-bold text-red-700 dark:text-red-300">
                              Kritisch
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <TrendPfeilSla trend={z.trend_sla} />
                          <span className={cn('font-bold tabular-nums', SLA_FARB[amp])}>
                            {z.sla_quote}%
                          </span>
                        </div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground tabular-nums text-right">
                          Ø {z.sla_quote_woche}% (7T)
                        </div>
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <TrendPfeil trend={z.trend_wartezeit} />
                          <span className={cn(
                            'font-bold tabular-nums',
                            z.avg_wartezeit_min >= 40 ? 'text-red-600' : z.avg_wartezeit_min >= 30 ? 'text-amber-600' : 'text-matcha-600',
                          )}>
                            {z.avg_wartezeit_min} Min
                          </span>
                        </div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground tabular-nums text-right">
                          Ø {z.avg_wartezeit_min_woche} Min (7T)
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-bold tabular-nums">
                        {eurosFormat(z.umsatz_cents)}
                      </td>
                      <td className="py-2.5 text-right text-muted-foreground tabular-nums">
                        {z.bestellungen_heute}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-[10px] text-muted-foreground text-right">
            SLA-Ziel: ≥80% · Kritisch: &lt;70% · Aktualisierung alle 15 Min
          </p>
        </div>
      )}
    </div>
  );
}
