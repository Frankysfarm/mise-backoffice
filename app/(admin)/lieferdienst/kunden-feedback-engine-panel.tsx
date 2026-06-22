'use client';

/**
 * KundenFeedbackEnginePanel — Phase 418
 *
 * Umfassendes Kundenzufriedenheits-Dashboard für Lieferdienst-Admin:
 * - Globale KPIs (Ø-Rating, Trend, Positiv/Negativ-Rate)
 * - 3 Tabs: Fahrer-Rangliste | Zonen-Heatmap | Tageszeit-Analyse
 * - 5-Min-Polling, collapsible
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Users,
  Map,
  Clock,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Typen ─────────────────────────────────────────────────────────────────────

interface RatingKpis {
  avgRating: number;
  totalCount: number;
  positivePct: number;
  negativePct: number;
}

interface TrendInfo {
  direction: 'up' | 'stable' | 'down';
  delta: number;
}

interface DriverEntry {
  rang: number;
  driverId: string;
  driverName: string | null;
  initials: string;
  totalRatings: number;
  avgRating: number;
  positiveCount: number;
  negativeCount: number;
}

interface ZoneEntry {
  zone: string;
  totalRatings: number;
  avgRating: number;
  negativeCount: number;
  qualityLabel: string;
}

interface TageszeitEntry {
  hourOfDay: number;
  totalRatings: number;
  avgRating: number;
  negativeCount: number;
  qualityLabel: string;
}

interface DashboardData {
  kpis: RatingKpis;
  trend: TrendInfo;
  driverRangliste: DriverEntry[];
  zoneHeatmap: ZoneEntry[];
  tageszeitAnalyse: TageszeitEntry[];
  worstHour: number | null;
  bestDriverName: string | null;
  worstZone: string | null;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function qualityColor(label: string): string {
  switch (label) {
    case 'excellent': return 'text-green-700 bg-green-50 border-green-200';
    case 'good':      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'fair':      return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    case 'poor':      return 'text-orange-700 bg-orange-50 border-orange-200';
    case 'critical':  return 'text-red-700 bg-red-50 border-red-200';
    default:          return 'text-gray-500 bg-gray-50 border-gray-200';
  }
}

function qualityBarColor(label: string): string {
  switch (label) {
    case 'excellent': return 'bg-green-500';
    case 'good':      return 'bg-emerald-400';
    case 'fair':      return 'bg-yellow-400';
    case 'poor':      return 'bg-orange-400';
    case 'critical':  return 'bg-red-500';
    default:          return 'bg-gray-300';
  }
}

function StarDisplay({ value, size = 'sm' }: { value: number; size?: 'sm' | 'xs' }) {
  const cls = size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(cls, s <= Math.round(value) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200')}
        />
      ))}
    </div>
  );
}

// ── Sub-Komponenten ───────────────────────────────────────────────────────────

function DriverRanglisteTab({ drivers }: { drivers: DriverEntry[] }) {
  if (drivers.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-gray-400">
        Keine Fahrer-Bewertungen vorhanden.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {drivers.map((d) => {
        const rangColor = d.rang === 1 ? 'text-yellow-600 bg-yellow-50' : d.rang === 2 ? 'text-gray-500 bg-gray-50' : d.rang === 3 ? 'text-amber-600 bg-amber-50' : 'text-gray-400 bg-gray-50';
        return (
          <div key={d.driverId} className="flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5">
            <div className={cn('h-7 w-7 rounded-full flex items-center justify-center text-xs font-black shrink-0', rangColor)}>
              {d.rang}
            </div>
            <div className="h-8 w-8 rounded-full bg-matcha-100 text-matcha-700 flex items-center justify-center text-xs font-bold shrink-0">
              {d.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">
                {d.driverName ?? 'Unbekannt'}
              </div>
              <StarDisplay value={d.avgRating} size="xs" />
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-black tabular-nums text-gray-900">{d.avgRating.toFixed(1)}</div>
              <div className="text-[10px] text-gray-400">{d.totalRatings} Bew.</div>
            </div>
            <div className="flex gap-1 shrink-0">
              <span className="text-[10px] font-semibold text-green-600 bg-green-50 border border-green-100 rounded px-1.5 py-0.5">
                +{d.positiveCount}
              </span>
              {d.negativeCount > 0 && (
                <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-100 rounded px-1.5 py-0.5">
                  -{d.negativeCount}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ZoneHeatmapTab({ zones }: { zones: ZoneEntry[] }) {
  if (zones.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-gray-400">
        Keine Zonen-Daten vorhanden.
      </div>
    );
  }
  const maxRatings = Math.max(...zones.map((z) => z.totalRatings), 1);
  return (
    <div className="space-y-2">
      {zones.map((z) => (
        <div key={z.zone} className="rounded-xl border bg-white px-3 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className={cn('text-[10px] font-bold uppercase border rounded px-1.5 py-0.5', qualityColor(z.qualityLabel))}>
                {z.zone}
              </span>
              <span className="text-[11px] text-gray-500">{z.totalRatings} Bewertungen</span>
            </div>
            <div className="text-sm font-black tabular-nums text-gray-900">{z.avgRating.toFixed(1)}</div>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', qualityBarColor(z.qualityLabel))}
              style={{ width: `${(z.totalRatings / maxRatings) * 100}%` }}
            />
          </div>
          {z.negativeCount > 0 && (
            <div className="mt-1 text-[10px] text-red-500">
              {z.negativeCount} negative Bewertung{z.negativeCount !== 1 ? 'en' : ''}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TageszeitTab({ tageszeit, worstHour }: { tageszeit: TageszeitEntry[]; worstHour: number | null }) {
  const filtered = tageszeit.filter((t) => t.totalRatings >= 1);
  if (filtered.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-gray-400">
        Keine Tageszeit-Daten vorhanden.
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {worstHour !== null && (
        <div className="mb-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
          <p className="text-xs font-semibold text-orange-700">
            Schlechteste Stunde: {worstHour}:00–{worstHour + 1}:00 Uhr
          </p>
          <p className="text-[10px] text-orange-600 mt-0.5">
            Hier häufen sich negative Bewertungen — Kapazität prüfen.
          </p>
        </div>
      )}
      {filtered.map((t) => {
        const isWorst = t.hourOfDay === worstHour;
        return (
          <div key={t.hourOfDay} className={cn('flex items-center gap-3 rounded-lg px-3 py-1.5', isWorst ? 'bg-orange-50 border border-orange-200' : 'border bg-white')}>
            <div className="w-12 text-xs font-bold text-gray-600 shrink-0 tabular-nums">
              {String(t.hourOfDay).padStart(2, '0')}:00
            </div>
            <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={cn('h-full rounded-full', qualityBarColor(t.qualityLabel))}
                style={{ width: `${Math.min((t.avgRating / 5) * 100, 100)}%` }}
              />
            </div>
            <div className="text-xs font-black tabular-nums text-gray-900 w-8 text-right">
              {t.avgRating.toFixed(1)}
            </div>
            <div className="text-[10px] text-gray-400 w-12 text-right">
              {t.totalRatings} Bew.
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

type Tab = 'fahrer' | 'zonen' | 'tageszeit';

export function KundenFeedbackEnginePanel({ locationId }: { locationId: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('fahrer');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/kunden-feedback-engine?location_id=${encodeURIComponent(locationId)}&days=30`,
      );
      if (!res.ok) return;
      const d = await res.json() as Record<string, unknown>;
      if (d.kpis) {
        setData({
          kpis:              d.kpis as RatingKpis,
          trend:             (d.trend as TrendInfo) ?? { direction: 'stable', delta: 0 },
          driverRangliste:   (d.driverRangliste as DriverEntry[]) ?? [],
          zoneHeatmap:       (d.zoneHeatmap as ZoneEntry[]) ?? [],
          tageszeitAnalyse:  (d.tageszeitAnalyse as TageszeitEntry[]) ?? [],
          worstHour:         (d.worstHour as number | null) ?? null,
          bestDriverName:    (d.bestDriverName as string | null) ?? null,
          worstZone:         (d.worstZone as string | null) ?? null,
        });
        setLastUpdate(new Date());
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 5 * 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  const kpis = data?.kpis;
  const trend = data?.trend;
  const TrendIcon = trend?.direction === 'up' ? TrendingUp : trend?.direction === 'down' ? TrendingDown : Minus;
  const trendColor = trend?.direction === 'up' ? 'text-green-600' : trend?.direction === 'down' ? 'text-red-500' : 'text-gray-400';

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'fahrer',   label: 'Fahrer',   icon: Users },
    { id: 'zonen',    label: 'Zonen',    icon: Map },
    { id: 'tageszeit',label: 'Tageszeit',icon: Clock },
  ];

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b bg-gray-50 hover:bg-gray-100 transition text-left"
      >
        <Star className="h-4 w-4 text-yellow-400 fill-yellow-400 shrink-0" />
        <span className="text-sm font-bold text-gray-800 uppercase tracking-wide">Kundenzufriedenheit Engine</span>
        <span className="text-[10px] text-gray-400 ml-1">30 Tage</span>
        <div className="ml-auto flex items-center gap-2">
          {lastUpdate && (
            <span className="text-[10px] text-gray-400 hidden sm:block">
              {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); void load(); }}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
          {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* KPI-Reihe */}
          {kpis ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {/* Ø-Rating */}
              <div className="rounded-xl bg-yellow-50 border border-yellow-100 p-3 flex flex-col items-center">
                <div className="text-3xl font-black text-gray-900 tabular-nums leading-none">
                  {kpis.avgRating > 0 ? kpis.avgRating.toFixed(1) : '—'}
                </div>
                <StarDisplay value={kpis.avgRating} size="xs" />
                <div className="text-[10px] text-gray-400 mt-1">Ø Rating</div>
              </div>

              {/* Gesamt-Bewertungen */}
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                <div className="text-2xl font-black text-blue-700 tabular-nums">{kpis.totalCount}</div>
                <div className="text-[10px] text-blue-500 mt-1">Bewertungen</div>
                {trend && (
                  <div className={cn('flex items-center gap-1 mt-1', trendColor)}>
                    <TrendIcon className="h-3 w-3" />
                    <span className="text-[10px] font-semibold tabular-nums">
                      {trend.delta > 0 ? '+' : ''}{trend.delta} vs. Vorwoche
                    </span>
                  </div>
                )}
              </div>

              {/* Positiv-Rate */}
              <div className="rounded-xl bg-green-50 border border-green-100 p-3">
                <div className="flex items-center gap-1">
                  <ThumbsUp className="h-3.5 w-3.5 text-green-600" />
                  <div className="text-2xl font-black text-green-700 tabular-nums">{kpis.positivePct}%</div>
                </div>
                <div className="text-[10px] text-green-600 mt-1">Positiv (≥4★)</div>
              </div>

              {/* Negativ-Rate */}
              <div className="rounded-xl bg-red-50 border border-red-100 p-3">
                <div className="flex items-center gap-1">
                  <ThumbsDown className="h-3.5 w-3.5 text-red-600" />
                  <div className="text-2xl font-black text-red-700 tabular-nums">{kpis.negativePct}%</div>
                </div>
                <div className="text-[10px] text-red-600 mt-1">Negativ (≤2★)</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          )}

          {/* Highlights */}
          {data && (data.bestDriverName || data.worstZone || data.worstHour !== null) && (
            <div className="flex flex-wrap gap-2">
              {data.bestDriverName && (
                <div className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-[11px] font-semibold text-green-700">Top-Fahrer: {data.bestDriverName}</span>
                </div>
              )}
              {data.worstZone && (
                <div className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5">
                  <Map className="h-3 w-3 text-orange-600" />
                  <span className="text-[11px] font-semibold text-orange-700">Schlechteste Zone: {data.worstZone}</span>
                </div>
              )}
              {data.worstHour !== null && (
                <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5">
                  <Clock className="h-3 w-3 text-red-600" />
                  <span className="text-[11px] font-semibold text-red-700">Problemzeit: {data.worstHour}:00 Uhr</span>
                </div>
              )}
            </div>
          )}

          {/* Tabs */}
          <div>
            <div className="flex gap-1 border-b mb-3">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition -mb-px',
                    activeTab === id
                      ? 'border-matcha-600 text-matcha-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {!data ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : activeTab === 'fahrer' ? (
              <DriverRanglisteTab drivers={data.driverRangliste} />
            ) : activeTab === 'zonen' ? (
              <ZoneHeatmapTab zones={data.zoneHeatmap} />
            ) : (
              <TageszeitTab tageszeit={data.tageszeitAnalyse} worstHour={data.worstHour} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
