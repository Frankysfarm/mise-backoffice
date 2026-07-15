'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart2, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';

/**
 * Phase 1659 — Schicht-Leistungs-Vergleich-Widget (Dispatch)
 *
 * Phase1657-API: /api/delivery/admin/schicht-leistungs-vergleich
 * Tabelle: Fahrer-Performance heute vs. Vorwoche (Stopps/h, Ø Lieferzeit, SLA, Bewertung).
 * Trend-Pfeile. 15-Min-Polling.
 */

interface FahrerLeistung {
  driver_id: string;
  fahrer_name: string;
  stopps_h_heute: number;
  stopps_h_vorwoche: number;
  lieferzeit_avg_heute: number;
  lieferzeit_avg_vorwoche: number;
  sla_quote_heute: number;
  sla_quote_vorwoche: number;
  bewertung_avg_heute: number;
  bewertung_avg_vorwoche: number;
}

interface ApiResponse {
  location_id: string;
  fahrer: FahrerLeistung[];
  generiert_am: string;
}

interface Props {
  locationId?: string | null;
}

const MOCK: ApiResponse = {
  location_id: 'mock',
  fahrer: [
    { driver_id: '1', fahrer_name: 'Max M.',  stopps_h_heute: 3.4, stopps_h_vorwoche: 3.0, lieferzeit_avg_heute: 27, lieferzeit_avg_vorwoche: 30, sla_quote_heute: 94, sla_quote_vorwoche: 90, bewertung_avg_heute: 4.6, bewertung_avg_vorwoche: 4.4 },
    { driver_id: '2', fahrer_name: 'Lisa K.', stopps_h_heute: 2.8, stopps_h_vorwoche: 3.2, lieferzeit_avg_heute: 33, lieferzeit_avg_vorwoche: 29, sla_quote_heute: 84, sla_quote_vorwoche: 92, bewertung_avg_heute: 4.1, bewertung_avg_vorwoche: 4.5 },
    { driver_id: '3', fahrer_name: 'Tom B.',  stopps_h_heute: 4.1, stopps_h_vorwoche: 3.9, lieferzeit_avg_heute: 24, lieferzeit_avg_vorwoche: 26, sla_quote_heute: 97, sla_quote_vorwoche: 95, bewertung_avg_heute: 4.8, bewertung_avg_vorwoche: 4.6 },
  ],
  generiert_am: new Date().toISOString(),
};

type TrendDir = 'up' | 'down' | 'flat';

function trend(heute: number, vorwoche: number, higherIsBetter = true): TrendDir {
  const diff = heute - vorwoche;
  if (Math.abs(diff) < 0.05) return 'flat';
  return (diff > 0) === higherIsBetter ? 'up' : 'down';
}

function TrendIcon({ dir }: { dir: TrendDir }) {
  if (dir === 'up')   return <TrendingUp   className="h-3 w-3 text-matcha-500" />;
  if (dir === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function slaColor(pct: number) {
  if (pct >= 90) return 'text-matcha-700 dark:text-matcha-300';
  if (pct >= 80) return 'text-amber-700 dark:text-amber-300';
  return 'text-red-700 dark:text-red-300';
}

export function DispatchPhase1659SchichtLeistungsVergleichWidget({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;

    async function load() {
      setLoading(true);
      try {
        const r = await fetch(`/api/delivery/admin/schicht-leistungs-vergleich?location_id=${locationId}`);
        if (r.ok) {
          const json = await r.json() as ApiResponse;
          if (json.fahrer?.length) setData(json);
        }
      } catch {
        // Mock bleibt
      } finally {
        setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(iv);
  }, [locationId]);

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <BarChart2 className="h-4 w-4 shrink-0 text-blue-500" />
        <span className="text-sm font-semibold flex-1 text-foreground">
          Schicht-Leistung Heute vs. Vorwoche
        </span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left pb-1.5 pr-2 font-medium">Fahrer</th>
                <th className="text-right pb-1.5 px-1 font-medium">Stopps/h</th>
                <th className="text-right pb-1.5 px-1 font-medium">Ø Lief.</th>
                <th className="text-right pb-1.5 px-1 font-medium">SLA%</th>
                <th className="text-right pb-1.5 pl-1 font-medium">★</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.fahrer.map(f => (
                <tr key={f.driver_id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-1.5 pr-2 font-medium text-foreground truncate max-w-[80px]">
                    {f.fahrer_name}
                  </td>

                  {/* Stopps/h */}
                  <td className="py-1.5 px-1 text-right tabular-nums">
                    <div className="flex items-center justify-end gap-0.5">
                      <TrendIcon dir={trend(f.stopps_h_heute, f.stopps_h_vorwoche)} />
                      <span className="font-bold">{f.stopps_h_heute.toFixed(1)}</span>
                      <span className="text-muted-foreground text-[9px]">/{f.stopps_h_vorwoche.toFixed(1)}</span>
                    </div>
                  </td>

                  {/* Lieferzeit */}
                  <td className="py-1.5 px-1 text-right tabular-nums">
                    <div className="flex items-center justify-end gap-0.5">
                      <TrendIcon dir={trend(f.lieferzeit_avg_heute, f.lieferzeit_avg_vorwoche, false)} />
                      <span className="font-bold">{f.lieferzeit_avg_heute}m</span>
                      <span className="text-muted-foreground text-[9px]">/{f.lieferzeit_avg_vorwoche}m</span>
                    </div>
                  </td>

                  {/* SLA */}
                  <td className="py-1.5 px-1 text-right tabular-nums">
                    <div className="flex items-center justify-end gap-0.5">
                      <TrendIcon dir={trend(f.sla_quote_heute, f.sla_quote_vorwoche)} />
                      <span className={cn('font-bold', slaColor(f.sla_quote_heute))}>
                        {f.sla_quote_heute}%
                      </span>
                    </div>
                  </td>

                  {/* Bewertung */}
                  <td className="py-1.5 pl-1 text-right tabular-nums">
                    <div className="flex items-center justify-end gap-0.5">
                      <TrendIcon dir={trend(f.bewertung_avg_heute, f.bewertung_avg_vorwoche)} />
                      <span className="font-bold">{f.bewertung_avg_heute.toFixed(1)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-[9px] text-muted-foreground mt-2">
            Heute / Vorwoche · SLA-Ziel 45 Min · Aktualisierung alle 15 Min
          </p>
        </div>
      )}
    </div>
  );
}
