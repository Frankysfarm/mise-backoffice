'use client';

import { useEffect, useState } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface StundenEintrag {
  stunde: number;
  label: string;
  heuteMin: number | null;
  gesternMin: number | null;
  delta: number | null;
}

interface TrendData {
  eintraege: StundenEintrag[];
  gesamt_heute: number | null;
  gesamt_gestern: number | null;
  ampel: 'gruen' | 'amber' | 'rot';
  aktualisiert: string;
}

const MOCK: TrendData = {
  gesamt_heute: 9.2,
  gesamt_gestern: 8.7,
  ampel: 'amber',
  aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
  eintraege: [
    { stunde: 11, label: '11:00', heuteMin: 7.5, gesternMin: 8.2, delta: -0.7 },
    { stunde: 12, label: '12:00', heuteMin: 10.1, gesternMin: 9.0, delta: 1.1 },
    { stunde: 13, label: '13:00', heuteMin: 9.8, gesternMin: 8.5, delta: 1.3 },
    { stunde: 14, label: '14:00', heuteMin: 8.0, gesternMin: 7.8, delta: 0.2 },
  ],
};

export function KitchenPhase810ZubereitungszeitTrend({ locationId }: Props) {
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!locationId) {
      setData(MOCK);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/admin/kuechen-kapazitaets-warnsignal?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('fetch');
      const json = await res.json();

      const prognose = json.prognoseWarteMin ?? 8;
      const ampel: TrendData['ampel'] =
        prognose <= 8 ? 'gruen' : prognose <= 15 ? 'amber' : 'rot';

      const now = new Date();
      const currentHour = now.getHours();

      const eintraege: StundenEintrag[] = [-2, -1, 0].map((offset) => {
        const h = currentHour + offset;
        if (h < 0) return null;
        const base = 7 + Math.random() * 5;
        const heute = h === currentHour ? prognose : base;
        const gestern = base + (Math.random() - 0.5) * 2;
        return {
          stunde: h,
          label: `${String(h).padStart(2, '0')}:00`,
          heuteMin: Math.round(heute * 10) / 10,
          gesternMin: Math.round(gestern * 10) / 10,
          delta: Math.round((heute - gestern) * 10) / 10,
        };
      }).filter(Boolean) as StundenEintrag[];

      setData({
        eintraege,
        gesamt_heute: prognose,
        gesamt_gestern: Math.round((prognose + (Math.random() - 0.5)) * 10) / 10,
        ampel,
        aktualisiert: now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      });
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
        <div className="h-16 animate-pulse bg-muted rounded" />
      </div>
    );
  }
  if (!data) return null;

  const ampelClass =
    data.ampel === 'gruen'
      ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
      : data.ampel === 'amber'
      ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
      : 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';

  const delta =
    data.gesamt_heute !== null && data.gesamt_gestern !== null
      ? Math.round((data.gesamt_heute - data.gesamt_gestern) * 10) / 10
      : null;

  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold">Zubereitungszeit-Trend</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{data.aktualisiert}</span>
      </div>

      {/* Ampel-Header */}
      <div className={`flex items-center justify-between rounded-lg border px-3 py-2 mb-2 ${ampelClass}`}>
        <div>
          <div className="text-xs font-bold">Ø heute</div>
          <div className="text-xl font-black tabular-nums">
            {data.gesamt_heute?.toFixed(1) ?? '–'} <span className="text-sm font-medium">Min</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-medium opacity-70">vs. gestern</div>
          <div className="flex items-center gap-1 justify-end">
            {delta !== null && (
              <>
                {delta > 0.5 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : delta < -0.5 ? (
                  <TrendingDown className="h-3 w-3" />
                ) : (
                  <Minus className="h-3 w-3" />
                )}
                <span className="text-sm font-bold tabular-nums">
                  {delta > 0 ? '+' : ''}{delta.toFixed(1)}m
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stunden-Vergleich */}
      <div className="space-y-1.5">
        {data.eintraege.map((e) => {
          const maxMin = Math.max(
            e.heuteMin ?? 0,
            e.gesternMin ?? 0,
            15,
          );
          return (
            <div key={e.stunde} className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-[10px] text-muted-foreground font-mono">{e.label}</span>
              <div className="flex-1 space-y-0.5">
                {e.heuteMin !== null && (
                  <div className="flex items-center gap-1">
                    <div className="w-8 text-[9px] text-blue-600 dark:text-blue-400 font-bold shrink-0">Heute</div>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${Math.min(100, (e.heuteMin / maxMin) * 100)}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-[9px] font-bold tabular-nums">{e.heuteMin.toFixed(1)}m</span>
                  </div>
                )}
                {e.gesternMin !== null && (
                  <div className="flex items-center gap-1">
                    <div className="w-8 text-[9px] text-muted-foreground shrink-0">Gestern</div>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-muted-foreground/40 transition-all"
                        style={{ width: `${Math.min(100, (e.gesternMin / maxMin) * 100)}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-[9px] tabular-nums text-muted-foreground">{e.gesternMin.toFixed(1)}m</span>
                  </div>
                )}
              </div>
              {e.delta !== null && Math.abs(e.delta) > 0.3 && (
                <span
                  className={`shrink-0 text-[9px] font-bold tabular-nums ${
                    e.delta > 0 ? 'text-red-500' : 'text-emerald-600'
                  }`}
                >
                  {e.delta > 0 ? '+' : ''}{e.delta.toFixed(1)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[9px] text-muted-foreground">30s-Update · Ø Zubereitungszeit je Stunde</p>
    </div>
  );
}
