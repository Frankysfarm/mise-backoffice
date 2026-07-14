'use client';

import React, { useEffect, useState } from 'react';

interface StundeRow {
  stunde: number;
  bestellungen: number;
  is_peak: boolean;
  trend: 'steigend' | 'gleich' | 'fallend';
}

interface PrognoseRow {
  stunde: number;
  erwartet: number;
}

interface BestellzeitenData {
  stunden: StundeRow[];
  peak_stunden: number[];
  prognose_naechste_3h: PrognoseRow[];
  gesamt_30_tage: number;
}

interface Props {
  locationId: string | null;
}

function fmt(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

export function DispatchPhase1604BeliebteBestezeitenWidget({ locationId }: Props) {
  const [data, setData] = useState<BestellzeitenData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const [nowHour, setNowHour] = useState<number>(new Date().getHours());

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const loc = locationId ?? '';
        const res = await fetch(
          `/api/delivery/admin/beliebte-bestellzeiten${loc ? `?location_id=${loc}` : ''}`,
        );
        if (res.ok) {
          const json = await res.json() as BestellzeitenData;
          setData(json);
          setNowHour(new Date().getHours());
        }
      } catch {
        // API-Mock-Fallback
      } finally {
        setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 30 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!open) return null;

  const stunden = data?.stunden ?? [];
  const maxBestellungen = Math.max(...stunden.map((s) => s.bestellungen), 1);

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white overflow-hidden mb-4 shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 bg-matcha-700 text-white">
        <span className="text-sm font-bold uppercase tracking-wider flex-1">Beliebte Bestellzeiten</span>
        {loading && <span className="text-white/60 text-xs animate-pulse">…</span>}
        {data && (
          <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">
            {data.peak_stunden.length} Peak-Stunden
          </span>
        )}
        <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white text-lg leading-none">
          ×
        </button>
      </div>

      {!data ? (
        <div className="p-4 text-sm text-gray-400 text-center">Lade Bestellzeiten…</div>
      ) : (
        <div className="p-4 space-y-4">
          {/* 24h Heatmap */}
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
              24h-Heatmap (letzte 30 Tage)
            </div>
            <div className="flex gap-0.5 items-end h-14">
              {stunden.map((s) => {
                const height = Math.max(4, Math.round((s.bestellungen / maxBestellungen) * 100));
                const isCurrent = s.stunde === nowHour;
                return (
                  <div
                    key={s.stunde}
                    className="flex-1 flex flex-col items-center gap-0.5"
                    title={`${fmt(s.stunde)}: ${s.bestellungen} Bestellungen`}
                  >
                    <div
                      className={`w-full rounded-sm transition-all ${
                        isCurrent
                          ? 'bg-blue-500'
                          : s.is_peak
                          ? 'bg-rose-400'
                          : 'bg-matcha-300'
                      }`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>23:00</span>
            </div>
            <div className="flex gap-3 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-rose-400 inline-block" /> Peak
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Jetzt
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-matcha-300 inline-block" /> Normal
              </span>
            </div>
          </div>

          {/* Prognose nächste 3h */}
          {data.prognose_naechste_3h.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                Prognose nächste 3 Stunden
              </div>
              <div className="flex gap-2">
                {data.prognose_naechste_3h.map((p) => (
                  <div
                    key={p.stunde}
                    className="flex-1 bg-gray-50 rounded-xl p-2 text-center border border-gray-100"
                  >
                    <div className="text-xs text-gray-500">{fmt(p.stunde)}</div>
                    <div className="text-lg font-bold text-matcha-700">{p.erwartet}</div>
                    <div className="text-xs text-gray-400">erw.</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Peak-Stunden */}
          {data.peak_stunden.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.peak_stunden.map((h) => (
                <span key={h} className="text-xs bg-rose-100 text-rose-700 rounded-full px-2 py-0.5 font-medium">
                  {fmt(h)} Peak
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
