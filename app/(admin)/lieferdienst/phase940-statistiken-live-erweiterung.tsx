'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { BarChart2, ChevronDown, ChevronUp, Loader2, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

/**
 * Phase 940 — Statistiken Live-Erweiterung (Lieferdienst)
 *
 * Erweitert das Statistiken-Dashboard um:
 * - Stündliche Umsatzkurve (Linien-SVG)
 * - Pünktlichkeits-Gauge
 * - Heute vs. Vortag Delta-Kacheln
 * Polling alle 5 Min auf /api/delivery/admin/statistiken-live-erweiterung.
 */

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

interface Props {
  locationId: string | null;
}

function Delta({ current, previous, unit = '' }: { current: number; previous: number; unit?: string }) {
  const diff = current - previous;
  const pct = previous > 0 ? ((diff / previous) * 100).toFixed(1) : null;
  const up = diff >= 0;
  return (
    <span className={cn('flex items-center gap-0.5 text-[10px] font-semibold', up ? 'text-matcha-600 dark:text-matcha-400' : 'text-red-600 dark:text-red-400')}>
      {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {pct ? `${pct}%` : `${diff > 0 ? '+' : ''}${diff.toFixed(0)}${unit}`}
    </span>
  );
}

function PuenktlichkeitsGauge({ pct }: { pct: number }) {
  const clamp = Math.max(0, Math.min(100, pct));
  const color = clamp >= 85 ? '#22c55e' : clamp >= 70 ? '#f59e0b' : '#ef4444';
  const angle = (clamp / 100) * 180;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-16 w-28">
        <svg viewBox="0 0 112 64" className="h-16 w-28">
          {/* Hintergrund-Bogen */}
          <path d="M 8 56 A 48 48 0 0 1 104 56" fill="none" strokeWidth="8" stroke="#e5e7eb" strokeLinecap="round" />
          {/* Farbiger Bogen */}
          <path
            d="M 8 56 A 48 48 0 0 1 104 56"
            fill="none"
            strokeWidth="8"
            stroke={color}
            strokeLinecap="round"
            strokeDasharray={`${(angle / 180) * 150.8} 150.8`}
          />
          {/* Nadel */}
          <line
            x1="56" y1="56"
            x2={56 + 36 * Math.cos(((angle - 180) * Math.PI) / 180)}
            y2={56 + 36 * Math.sin(((angle - 180) * Math.PI) / 180)}
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="56" cy="56" r="3" fill={color} />
        </svg>
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-sm font-black text-foreground">
          {clamp}%
        </span>
      </div>
      <span className="text-[10px] text-muted-foreground">Pünktlichkeit</span>
    </div>
  );
}

function StundenChart({ stunden }: { stunden: StatData['stunden'] }) {
  if (!stunden.length) return null;
  const maxUmsatz = Math.max(...stunden.map((s) => s.umsatz), 1);
  const h = 48;
  const w = 200;
  const step = w / Math.max(stunden.length - 1, 1);

  const points = stunden.map((s, i) => {
    const x = i * step;
    const y = h - (s.umsatz / maxUmsatz) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Umsatz je Stunde</p>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h + 12}`} className="h-16 min-w-full" preserveAspectRatio="none">
          {/* Area fill */}
          <defs>
            <linearGradient id="area952" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path
            d={`M ${points[0]} L ${points.slice(1).join(' L ')} L ${((stunden.length - 1) * step).toFixed(1)},${h} L 0,${h} Z`}
            fill="url(#area952)"
          />
          <polyline
            points={points.join(' ')}
            fill="none"
            stroke="#22c55e"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* X-Labels */}
          {stunden.filter((_, i) => i % 3 === 0).map((s, i, arr) => {
            const origIdx = stunden.findIndex((x) => x === s);
            return (
              <text key={s.stunde} x={(origIdx * step).toFixed(1)} y={h + 10} textAnchor="middle" fontSize="7" fill="currentColor" className="text-muted-foreground">
                {s.stunde}h
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export function LieferdienstPhase940StatistikenLiveErweiterung({ locationId }: Props) {
  const [data, setData] = useState<StatData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/statistiken-live-erweiterung?location_id=${locationId}`);
      if (res.ok) { setData(await res.json()); setLastRefresh(new Date()); }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  const kpis = data ? [
    {
      label: 'Umsatz heute',
      value: `${data.umsatz_heute.toFixed(2)} €`,
      prev: data.umsatz_vortag,
      curr: data.umsatz_heute,
      unit: '€',
    },
    {
      label: 'Bestellungen',
      value: `${data.bestellungen_heute}`,
      prev: data.bestellungen_vortag,
      curr: data.bestellungen_heute,
      unit: '',
    },
    {
      label: 'Ø Lieferzeit',
      value: `${data.avg_lieferzeit_min.toFixed(0)} Min`,
      prev: data.avg_lieferzeit_vortag_min,
      curr: data.avg_lieferzeit_min,
      unit: 'm',
      invertDelta: true,
    },
    {
      label: 'Storno-Rate',
      value: `${data.storno_rate_pct.toFixed(1)}%`,
      curr: 0,
      prev: 0,
    },
  ] : [];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/30 transition text-left"
      >
        <BarChart2 className="h-4 w-4 text-matcha-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Statistiken Live-Erweiterung
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        {lastRefresh && !loading && (
          <button
            onClick={(e) => { e.stopPropagation(); load(); }}
            className="ml-1 text-muted-foreground hover:text-foreground transition"
            title="Jetzt aktualisieren"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        )}
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {!locationId && (
            <p className="text-sm text-muted-foreground">Bitte Filiale auswählen.</p>
          )}

          {locationId && !loading && !data && (
            <p className="text-sm text-muted-foreground">Statistiken werden geladen…</p>
          )}

          {data && (
            <>
              {/* KPI Delta-Kacheln */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {kpis.map((kpi) => (
                  <div key={kpi.label} className="rounded-lg border border-border/60 bg-background/70 px-3 py-2.5">
                    <p className="text-[10px] text-muted-foreground mb-1">{kpi.label}</p>
                    <p className="text-sm font-black text-foreground">{kpi.value}</p>
                    {kpi.curr !== undefined && kpi.prev !== undefined && kpi.prev > 0 && (
                      <Delta current={(kpi as any).invertDelta ? -kpi.curr : kpi.curr} previous={(kpi as any).invertDelta ? -kpi.prev : kpi.prev} unit={kpi.unit} />
                    )}
                  </div>
                ))}
              </div>

              {/* Pünktlichkeits-Gauge + Stunden-Chart */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <PuenktlichkeitsGauge pct={data.puenktlichkeit_pct} />
                <div className="flex-1">
                  <StundenChart stunden={data.stunden} />
                </div>
              </div>

              {lastRefresh && (
                <p className="text-right text-[9px] text-muted-foreground">
                  Stand: {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · 5-Min-Refresh
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
