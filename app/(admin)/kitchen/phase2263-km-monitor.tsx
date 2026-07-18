'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Route } from 'lucide-react';

type FahrerKm = {
  fahrer_id: string;
  fahrer_name: string;
  gesamt_km: number;
  touren_heute: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  kosten_schaetzung: number;
};

type ApiData = {
  fahrer: FahrerKm[];
  team_gesamt_km: number;
  alert_count: number;
};

export function KitchenPhase2263KmMonitor({ locationId }: { locationId?: string | null }) {
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
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const alertFahrer = useMemo(
    () => (data?.fahrer ?? []).filter(f => f.ampel === 'rot'),
    [data],
  );

  const teamKosten = useMemo(
    () => data ? Math.round(data.fahrer.reduce((s, f) => s + f.kosten_schaetzung, 0) * 100) / 100 : 0,
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
          <span className="font-display text-sm font-bold uppercase tracking-wider">km-Monitor Fahrer</span>
          {data && (
            <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
              {data.team_gesamt_km} km · ~{teamKosten.toFixed(2)} €
            </span>
          )}
          {(data?.alert_count ?? 0) > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              {data!.alert_count} über Limit
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
                  <div className="text-xl font-black tabular-nums text-matcha-700">{data.team_gesamt_km}</div>
                </div>
                <div className="rounded-lg border bg-blue-50 dark:bg-blue-900/20 p-2 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Kosten-Schätz.</div>
                  <div className="text-xl font-black tabular-nums text-blue-700">{teamKosten.toFixed(0)} €</div>
                </div>
                <div className={`rounded-lg border p-2 text-center ${data.alert_count > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Alerts</div>
                  <div className={`text-xl font-black tabular-nums ${data.alert_count > 0 ? 'text-red-600' : 'text-green-600'}`}>{data.alert_count}</div>
                </div>
              </div>

              {/* Alert Banner */}
              {alertFahrer.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-700 dark:text-red-300">
                    <span className="font-bold">{alertFahrer.map(f => f.fahrer_name).join(', ')}</span>{' '}
                    haben &gt;120 km heute. Dispatcher informieren: Tour-Zuteilung prüfen.
                  </div>
                </div>
              )}

              {/* Driver km bars */}
              <div className="space-y-1.5">
                {data.fahrer.map(f => (
                  <div key={f.fahrer_id} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-[11px] font-bold truncate">{f.fahrer_name}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${f.ampel === 'gruen' ? 'bg-green-500' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, (f.gesamt_km / 150) * 100)}%` }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right text-[11px] font-bold tabular-nums">{f.gesamt_km} km</span>
                    <span className="w-12 shrink-0 text-right text-[9px] text-muted-foreground tabular-nums">{f.kosten_schaetzung.toFixed(2)} €</span>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-muted-foreground">
                Ampel: 🟢 &lt;80 km · 🟡 80–120 km · 🔴 &gt;120 km. Kosten à 0,30 €/km. Aktualisierung alle 15 Min.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
