'use client';

/**
 * ZoneDifficultyClient — Phase 356
 * Admin-Dashboard für Zone-Schwierigkeits-Analyse.
 */

import { useState, useEffect, useCallback } from 'react';
import { MapPin, RefreshCw, TrendingDown, BarChart2, AlertTriangle, CheckCircle } from 'lucide-react';

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

const ZONE_LABELS: Record<string, string> = { A: 'Nah', B: 'Mittel', C: 'Weit', D: 'Sehr weit' };
const ZONE_COLORS: Record<string, { card: string; accent: string; bar: string }> = {
  A: { card: 'border-matcha-200 bg-matcha-50',  accent: 'text-matcha-700',  bar: 'bg-matcha-500' },
  B: { card: 'border-blue-200 bg-blue-50',      accent: 'text-blue-700',    bar: 'bg-blue-500' },
  C: { card: 'border-amber-200 bg-amber-50',    accent: 'text-amber-700',   bar: 'bg-amber-500' },
  D: { card: 'border-red-200 bg-red-50',        accent: 'text-red-700',     bar: 'bg-red-500' },
};

function diffBar(value: number, max = 5, color = 'bg-matcha-500') {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${(value / max) * 100}%` }}
      />
    </div>
  );
}

function modColor(v: number) {
  if (v >= 0.95) return 'text-matcha-700';
  if (v >= 0.80) return 'text-amber-600';
  return 'text-red-600';
}

export function ZoneDifficultyClient() {
  const [entries, setEntries] = useState<ZoneCacheEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/delivery/admin/zone-difficulty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh', days: 14 }),
      });
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  };

  const hardZones = entries.filter((e) => e.avg_difficulty >= 3.5);
  const avgOverall = entries.length > 0
    ? entries.reduce((s, e) => s + e.avg_difficulty, 0) / entries.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Header KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-2xl font-black tabular-nums text-gray-800">{entries.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Zonen analysiert</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className={`text-2xl font-black tabular-nums ${avgOverall >= 3.5 ? 'text-amber-600' : 'text-matcha-600'}`}>
            {avgOverall > 0 ? avgOverall.toFixed(1) : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Ø Schwierigkeit</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className={`text-2xl font-black tabular-nums ${hardZones.length > 0 ? 'text-amber-600' : 'text-matcha-600'}`}>
            {hardZones.length}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Schwierige Zonen</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-2xl font-black tabular-nums text-blue-600">
            {entries.reduce((s, e) => s + e.sample_count, 0)}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Feedback-Einträge</div>
        </div>
      </div>

      {/* Alert */}
      {hardZones.length > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Dispatch angepasst für {hardZones.map((z) => `Zone ${z.zone}`).join(', ')}
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Bundle-Kapazität und Detour-Toleranz wurden basierend auf Fahrer-Feedback reduziert.
            </p>
          </div>
        </div>
      ) : (
        !loading && entries.length > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-matcha-200 bg-matcha-50 p-4">
            <CheckCircle className="h-4 w-4 text-matcha-600 shrink-0" />
            <p className="text-sm text-matcha-700">Alle Zonen: normale Schwierigkeit. Keine Dispatch-Anpassungen aktiv.</p>
          </div>
        )
      )}

      {/* Zone Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {entries.map((e) => {
          const c = ZONE_COLORS[e.zone] ?? ZONE_COLORS.A;
          return (
            <div key={e.zone} className={`rounded-xl border p-4 ${c.card}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className={`h-4 w-4 ${c.accent}`} />
                  <span className={`text-sm font-black ${c.accent}`}>Zone {e.zone}</span>
                  <span className="text-xs text-gray-500">{ZONE_LABELS[e.zone] ?? ''}</span>
                </div>
                <span className="text-[10px] text-gray-400">n={e.sample_count}</span>
              </div>

              {/* Difficulty */}
              <div className="space-y-2.5">
                <div>
                  <div className="mb-1 flex justify-between text-[11px]">
                    <span className="text-gray-600">Ø Schwierigkeit</span>
                    <span className={`font-bold ${c.accent}`}>{e.avg_difficulty.toFixed(1)}/5</span>
                  </div>
                  {diffBar(e.avg_difficulty, 5, e.avg_difficulty >= 3.5 ? 'bg-amber-500' : e.avg_difficulty >= 4.5 ? 'bg-red-500' : c.bar)}
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-[11px]">
                    <span className="text-gray-600">Ø Verkehr</span>
                    <span className="font-bold text-gray-700">{e.avg_traffic.toFixed(1)}/5</span>
                  </div>
                  {diffBar(e.avg_traffic, 5, 'bg-blue-400')}
                </div>
              </div>

              {/* Issue Rates */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { label: 'Parken', value: e.issue_rate_parking },
                  { label: 'Navigation', value: e.issue_rate_nav },
                  { label: 'Adresse', value: e.issue_rate_address },
                ].map((issue) => (
                  <div key={issue.label} className="rounded-lg bg-white/60 p-2 text-center">
                    <div className={`text-sm font-black tabular-nums ${issue.value > 20 ? 'text-red-600' : issue.value > 10 ? 'text-amber-600' : 'text-gray-600'}`}>
                      {issue.value.toFixed(0)}%
                    </div>
                    <div className="text-[9px] text-gray-500">{issue.label}</div>
                  </div>
                ))}
              </div>

              {/* Dispatch Modifiers */}
              <div className="mt-3 flex gap-3 text-[10px]">
                <div className="flex-1 rounded-md bg-white/70 p-2">
                  <div className="text-gray-500 mb-0.5">Bundle-Kap.</div>
                  <div className={`font-black tabular-nums ${modColor(e.stop_count_modifier)}`}>
                    {Math.round(e.stop_count_modifier * 100)}%
                  </div>
                </div>
                <div className="flex-1 rounded-md bg-white/70 p-2">
                  <div className="text-gray-500 mb-0.5">Detour-Tol.</div>
                  <div className={`font-black tabular-nums ${modColor(e.detour_modifier)}`}>
                    {Math.round(e.detour_modifier * 100)}%
                  </div>
                </div>
                <div className="flex-1 rounded-md bg-white/70 p-2">
                  <div className="text-gray-500 mb-0.5">Aktualisiert</div>
                  <div className="font-medium text-gray-600">
                    {new Date(e.computed_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {entries.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed bg-white p-8 text-center">
          <BarChart2 className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">
            Noch kein Tour-Feedback für Zonen-Analyse. Wird automatisch nach den ersten Fahrer-Bewertungen befüllt.
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>
          Letzte Aktualisierung: {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          {' · '} Cron: stündlich
        </span>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Neu berechnen…' : 'Jetzt aktualisieren'}
        </button>
      </div>
    </div>
  );
}

export default ZoneDifficultyClient;
