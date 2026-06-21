'use client';

/**
 * ZoneDifficultyDispatchPanel — Phase 356
 *
 * Zeigt dem Dispatcher wie Tour-Feedback die aktiven Dispatch-Parameter
 * beeinflusst: reduzierte Bundle-Kapazität und kleinere Detour-Toleranz
 * in schwierigen Zonen.
 *
 * Pollt alle 5 Minuten.
 */

import { useEffect, useState, useCallback } from 'react';
import { MapPin, TrendingDown, BarChart2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface ZoneCacheEntry {
  zone: string;
  avg_difficulty: number;
  avg_traffic: number;
  issue_rate_parking: number;
  issue_rate_nav: number;
  issue_rate_address: number;
  stop_count_modifier: number;
  detour_modifier: number;
  sample_count: number;
  computed_at: string;
}

const ZONE_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  A: { bg: 'bg-matcha-50',  border: 'border-matcha-200',  text: 'text-matcha-700',  badge: 'bg-matcha-100 text-matcha-800' },
  B: { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    badge: 'bg-blue-100 text-blue-800' },
  C: { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-800' },
  D: { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     badge: 'bg-red-100 text-red-800' },
};

function modifierBar(value: number): string {
  if (value >= 0.95) return 'bg-matcha-500';
  if (value >= 0.80) return 'bg-amber-500';
  return 'bg-red-500';
}

function formatModifier(v: number): string {
  return v < 1.0 ? `${Math.round(v * 100)}%` : '100%';
}

export function ZoneDifficultyDispatchPanel() {
  const [entries, setEntries] = useState<ZoneCacheEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/zone-difficulty?action=cache', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json() as { cache?: ZoneCacheEntry[] };
      setEntries(json.cache ?? []);
      setLastRefresh(new Date());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [fetchData]);

  const hasAdjustments = entries.some((e) => e.stop_count_modifier < 1.0 || e.detour_modifier < 1.0);

  return (
    <div className="w-full rounded-xl border border-gray-100 bg-white shadow-sm">
      <div
        className="flex cursor-pointer items-center justify-between px-4 py-3"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2">
          <BarChart2 className="h-3.5 w-3.5 text-matcha-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-600">
            Zone-Schwierigkeit
          </span>
          {hasAdjustments && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
              Dispatch angepasst
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">
            {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); fetchData(); }}
            disabled={loading}
            className="rounded p-0.5 text-gray-400 hover:text-matcha-600 disabled:opacity-40"
            aria-label="Aktualisieren"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {collapsed ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronUp className="h-3.5 w-3.5 text-gray-400" />}
        </div>
      </div>

      {!collapsed && (
        <div className="border-t border-gray-50 px-4 pb-3 pt-2">
          {entries.length === 0 && !loading && (
            <p className="py-3 text-center text-[11px] text-gray-400">
              Noch kein Feedback für Zone-Kalibrierung vorhanden.
            </p>
          )}
          <div className="space-y-2">
            {entries.map((e) => {
              const colors = ZONE_COLORS[e.zone] ?? ZONE_COLORS.A;
              return (
                <div key={e.zone} className={`rounded-lg border p-2.5 ${colors.bg} ${colors.border}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <MapPin className={`h-3 w-3 ${colors.text}`} />
                      <span className={`text-[11px] font-black ${colors.text}`}>Zone {e.zone}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${colors.badge}`}>
                        Ø {e.avg_difficulty.toFixed(1)} Schwierigkeit
                      </span>
                    </div>
                    <span className="text-[9px] text-gray-400">n={e.sample_count}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {/* Bundle-Kapazität */}
                    <div>
                      <div className="mb-0.5 flex justify-between">
                        <span className="text-[10px] text-gray-500">Bundle-Kap.</span>
                        <span className={`text-[10px] font-bold ${e.stop_count_modifier < 1 ? 'text-amber-600' : 'text-matcha-600'}`}>
                          {formatModifier(e.stop_count_modifier)}
                        </span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${modifierBar(e.stop_count_modifier)}`}
                          style={{ width: `${e.stop_count_modifier * 100}%` }}
                        />
                      </div>
                    </div>
                    {/* Detour-Toleranz */}
                    <div>
                      <div className="mb-0.5 flex justify-between">
                        <span className="text-[10px] text-gray-500">Detour-Tol.</span>
                        <span className={`text-[10px] font-bold ${e.detour_modifier < 1 ? 'text-amber-600' : 'text-matcha-600'}`}>
                          {formatModifier(e.detour_modifier)}
                        </span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${modifierBar(e.detour_modifier)}`}
                          style={{ width: `${e.detour_modifier * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Issue-Rates */}
                  {(e.issue_rate_parking > 10 || e.issue_rate_nav > 10 || e.issue_rate_address > 10) && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {e.issue_rate_parking > 10 && (
                        <span className="rounded-full bg-white/60 border px-1.5 py-0.5 text-[9px] text-gray-600">
                          Parken {e.issue_rate_parking.toFixed(0)}%
                        </span>
                      )}
                      {e.issue_rate_nav > 10 && (
                        <span className="rounded-full bg-white/60 border px-1.5 py-0.5 text-[9px] text-gray-600">
                          Nav {e.issue_rate_nav.toFixed(0)}%
                        </span>
                      )}
                      {e.issue_rate_address > 10 && (
                        <span className="rounded-full bg-white/60 border px-1.5 py-0.5 text-[9px] text-gray-600">
                          Adresse {e.issue_rate_address.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {hasAdjustments && (
            <div className="mt-2 flex items-center gap-1 rounded-md bg-amber-50 border border-amber-100 px-2 py-1.5">
              <TrendingDown className="h-3 w-3 text-amber-600 shrink-0" />
              <p className="text-[10px] text-amber-700">
                Dispatch-Algorithmus reduziert Bundle-Kapazität und Detour-Toleranz in diesen Zonen automatisch.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ZoneDifficultyDispatchPanel;
