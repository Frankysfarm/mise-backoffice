'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Route } from 'lucide-react';

type FahrerKm = {
  fahrer_id: string;
  fahrer_name: string;
  gesamt_km: number;
  touren_heute: number;
  avg_km_tour: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  kosten_schaetzung: number;
  rang: number;
};

type ApiData = {
  fahrer: FahrerKm[];
  team_gesamt_km: number;
  team_avg_km_tour: number;
  alert_count: number;
};

function ampelLabel(a: 'gruen' | 'gelb' | 'rot'): string {
  if (a === 'gruen') return '🟢';
  if (a === 'gelb') return '🟡';
  return '🔴';
}

function rowBg(a: 'gruen' | 'gelb' | 'rot'): string {
  if (a === 'gruen') return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  if (a === 'gelb') return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
}

function rowText(a: 'gruen' | 'gelb' | 'rot'): string {
  if (a === 'gruen') return 'text-green-700 dark:text-green-300';
  if (a === 'gelb') return 'text-yellow-700 dark:text-yellow-300';
  return 'text-red-700 dark:text-red-300';
}

function trendIcon(t: FahrerKm['trend']): string {
  if (t === 'steigend') return '↑';
  if (t === 'fallend') return '↓';
  return '→';
}

function podiumBadge(rang: number): string {
  if (rang === 1) return '🥇';
  if (rang === 2) return '🥈';
  if (rang === 3) return '🥉';
  return '';
}

export function DispatchPhase2260KmRankingBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/fahrer-kilometerstand?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const alertFahrer = useMemo(
    () => (data?.fahrer ?? []).filter(f => f.ampel === 'rot'),
    [data],
  );

  if (!locationId || (!loading && !data)) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">km-Ranking Fahrer</span>
          {data && (
            <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
              {data.team_gesamt_km} km gesamt · ⌀ {data.team_avg_km_tour} km/Tour
            </span>
          )}
          {(data?.alert_count ?? 0) > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              {data!.alert_count} Alert
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-3">
          {loading && <p className="text-xs text-muted-foreground">Lade km-Daten…</p>}

          {!loading && data && (
            <>
              {/* Team KPI */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border bg-matcha-50 dark:bg-matcha-900/20 p-2 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-600">Team km</div>
                  <div className="text-lg font-black tabular-nums text-matcha-700">{data.team_gesamt_km}</div>
                </div>
                <div className="rounded-lg border bg-blue-50 dark:bg-blue-900/20 p-2 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600">⌀ km/Tour</div>
                  <div className="text-lg font-black tabular-nums text-blue-700">{data.team_avg_km_tour}</div>
                </div>
                <div className={`rounded-lg border p-2 text-center ${data.alert_count > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Alerts</div>
                  <div className={`text-lg font-black tabular-nums ${data.alert_count > 0 ? 'text-red-600' : 'text-green-600'}`}>{data.alert_count}</div>
                </div>
              </div>

              {/* Alert Banner */}
              {alertFahrer.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-700 dark:text-red-300">
                    <span className="font-bold">{alertFahrer.length} Fahrer über 120 km:</span>{' '}
                    {alertFahrer.map(f => f.fahrer_name).join(', ')} — Fahrkosten prüfen und ggf. Tour-Zuteilung anpassen.
                  </div>
                </div>
              )}

              {/* Driver List */}
              <div className="space-y-1.5">
                {data.fahrer.map(f => (
                  <div
                    key={f.fahrer_id}
                    className={`rounded-lg border px-3 py-2 flex items-center gap-2 ${rowBg(f.ampel)}`}
                  >
                    <span className="text-base shrink-0">{podiumBadge(f.rang) || ampelLabel(f.ampel)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-bold ${rowText(f.ampel)}`}>{f.fahrer_name}</span>
                        <span className="text-[10px] font-black tabular-nums text-foreground">{f.gesamt_km} km</span>
                        <span className={`text-[9px] font-bold ${f.trend === 'steigend' ? 'text-red-500' : f.trend === 'fallend' ? 'text-green-500' : 'text-muted-foreground'}`}>
                          {trendIcon(f.trend)} {f.trend_delta > 0 ? '+' : ''}{f.trend_delta} km vs. Vorwoche
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${f.ampel === 'gruen' ? 'bg-green-500' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(100, (f.gesamt_km / 150) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[9px] tabular-nums text-muted-foreground shrink-0">
                          {f.touren_heute} Touren · ⌀ {f.avg_km_tour} km · ~{f.kosten_schaetzung.toFixed(2)} €
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-muted-foreground">
                Ampel: 🟢 &lt;80 km · 🟡 80–120 km · 🔴 &gt;120 km. Kosten-Schätzung à 0,30 €/km. Aktualisierung alle 30 Min.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
