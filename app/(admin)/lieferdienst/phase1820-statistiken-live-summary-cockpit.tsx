'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip, Cell } from 'recharts';
import { Activity, ChevronDown, ChevronUp, Clock, Euro, Star, TrendingDown, TrendingUp, Truck, Users } from 'lucide-react';

/**
 * Phase 1820 — Statistiken-Live-Summary-Cockpit (Lieferdienst)
 *
 * Überblicks-Dashboard mit den wichtigsten Tages-KPIs:
 *  - Bestellungen heute / Umsatz heute / Ø Lieferzeit / Pünktlichkeitsquote
 *  - Trend-Pfeil vs. gestern (je KPI)
 *  - Stunden-Balkendiagramm der letzten 8 Stunden
 *  - Aktive Fahrer + Top-Fahrer des Tages
 * 3-Min-Polling.
 */

interface SummaryData {
  bestellungen_heute: number;
  umsatz_heute_cents: number;
  avg_lieferzeit_min: number | null;
  puenktlichkeits_quote: number | null;
  aktive_fahrer: number;
  storno_rate: number | null;
  top_fahrer_name: string | null;
  top_fahrer_stopps: number | null;
  // Trend vs. gestern (positiv = besser)
  bestellungen_delta_pct: number | null;
  umsatz_delta_pct: number | null;
  lieferzeit_delta_min: number | null;
  // Stundenverteilung
  stunden_verlauf: { stunde: string; bestellungen: number }[];
}

const MOCK: SummaryData = {
  bestellungen_heute: 47,
  umsatz_heute_cents: 192340,
  avg_lieferzeit_min: 28,
  puenktlichkeits_quote: 82,
  aktive_fahrer: 5,
  storno_rate: 3.2,
  top_fahrer_name: 'Mehmet K.',
  top_fahrer_stopps: 14,
  bestellungen_delta_pct: 12,
  umsatz_delta_pct: 8,
  lieferzeit_delta_min: -2,
  stunden_verlauf: [
    { stunde: '12', bestellungen: 4 },
    { stunde: '13', bestellungen: 7 },
    { stunde: '14', bestellungen: 9 },
    { stunde: '15', bestellungen: 6 },
    { stunde: '16', bestellungen: 5 },
    { stunde: '17', bestellungen: 8 },
    { stunde: '18', bestellungen: 8 },
    { stunde: '19', bestellungen: 0 },
  ],
};

function fmt(cents: number) {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function TrendChip({ delta, unit = '%', higherIsBetter = true }: { delta: number | null; unit?: string; higherIsBetter?: boolean }) {
  if (delta === null) return null;
  const isPositive = higherIsBetter ? delta > 0 : delta < 0;
  const isNeutral  = Math.abs(delta) < 1;
  if (isNeutral) return <span className="text-[9px] text-muted-foreground">≈</span>;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[9px] font-bold',
      isPositive ? 'text-matcha-600' : 'text-red-600',
    )}>
      {isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {delta > 0 ? '+' : ''}{Math.abs(delta).toFixed(1)}{unit}
    </span>
  );
}

interface Props {
  locationId: string | null;
  className?: string;
}

export function LieferdienstPhase1820StatistikenLiveSummaryCockpit({ locationId, className }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/analytics?location_id=${locationId}&mode=summary`);
        if (res.ok && alive) {
          const j = await res.json();
          // Map API response — fall back to mock if fields missing
          setData({
            bestellungen_heute: j.bestellungen_heute ?? MOCK.bestellungen_heute,
            umsatz_heute_cents: j.umsatz_heute_cents ?? MOCK.umsatz_heute_cents,
            avg_lieferzeit_min: j.avg_lieferzeit_min ?? MOCK.avg_lieferzeit_min,
            puenktlichkeits_quote: j.puenktlichkeits_quote ?? MOCK.puenktlichkeits_quote,
            aktive_fahrer: j.aktive_fahrer ?? MOCK.aktive_fahrer,
            storno_rate: j.storno_rate ?? MOCK.storno_rate,
            top_fahrer_name: j.top_fahrer_name ?? MOCK.top_fahrer_name,
            top_fahrer_stopps: j.top_fahrer_stopps ?? MOCK.top_fahrer_stopps,
            bestellungen_delta_pct: j.bestellungen_delta_pct ?? MOCK.bestellungen_delta_pct,
            umsatz_delta_pct: j.umsatz_delta_pct ?? MOCK.umsatz_delta_pct,
            lieferzeit_delta_min: j.lieferzeit_delta_min ?? MOCK.lieferzeit_delta_min,
            stunden_verlauf: j.stunden_verlauf ?? MOCK.stunden_verlauf,
          });
          if (alive) setLastUpdated(new Date());
        } else if (alive) {
          setData(MOCK);
        }
      } catch {
        if (alive) setData(MOCK);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 3 * 60_000);
    return () => { alive = false; clearInterval(id); };
  }, [locationId]);

  const d = data ?? MOCK;

  const kpis = useMemo(() => [
    {
      icon: <Activity className="h-4 w-4 text-matcha-600" />,
      label: 'Bestellungen',
      value: String(d.bestellungen_heute),
      sub: 'heute',
      trend: <TrendChip delta={d.bestellungen_delta_pct} />,
    },
    {
      icon: <Euro className="h-4 w-4 text-amber-600" />,
      label: 'Umsatz',
      value: fmt(d.umsatz_heute_cents),
      sub: 'heute',
      trend: <TrendChip delta={d.umsatz_delta_pct} />,
    },
    {
      icon: <Clock className="h-4 w-4 text-blue-600" />,
      label: 'Ø Lieferzeit',
      value: d.avg_lieferzeit_min !== null ? `${d.avg_lieferzeit_min} Min` : '–',
      sub: 'je Bestellung',
      // For Lieferzeit: negative delta = shorter = better
      trend: <TrendChip delta={d.lieferzeit_delta_min} unit=" Min" higherIsBetter={false} />,
    },
    {
      icon: <Star className="h-4 w-4 text-yellow-500" />,
      label: 'Pünktlichkeit',
      value: d.puenktlichkeits_quote !== null ? `${d.puenktlichkeits_quote}%` : '–',
      sub: 'SLA <30 Min',
      trend: null,
    },
    {
      icon: <Users className="h-4 w-4 text-violet-600" />,
      label: 'Fahrer online',
      value: String(d.aktive_fahrer),
      sub: 'aktiv jetzt',
      trend: null,
    },
    {
      icon: <Truck className="h-4 w-4 text-orange-500" />,
      label: 'Storno',
      value: d.storno_rate !== null ? `${d.storno_rate.toFixed(1)}%` : '–',
      sub: 'Abbruchrate',
      trend: <TrendChip delta={d.storno_rate !== null ? -d.storno_rate : null} unit="%" higherIsBetter={false} />,
    },
  ], [d]);

  const maxBestellungen = useMemo(
    () => Math.max(1, ...d.stunden_verlauf.map((s) => s.bestellungen)),
    [d.stunden_verlauf],
  );

  if (!locationId) return null;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Activity className="h-4 w-4 shrink-0 text-matcha-600" />
        <span className="text-xs font-bold uppercase tracking-wider">Statistiken-Live-Summary</span>
        {loading && <span className="ml-1 text-[9px] text-muted-foreground animate-pulse">lädt…</span>}
        {lastUpdated && !loading && (
          <span className="ml-auto text-[9px] text-muted-foreground">
            {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* KPI Grid */}
          <div className="grid grid-cols-3 gap-2">
            {kpis.map(({ icon, label, value, sub, trend }) => (
              <div key={label} className="rounded-xl border bg-muted/20 px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  {icon}
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-base font-black tabular-nums text-foreground leading-none">{value}</span>
                  {trend}
                </div>
                <span className="text-[9px] text-muted-foreground mt-0.5 block">{sub}</span>
              </div>
            ))}
          </div>

          {/* Stunden-Verlauf */}
          {d.stunden_verlauf.length > 0 && (
            <div>
              <div className="mb-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Bestellungen nach Uhrzeit
              </div>
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.stunden_verlauf} barSize={14}>
                    <XAxis dataKey="stunde" tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}h`} />
                    <Tooltip
                      formatter={(val) => [`${val ?? 0}`, 'Bestellungen']}
                      labelFormatter={(l) => `${l}:00 Uhr`}
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    />
                    <Bar dataKey="bestellungen" radius={[3, 3, 0, 0]}>
                      {d.stunden_verlauf.map((entry) => (
                        <Cell
                          key={entry.stunde}
                          fill={entry.bestellungen === maxBestellungen ? '#4f7c52' : '#a3c9a8'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top Fahrer */}
          {d.top_fahrer_name && (
            <div className="flex items-center gap-3 rounded-xl border bg-matcha-50 dark:bg-matcha-950/20 border-matcha-200 dark:border-matcha-800 px-3 py-2">
              <Star className="h-4 w-4 text-amber-500 shrink-0" />
              <div>
                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Top-Fahrer heute</div>
                <div className="text-sm font-black text-foreground">
                  {d.top_fahrer_name}
                  {d.top_fahrer_stopps != null && (
                    <span className="ml-2 text-xs font-semibold text-matcha-600">· {d.top_fahrer_stopps} Stopps</span>
                  )}
                </div>
              </div>
            </div>
          )}

          <p className="text-[9px] text-muted-foreground text-right">Alle 3 Min aktualisiert · Mock-Daten wenn API nicht verfügbar</p>
        </div>
      )}
    </div>
  );
}
