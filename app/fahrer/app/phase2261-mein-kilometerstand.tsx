'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Route } from 'lucide-react';

type ApiData = {
  fahrer: {
    fahrer_id: string;
    gesamt_km: number;
    touren_heute: number;
    avg_km_tour: number;
    trend: 'steigend' | 'fallend' | 'stabil';
    trend_delta: number;
    ampel: 'gruen' | 'gelb' | 'rot';
    kosten_schaetzung: number;
  } | null;
  team_avg_km_tour: number;
  team_gesamt_km: number;
};

function ampelColor(a: 'gruen' | 'gelb' | 'rot'): string {
  if (a === 'gruen') return 'text-green-600';
  if (a === 'gelb') return 'text-yellow-600';
  return 'text-red-600';
}

function ampelBg(a: 'gruen' | 'gelb' | 'rot'): string {
  if (a === 'gruen') return 'bg-green-50 border-green-200';
  if (a === 'gelb') return 'bg-yellow-50 border-yellow-200';
  return 'bg-red-50 border-red-200';
}

function trendIcon(t: 'steigend' | 'fallend' | 'stabil'): string {
  if (t === 'steigend') return '↑';
  if (t === 'fallend') return '↓';
  return '→';
}

function coachingTipp(km: number, avgTeam: number): string {
  if (km > 120) return 'Du bist heute viel unterwegs — prüfe, ob kürzere Routen möglich sind.';
  if (km > 80) return 'Du näherst dich dem Tageslimit. Achte auf effiziente Routenwahl.';
  if (km < avgTeam * 0.7) return 'Deine Strecke ist kurz — gute Effizienz! Weiter so.';
  return 'Dein Kilometerstand ist im normalen Bereich. Gute Arbeit!';
}

export function FahrerPhase2261MeinKilometerstand({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!locationId || !driverId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/fahrer-kilometerstand?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!json) { setData(null); return; }
        const me = (json.fahrer ?? []).find((f: { fahrer_id: string }) => f.fahrer_id === driverId) ?? null;
        setData({ fahrer: me, team_avg_km_tour: json.team_avg_km_tour, team_gesamt_km: json.team_gesamt_km });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId, driverId]);

  useEffect(() => {
    if (!isOnline) return;
    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [load, isOnline]);

  const tipp = useMemo(
    () => data?.fahrer ? coachingTipp(data.fahrer.gesamt_km, data.team_avg_km_tour) : null,
    [data],
  );

  if (!isOnline || (!loading && !data)) return null;

  const f = data?.fahrer;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Mein Kilometerstand</span>
          {f && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${f.ampel === 'gruen' ? 'bg-green-100 text-green-700' : f.ampel === 'gelb' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
              {f.gesamt_km} km heute
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-3">
          {loading && <p className="text-xs text-muted-foreground">Lade Kilometerdaten…</p>}

          {!loading && f && (
            <>
              {/* Big KM Display */}
              <div className={`rounded-xl border p-3 text-center ${ampelBg(f.ampel)}`}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gesamt heute</div>
                <div className={`text-4xl font-black tabular-nums ${ampelColor(f.ampel)}`}>{f.gesamt_km}</div>
                <div className="text-xs font-bold text-muted-foreground">km</div>
              </div>

              {/* Progress bar toward 120 km limit */}
              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>0 km</span>
                  <span>Limit: 120 km</span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${f.ampel === 'gruen' ? 'bg-green-500' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, (f.gesamt_km / 120) * 100)}%` }}
                  />
                </div>
                <div className="mt-0.5 text-right text-[10px] font-bold text-muted-foreground">
                  {Math.round((f.gesamt_km / 120) * 100)}% des Tageslimits
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border bg-muted/30 p-2 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Trend</div>
                  <div className={`text-base font-black ${f.trend === 'steigend' ? 'text-red-500' : f.trend === 'fallend' ? 'text-green-500' : 'text-muted-foreground'}`}>
                    {trendIcon(f.trend)} {Math.abs(f.trend_delta)} km
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-2 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">⌀ km/Tour</div>
                  <div className="text-base font-black tabular-nums">{f.avg_km_tour}</div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-2 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Team ⌀</div>
                  <div className="text-base font-black tabular-nums">{data!.team_avg_km_tour}</div>
                </div>
              </div>

              <div className="rounded-lg border bg-blue-50 dark:bg-blue-900/20 px-3 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-0.5">Coaching</div>
                <p className="text-xs text-blue-800 dark:text-blue-200">{tipp}</p>
              </div>

              <p className="text-[10px] text-muted-foreground">
                Kosten-Schätzung: ~{f.kosten_schaetzung.toFixed(2)} € (à 0,30 €/km). Aktualisierung stündlich.
              </p>
            </>
          )}

          {!loading && !f && (
            <p className="text-xs text-muted-foreground text-center py-2">Noch keine km-Daten für heute.</p>
          )}
        </div>
      )}
    </div>
  );
}
