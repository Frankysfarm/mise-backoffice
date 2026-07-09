'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Users, TrendingUp, TrendingDown, Minus, Loader2, Heart } from 'lucide-react';

/**
 * Phase 931 — Loyalitäts-Trend-Dashboard (Lieferdienst)
 *
 * Neue vs. wiederkehrende Kunden je Tag (14 Tage) + Wiederkehrrate + Trend.
 * 10-Min-Polling.
 */

interface Props {
  locationId: string | null;
}

interface TagData {
  datum: string;
  neu: number;
  wiederkehrend: number;
  gesamt: number;
  wiederkehr_pct: number;
}

interface LoyData {
  tage: TagData[];
  wiederkehr_rate_pct: number;
  trend_pct: number;
  gesamt_kunden: number;
  neue_kunden: number;
  generatedAt: string;
}

const POLL_MS = 10 * 60 * 1000;

function datumKurz(iso: string) {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric' });
}

function TrendBadge({ pct }: { pct: number }) {
  if (pct > 2) return (
    <span className="flex items-center gap-0.5 text-matcha-600 text-xs font-bold">
      <TrendingUp className="w-3 h-3" />+{pct}%
    </span>
  );
  if (pct < -2) return (
    <span className="flex items-center gap-0.5 text-red-600 text-xs font-bold">
      <TrendingDown className="w-3 h-3" />{pct}%
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-stone-400 text-xs">
      <Minus className="w-3 h-3" />stabil
    </span>
  );
}

export function LieferdienstPhase931LoyalitaetsTrend({ locationId }: Props) {
  const [data, setData] = useState<LoyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!locationId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/admin/kunden-loyalitaets-trend?location_id=${locationId}&tage=14`);
      if (res.ok) setData(await res.json());
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  const maxGesamt = data ? Math.max(...data.tage.map((t) => t.gesamt), 1) : 1;

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-rose-500" />
          <span className="text-sm font-semibold text-stone-800">Kunden-Loyalität (14 Tage)</span>
        </div>
        <div className="flex items-center gap-3">
          {data && <TrendBadge pct={data.trend_pct} />}
          {data && (
            <span className="text-xs font-bold text-stone-700">
              {data.wiederkehr_rate_pct}% Stammkunden
            </span>
          )}
          <span className="text-stone-400 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-stone-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />Lade…
            </div>
          )}

          {!loading && data && (
            <>
              {/* KPI-Zeile */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-center">
                  <div className="text-xl font-bold text-rose-700">{data.wiederkehr_rate_pct}%</div>
                  <div className="text-[11px] text-rose-600 font-medium">Wiederkehrrate</div>
                </div>
                <div className="rounded-lg border border-sky-100 bg-sky-50 p-3 text-center">
                  <div className="text-xl font-bold text-sky-700">{data.neue_kunden}</div>
                  <div className="text-[11px] text-sky-600 font-medium">Neukunden</div>
                </div>
                <div className="rounded-lg border border-matcha-100 bg-matcha-50 p-3 text-center">
                  <div className="text-xl font-bold text-matcha-700">{data.gesamt_kunden}</div>
                  <div className="text-[11px] text-matcha-600 font-medium">Gesamt</div>
                </div>
              </div>

              {/* Balkendiagramm: letzten 7 Tage */}
              <div>
                <div className="text-[11px] text-stone-500 font-medium mb-2">
                  Neu <span className="inline-block w-2 h-2 rounded-sm bg-sky-400 align-middle" /> vs. Stammkunden{' '}
                  <span className="inline-block w-2 h-2 rounded-sm bg-rose-400 align-middle" />
                </div>
                <div className="flex items-end gap-1 h-20">
                  {data.tage.slice(-7).map((t) => (
                    <div key={t.datum} className="flex-1 flex flex-col items-center gap-0.5">
                      <div className="w-full flex flex-col-reverse" style={{ height: '64px' }}>
                        <div
                          className="w-full bg-sky-400 rounded-t-sm"
                          style={{ height: `${maxGesamt > 0 ? (t.neu / maxGesamt) * 100 : 0}%` }}
                        />
                        <div
                          className="w-full bg-rose-400"
                          style={{ height: `${maxGesamt > 0 ? (t.wiederkehrend / maxGesamt) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-stone-400 truncate w-full text-center">
                        {datumKurz(t.datum)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trend-Hinweis */}
              <div className={cn(
                'rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-2',
                data.trend_pct > 5
                  ? 'bg-matcha-50 text-matcha-700 border border-matcha-200'
                  : data.trend_pct < -5
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-stone-50 text-stone-600 border border-stone-200',
              )}>
                <Users className="w-3 h-3 shrink-0" />
                {data.trend_pct > 5
                  ? `Kundenbindung steigt — ${data.trend_pct}% mehr Stammkunden als letzte Woche.`
                  : data.trend_pct < -5
                    ? `Rückgang: ${Math.abs(data.trend_pct)}% weniger Stammkunden als letzte Woche.`
                    : 'Kundenbindung stabil im Wochenvergleich.'}
              </div>
            </>
          )}

          {!loading && !data && (
            <div className="text-sm text-stone-400">Keine Daten verfügbar.</div>
          )}
        </div>
      )}
    </div>
  );
}
