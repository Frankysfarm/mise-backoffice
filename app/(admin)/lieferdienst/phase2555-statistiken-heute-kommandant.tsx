'use client';

/**
 * Phase 2555 — Statistiken Heute Kommandant
 *
 * Live-Übersicht der wichtigsten Kennzahlen für heute:
 * - 6 KPI-Kacheln mit Ampel-Farbkodierung und Trend vs. Vortag
 * - Stundenverlauf-Balkendiagramm (Bestellungen / Umsatz)
 * - Alert-Strip bei kritischen Werten
 * - 5-Min-Polling
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, Minus, BarChart3, AlertTriangle, Loader2,
  Euro, Clock, Package, Star, XCircle, Truck,
} from 'lucide-react';

interface StatData {
  umsatz_heute: number;
  umsatz_vortag: number;
  bestellungen_heute: number;
  bestellungen_vortag: number;
  avg_lieferzeit_min: number;
  avg_lieferzeit_vortag_min: number;
  puenktlichkeit_pct: number;
  storno_rate_pct: number;
  stunden: { stunde: number; umsatz: number; bestellungen: number }[];
  generatedAt: string;
}

type ChartMode = 'bestellungen' | 'umsatz';

function trendPct(now: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((now - prev) / prev) * 100;
}

function TrendBadge({ pct, good }: { pct: number | null; good: 'up' | 'down' }) {
  if (pct === null) return null;
  const positive = pct >= 0;
  const isGood = good === 'up' ? positive : !positive;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[9px] font-bold',
      isGood ? 'text-matcha-600' : 'text-red-500',
    )}>
      {positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  trendPct: number | null;
  goodDir: 'up' | 'down';
  state: 'green' | 'amber' | 'red';
}

function KpiCard({ icon, label, value, trendPct: pct, goodDir, state }: KpiCardProps) {
  const bg = state === 'green' ? 'bg-matcha-50 border-matcha-200' :
             state === 'amber' ? 'bg-amber-50 border-amber-200' :
             'bg-red-50 border-red-200';
  const val = state === 'green' ? 'text-matcha-700' :
              state === 'amber' ? 'text-amber-700' : 'text-red-700';
  return (
    <div className={cn('rounded-xl border p-3 flex flex-col gap-1', bg)}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={cn('h-5 w-5', val)}>{icon}</span>
      </div>
      <div className={cn('font-display text-xl font-black leading-none', val)}>{value}</div>
      <TrendBadge pct={pct} good={goodDir} />
    </div>
  );
}

const LOCATION_ID = 'bb01ae0a-da47-48b1-b986-3a1201aacc4b';

export function LieferdienstPhase2555StatistikHeuteKommandant() {
  const [data, setData] = useState<StatData | null>(null);
  const [loading, setLoading] = useState(false);
  const [chartMode, setChartMode] = useState<ChartMode>('bestellungen');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(prev => data === null ? true : prev);
    try {
      const r = await fetch(
        `/api/delivery/admin/statistiken-live-erweiterung?location_id=${LOCATION_ID}`
      );
      if (r.ok) setData(await r.json());
    } catch {}
    finally { setLoading(false); }
  }, [data]);

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 5 * 60 * 1000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchData]);

  const alerts: string[] = [];
  if (data) {
    if (data.storno_rate_pct > 10)      alerts.push(`Stornorate ${data.storno_rate_pct.toFixed(1)}% — zu hoch`);
    if (data.avg_lieferzeit_min > 35)   alerts.push(`Ø Lieferzeit ${data.avg_lieferzeit_min} Min — kritisch`);
    if (data.puenktlichkeit_pct < 75)   alerts.push(`Pünktlichkeit ${data.puenktlichkeit_pct}% — unter Ziel`);
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b bg-card">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Statistiken Heute</span>
        </div>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      {alerts.length > 0 && (
        <div className="border-b bg-red-50 px-4 py-2 flex flex-wrap gap-2">
          {alerts.map((a, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              <AlertTriangle className="h-3 w-3" />
              {a}
            </span>
          ))}
        </div>
      )}

      <div className="p-4 space-y-4">
        {data ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <KpiCard
                icon={<Euro className="h-4 w-4" />}
                label="Umsatz heute"
                value={euro(data.umsatz_heute)}
                trendPct={trendPct(data.umsatz_heute, data.umsatz_vortag)}
                goodDir="up"
                state={data.umsatz_heute >= data.umsatz_vortag ? 'green' : 'amber'}
              />
              <KpiCard
                icon={<Package className="h-4 w-4" />}
                label="Bestellungen"
                value={String(data.bestellungen_heute)}
                trendPct={trendPct(data.bestellungen_heute, data.bestellungen_vortag)}
                goodDir="up"
                state={data.bestellungen_heute >= data.bestellungen_vortag ? 'green' : 'amber'}
              />
              <KpiCard
                icon={<Clock className="h-4 w-4" />}
                label="Ø Lieferzeit"
                value={`${data.avg_lieferzeit_min} Min`}
                trendPct={trendPct(data.avg_lieferzeit_min, data.avg_lieferzeit_vortag_min)}
                goodDir="down"
                state={data.avg_lieferzeit_min <= 25 ? 'green' : data.avg_lieferzeit_min <= 35 ? 'amber' : 'red'}
              />
              <KpiCard
                icon={<Truck className="h-4 w-4" />}
                label="Pünktlichkeit"
                value={`${data.puenktlichkeit_pct}%`}
                trendPct={null}
                goodDir="up"
                state={data.puenktlichkeit_pct >= 85 ? 'green' : data.puenktlichkeit_pct >= 75 ? 'amber' : 'red'}
              />
              <KpiCard
                icon={<XCircle className="h-4 w-4" />}
                label="Stornorate"
                value={`${data.storno_rate_pct.toFixed(1)}%`}
                trendPct={null}
                goodDir="down"
                state={data.storno_rate_pct < 5 ? 'green' : data.storno_rate_pct < 10 ? 'amber' : 'red'}
              />
              <KpiCard
                icon={<Star className="h-4 w-4" />}
                label="Umsatz/Bestellung"
                value={euro(data.bestellungen_heute > 0 ? data.umsatz_heute / data.bestellungen_heute : 0)}
                trendPct={null}
                goodDir="up"
                state="green"
              />
            </div>

            {data.stunden.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Stundenverlauf
                  </span>
                  <div className="flex gap-1">
                    {(['bestellungen', 'umsatz'] as ChartMode[]).map(m => (
                      <button
                        key={m}
                        onClick={() => setChartMode(m)}
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[9px] font-bold transition',
                          chartMode === m
                            ? 'bg-matcha-600 text-white'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        )}
                      >
                        {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.stunden} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <XAxis
                        dataKey="stunde"
                        tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(h) => `${h}h`}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        formatter={(v: number) => chartMode === 'umsatz' ? euro(v) : `${v} Bestellungen`}
                        labelFormatter={(h) => `${h}:00 Uhr`}
                        contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      />
                      <Bar dataKey={chartMode} radius={[3, 3, 0, 0]}>
                        {data.stunden.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={
                              chartMode === 'bestellungen'
                                ? (entry.bestellungen >= 8 ? '#2d6b45' : entry.bestellungen >= 4 ? '#f4a623' : '#e5e7eb')
                                : (entry.umsatz >= 300 ? '#2d6b45' : entry.umsatz >= 150 ? '#f4a623' : '#e5e7eb')
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Lade Statistiken…
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Statistiken nicht verfügbar.
          </div>
        )}
      </div>
    </div>
  );
}
