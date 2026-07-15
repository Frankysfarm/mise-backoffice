'use client';

import React, { useCallback, useEffect, useState } from 'react';

// Uses the existing /api/delivery/admin/storno-analyse response shape
interface StornoHourBucket {
  hour: number;
  stornoCount: number;
  totalCount: number;
  stornoRate: number;
}

interface StornoZoneBucket {
  zone: string;
  stornoCount: number;
  totalCount: number;
  stornoRate: number;
}

interface StornoAnalyseData {
  totalOrders: number;
  totalStornos: number;
  overallRate: number;
  peakStornoHour: number | null;
  worstZone: string | null;
  byHour: StornoHourBucket[];
  byZone: StornoZoneBucket[];
}

interface ApiResponse {
  ok: boolean;
  data: StornoAnalyseData;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const MOCK_DATA: StornoAnalyseData = {
  totalOrders: 240,
  totalStornos: 18,
  overallRate: 7.5,
  peakStornoHour: 12,
  worstZone: 'Zone C',
  byHour: [
    { hour: 11, stornoCount: 1, totalCount: 22, stornoRate: 4.5 },
    { hour: 12, stornoCount: 6, totalCount: 58, stornoRate: 10.3 },
    { hour: 13, stornoCount: 4, totalCount: 45, stornoRate: 8.9 },
    { hour: 17, stornoCount: 2, totalCount: 30, stornoRate: 6.7 },
    { hour: 18, stornoCount: 3, totalCount: 42, stornoRate: 7.1 },
    { hour: 19, stornoCount: 2, totalCount: 43, stornoRate: 4.7 },
  ],
  byZone: [
    { zone: 'Zone A', stornoCount: 4, totalCount: 80, stornoRate: 5.0 },
    { zone: 'Zone B', stornoCount: 6, totalCount: 85, stornoRate: 7.1 },
    { zone: 'Zone C', stornoCount: 8, totalCount: 75, stornoRate: 10.7 },
  ],
};

const MOCK: ApiResponse = { ok: true, data: MOCK_DATA, generatedAt: new Date().toISOString() };

function rateColor(rate: number): string {
  if (rate >= 12) return 'bg-red-500';
  if (rate >= 7)  return 'bg-amber-400';
  return 'bg-emerald-500';
}

function rateTextColor(rate: number): string {
  if (rate >= 12) return 'text-red-700';
  if (rate >= 7)  return 'text-amber-600';
  return 'text-emerald-700';
}

export function DispatchPhase1624StornoAnalyseWidget({ locationId }: Props) {
  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/storno-analyse?location_id=${locationId}&days=30`);
      if (!res.ok) throw new Error('not ok');
      const json = await res.json();
      setApiData(json);
    } catch {
      setApiData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (!locationId) return null;

  const d = (apiData ?? MOCK).data;
  const activeHours = d.byHour.filter((h) => h.totalCount > 0);
  const maxHourRate = Math.max(...activeHours.map((h) => h.stornoRate), 1);
  const maxZoneRate = Math.max(...d.byZone.map((z) => z.stornoRate), 1);

  return (
    <div className="rounded-2xl border border-rose-200 bg-white overflow-hidden shadow-sm mb-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 bg-rose-700 text-white text-left"
      >
        <span className="text-sm font-bold uppercase tracking-wider flex-1">Storno-Analyse · 30 Tage</span>
        <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">
          {d.overallRate}% Stornoquote
        </span>
        <span className="text-xs opacity-70">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {loading && !apiData && (
            <div className="h-16 flex items-center justify-center text-stone-400 text-sm">Lade…</div>
          )}

          {/* Gesamt-KPIs */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-stone-50 border border-stone-100 p-3 text-center">
              <div className="text-xl font-black tabular-nums text-stone-800">{d.totalOrders}</div>
              <div className="text-[9px] font-semibold text-stone-500 mt-0.5">Bestellungen</div>
            </div>
            <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-center">
              <div className={`text-xl font-black tabular-nums ${rateTextColor(d.overallRate)}`}>{d.totalStornos}</div>
              <div className="text-[9px] font-semibold text-stone-500 mt-0.5">Stornos</div>
            </div>
            <div className={`rounded-xl border p-3 text-center ${d.overallRate >= 10 ? 'bg-red-50 border-red-200' : d.overallRate >= 6 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <div className={`text-xl font-black tabular-nums ${rateTextColor(d.overallRate)}`}>{d.overallRate}%</div>
              <div className="text-[9px] font-semibold text-stone-500 mt-0.5">Stornoquote</div>
            </div>
          </div>

          {/* Worst info */}
          {(d.peakStornoHour !== null || d.worstZone) && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 flex items-center gap-3 flex-wrap">
              {d.peakStornoHour !== null && (
                <span>⏰ Peak: <strong>{d.peakStornoHour}–{d.peakStornoHour + 1} Uhr</strong></span>
              )}
              {d.worstZone && (
                <span>📍 Problemzone: <strong>{d.worstZone}</strong></span>
              )}
            </div>
          )}

          {/* Uhrzeit-Cluster */}
          {activeHours.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">Storno-Uhrzeit-Cluster</div>
              <div className="space-y-1.5">
                {activeHours.map((h) => (
                  <div key={h.hour} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-[10px] text-stone-500 tabular-nums">{h.hour}–{h.hour + 1} Uhr</span>
                    <div className="flex-1 h-2 rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${rateColor(h.stornoRate)}`}
                        style={{ width: `${(h.stornoRate / maxHourRate) * 100}%` }}
                      />
                    </div>
                    <span className={`w-12 shrink-0 text-right text-[10px] font-black tabular-nums ${rateTextColor(h.stornoRate)}`}>
                      {h.stornoRate}%
                    </span>
                    <span className="w-10 shrink-0 text-right text-[9px] text-stone-400 tabular-nums">
                      {h.stornoCount}/{h.totalCount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Zone-Balken-Chart */}
          {d.byZone.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">Stornoquote je Zone</div>
              <div className="space-y-1.5">
                {d.byZone.map((z) => (
                  <div key={z.zone} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-[10px] font-semibold text-stone-600 truncate">{z.zone}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${rateColor(z.stornoRate)}`}
                        style={{ width: `${(z.stornoRate / maxZoneRate) * 100}%` }}
                      />
                    </div>
                    <span className={`w-12 shrink-0 text-right text-[10px] font-black tabular-nums ${rateTextColor(z.stornoRate)}`}>
                      {z.stornoRate}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-[9px] text-stone-400">
            Stand: {new Date((apiData ?? MOCK).generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · Aktualisierung alle 30 Min
          </div>
        </div>
      )}
    </div>
  );
}
