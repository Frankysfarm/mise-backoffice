'use client';

import React, { useCallback, useEffect, useState } from 'react';

interface TourEffizienz {
  tour_id: string;
  tour_label: string;
  geplant_min: number;
  tatsaechlich_min: number;
  effizienzrate: number; // >1 = schneller, <1 = langsamer
  stopps: number;
  datum: string;
}

interface RoutenEffizienzData {
  touren: TourEffizienz[];
  avg_effizienzrate: number;
  beste_tour: string | null;
  schlechteste_tour: string | null;
}

interface Props {
  driverId: string | null;
  isOnline: boolean;
}

const MOCK: RoutenEffizienzData = {
  touren: [
    { tour_id: 't1', tour_label: 'Tour 1', geplant_min: 35, tatsaechlich_min: 31, effizienzrate: 1.13, stopps: 3, datum: new Date().toISOString() },
    { tour_id: 't2', tour_label: 'Tour 2', geplant_min: 40, tatsaechlich_min: 44, effizienzrate: 0.91, stopps: 4, datum: new Date().toISOString() },
    { tour_id: 't3', tour_label: 'Tour 3', geplant_min: 28, tatsaechlich_min: 27, effizienzrate: 1.04, stopps: 2, datum: new Date().toISOString() },
    { tour_id: 't4', tour_label: 'Tour 4', geplant_min: 45, tatsaechlich_min: 52, effizienzrate: 0.87, stopps: 5, datum: new Date().toISOString() },
    { tour_id: 't5', tour_label: 'Tour 5', geplant_min: 30, tatsaechlich_min: 29, effizienzrate: 1.03, stopps: 3, datum: new Date().toISOString() },
  ],
  avg_effizienzrate: 1.0,
  beste_tour: 'Tour 1',
  schlechteste_tour: 'Tour 4',
};

function ampelMeta(rate: number): { label: string; bg: string; text: string; border: string; bar: string; dot: string } {
  if (rate >= 1.05) return { label: 'Gut',       bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', bar: 'bg-emerald-500', dot: 'bg-emerald-500' };
  if (rate >= 0.92) return { label: 'Normal',    bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    bar: 'bg-blue-500',    dot: 'bg-blue-500'    };
  return               { label: 'Schlecht',    bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     bar: 'bg-red-500',     dot: 'bg-red-500'     };
}

function avgAmpel(rate: number): { label: string; color: string; bg: string } {
  if (rate >= 1.05) return { label: 'Überdurchschnittlich', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
  if (rate >= 0.92) return { label: 'Im Ziel',              color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200'       };
  return               { label: 'Verbesserungsbedarf',   color: 'text-red-700',     bg: 'bg-red-50 border-red-200'         };
}

export function FahrerPhase1625RoutenEffizienzKarte({ driverId, isOnline }: Props) {
  const [data, setData] = useState<RoutenEffizienzData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!driverId) return;
    try {
      const res = await fetch(`/api/delivery/driver/routen-effizienz?driver_id=${driverId}`);
      if (!res.ok) throw new Error('not ok');
      const json = await res.json();
      setData(json);
    } catch {
      setData(MOCK);
    }
  }, [driverId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!isOnline) return;
    const id = setInterval(load, 15 * 60_000);
    return () => clearInterval(id);
  }, [isOnline, load]);

  if (!isOnline || !driverId) return null;

  const d = data ?? MOCK;
  const avg = avgAmpel(d.avg_effizienzrate);

  return (
    <div className="rounded-2xl border border-blue-200 bg-white overflow-hidden shadow-sm mb-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 bg-blue-700 text-white text-left"
      >
        <span className="text-sm font-bold uppercase tracking-wider flex-1">Routen-Effizienz</span>
        <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">
          Ø {Math.round(d.avg_effizienzrate * 100)}%
        </span>
        <span className="text-xs opacity-70">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {/* Gesamt-Ampel */}
          <div className={`rounded-xl border px-3 py-2.5 flex items-center gap-3 ${avg.bg}`}>
            <div className="flex-1">
              <div className={`text-sm font-black ${avg.color}`}>{avg.label}</div>
              <div className="text-[10px] text-stone-500">Ø Effizienzrate letzter {d.touren.length} Touren</div>
            </div>
            <div className={`text-2xl font-black tabular-nums ${avg.color}`}>
              {Math.round(d.avg_effizienzrate * 100)}%
            </div>
          </div>

          {d.beste_tour || d.schlechteste_tour ? (
            <div className="flex gap-2 flex-wrap text-[10px]">
              {d.beste_tour && (
                <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 font-semibold">
                  ✓ Beste: {d.beste_tour}
                </span>
              )}
              {d.schlechteste_tour && (
                <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 font-semibold">
                  ↓ Schwach: {d.schlechteste_tour}
                </span>
              )}
            </div>
          ) : null}

          {/* Tour-Liste */}
          <div className="space-y-1.5">
            {d.touren.map((t) => {
              const m = ampelMeta(t.effizienzrate);
              const delta = t.tatsaechlich_min - t.geplant_min;
              return (
                <div key={t.tour_id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${m.bg} ${m.border}`}>
                  <span className={`h-2 w-2 rounded-full shrink-0 ${m.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-stone-800">{t.tour_label}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black ${m.text}`}>
                        {m.label}
                      </span>
                      <span className="text-[9px] text-stone-400">{t.stopps} Stopps</span>
                    </div>
                    <div className="text-[9px] text-stone-500 mt-0.5">
                      Geplant {t.geplant_min} Min · Tatsächlich {t.tatsaechlich_min} Min
                      {delta !== 0 && (
                        <span className={delta > 0 ? 'text-red-500' : 'text-emerald-600'}>
                          {' '}{delta > 0 ? '+' : ''}{delta} Min
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={`font-mono text-sm font-black tabular-nums ${m.text}`}>
                      {Math.round(t.effizienzrate * 100)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
