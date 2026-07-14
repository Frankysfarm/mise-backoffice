'use client';

import React, { useCallback, useEffect, useState } from 'react';

interface StatusUebergang {
  von: string;
  nach: string;
  label: string;
  avg_min: number;
  avg_min_gestern: number | null;
  trend: 'besser' | 'schlechter' | 'gleich';
  beobachtungen: number;
}

interface ApiData {
  uebergaenge: StatusUebergang[];
  gesamtzeit_avg_min: number;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
}

const MOCK: ApiData = {
  uebergaenge: [
    { von: 'neu', nach: 'in_zubereitung', label: 'Annahme → Zubereitung', avg_min: 2.1, avg_min_gestern: 2.5, trend: 'besser', beobachtungen: 38 },
    { von: 'in_zubereitung', nach: 'fertig', label: 'Zubereitung → Fertig', avg_min: 14.8, avg_min_gestern: 13.9, trend: 'schlechter', beobachtungen: 35 },
    { von: 'fertig', nach: 'unterwegs', label: 'Fertig → Abgeholt', avg_min: 3.4, avg_min_gestern: 3.4, trend: 'gleich', beobachtungen: 33 },
    { von: 'unterwegs', nach: 'geliefert', label: 'Unterwegs → Geliefert', avg_min: 18.2, avg_min_gestern: 19.1, trend: 'besser', beobachtungen: 31 },
  ],
  gesamtzeit_avg_min: 38.5,
  generiert_am: new Date().toISOString(),
};

const TREND_ICON: Record<string, { icon: string; color: string }> = {
  besser:      { icon: '↓', color: 'text-emerald-600' },
  schlechter:  { icon: '↑', color: 'text-red-600'     },
  gleich:      { icon: '→', color: 'text-stone-400'   },
};

function barWidth(avgMin: number, maxMin: number): number {
  return Math.min(100, (avgMin / maxMin) * 100);
}

function barColor(label: string): string {
  if (label.includes('Zubereitung → Fertig')) return 'bg-amber-400';
  if (label.includes('Unterwegs → Geliefert')) return 'bg-blue-500';
  if (label.includes('Fertig → Abgeholt')) return 'bg-orange-400';
  return 'bg-matcha-500';
}

export function DispatchPhase1619LieferstatusDurchlaufzeitWidget({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/lieferstatus-durchlaufzeit?location_id=${locationId}`);
      const json = await res.json();
      setData(json);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 15 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (!locationId) return null;

  const d = data ?? MOCK;
  const maxMin = Math.max(...d.uebergaenge.map((u) => u.avg_min), 1);

  // Find bottleneck (longest step)
  const engpass = d.uebergaenge.reduce((prev, cur) => cur.avg_min > prev.avg_min ? cur : prev, d.uebergaenge[0]);

  return (
    <div className="rounded-2xl border border-blue-200 bg-white overflow-hidden shadow-sm mb-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 bg-blue-700 text-white text-left"
      >
        <span className="text-sm font-bold uppercase tracking-wider flex-1">Status-Durchlaufzeit</span>
        <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">Ø {d.gesamtzeit_avg_min} Min</span>
        <span className="text-xs opacity-70">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {loading && !data && (
            <div className="h-24 flex items-center justify-center text-stone-400 text-sm">Lade…</div>
          )}

          {/* Engpass-Warnung */}
          {engpass && engpass.avg_min > 15 && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">
              ⚠ Engpass: <span className="font-black">{engpass.label}</span> dauert Ø {engpass.avg_min} Min
            </div>
          )}

          {/* Balken je Status-Übergang */}
          <div className="space-y-2.5">
            {d.uebergaenge.map((u) => {
              const t = TREND_ICON[u.trend];
              const w = barWidth(u.avg_min, maxMin);
              return (
                <div key={u.von}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-stone-600 font-medium truncate pr-2">{u.label}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-xs font-black tabular-nums ${t.color}`}>
                        {t.icon} {u.avg_min} Min
                      </span>
                      {u.avg_min_gestern !== null && (
                        <span className="text-[9px] text-stone-400">({u.avg_min_gestern})</span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor(u.label)}`}
                      style={{ width: `${w}%` }}
                    />
                  </div>
                  <div className="text-[9px] text-stone-400 mt-0.5">n={u.beobachtungen} Beobachtungen</div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 pt-1 border-t border-stone-100 text-xs text-stone-500">
            <span>Gesamt: <strong className="text-stone-800">{d.gesamtzeit_avg_min} Min</strong></span>
            <span className="text-stone-300">|</span>
            <span>Stand: {new Date(d.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      )}
    </div>
  );
}
