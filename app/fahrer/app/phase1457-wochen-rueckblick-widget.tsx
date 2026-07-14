'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart2, TrendingUp, TrendingDown, Minus, Star, RefreshCw } from 'lucide-react';

// Phase 1457 — Wochen-Rückblick-Widget (Fahrer-App)
// Letzte 7 Tage: Stopps/Tag-Balken + Beste-Tag-Badge + Wochentrend-Pfeil
// isOnline-Guard; localStorage-Fallback; nach Phase1452

const STORAGE_KEY = 'fahrer_wochen_rueckblick';
const POLL_MS = 60 * 60 * 1000; // 1h

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

interface TagDaten {
  datum: string;     // YYYY-MM-DD
  wochentag: string; // Mo–So
  stopps: number;
  km: number;
  einnahmen_eur: number;
}

interface WochenRueckblickData {
  tage: TagDaten[];
  gesamt_stopps: number;
  gesamt_km: number;
  bester_tag_datum: string;
  bester_tag_stopps: number;
  trend: 'up' | 'down' | 'stable';
  avg_stopps_pro_tag: number;
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

function buildMock(driverId: string): WochenRueckblickData {
  const seed = driverId.charCodeAt(0) % 5;
  const heute = new Date();
  const tage: TagDaten[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(heute);
    d.setDate(d.getDate() - (6 - i));
    const dayOfWeek = d.getDay(); // 0=So
    const wt = WOCHENTAGE[(dayOfWeek + 6) % 7];
    const stopps = 4 + Math.floor(Math.abs(Math.sin((i + seed) * 1.3)) * 10);
    return {
      datum: d.toISOString().slice(0, 10),
      wochentag: wt,
      stopps,
      km: parseFloat((stopps * 2.3 + seed * 0.5).toFixed(1)),
      einnahmen_eur: parseFloat((stopps * 4.8 + seed).toFixed(2)),
    };
  });

  const besterTag = tage.reduce((best, t) => (t.stopps > best.stopps ? t : best), tage[0]);
  const erste3 = tage.slice(0, 3).reduce((s, t) => s + t.stopps, 0) / 3;
  const letzte3 = tage.slice(4).reduce((s, t) => s + t.stopps, 0) / 3;
  const trend: 'up' | 'down' | 'stable' = letzte3 > erste3 + 1 ? 'up' : letzte3 < erste3 - 1 ? 'down' : 'stable';

  return {
    tage,
    gesamt_stopps: tage.reduce((s, t) => s + t.stopps, 0),
    gesamt_km: parseFloat(tage.reduce((s, t) => s + t.km, 0).toFixed(1)),
    bester_tag_datum: besterTag.datum,
    bester_tag_stopps: besterTag.stopps,
    trend,
    avg_stopps_pro_tag: parseFloat((tage.reduce((s, t) => s + t.stopps, 0) / 7).toFixed(1)),
  };
}

function loadFromStorage(driverId: string): WochenRueckblickData | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${driverId}`);
    if (!raw) return null;
    return JSON.parse(raw) as WochenRueckblickData;
  } catch { return null; }
}

function saveToStorage(driverId: string, data: WochenRueckblickData): void {
  try { localStorage.setItem(`${STORAGE_KEY}_${driverId}`, JSON.stringify(data)); } catch {}
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up')   return <TrendingUp   className="w-4 h-4 text-emerald-500" />;
  if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-slate-400" />;
}

export function FahrerPhase1457WochenRueckblickWidget({ driverId, isOnline }: Props) {
  const [data, setData] = useState<WochenRueckblickData | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    if (!isOnline) return;
    setLoading(true);
    try {
      const res = await globalThis.fetch(`/api/driver-app/wochen-statistik?driver_id=${driverId}`);
      if (res.ok) {
        const json = await res.json() as WochenRueckblickData;
        setData(json);
        saveToStorage(driverId, json);
        return;
      }
    } catch { /* use storage */ } finally {
      setLoading(false);
    }
    const cached = loadFromStorage(driverId);
    if (cached) { setData(cached); return; }
    setData(buildMock(driverId));
  }, [driverId, isOnline]);

  useEffect(() => {
    const cached = loadFromStorage(driverId);
    if (cached) setData(cached); else setData(buildMock(driverId));
    fetchData();
    timerRef.current = setInterval(fetchData, POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [driverId, fetchData]);

  if (!data) return null;
  if (!isOnline) return null;

  const maxStopps = Math.max(...data.tage.map(t => t.stopps), 1);
  const heute = new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <BarChart2 className="w-4 h-4 text-violet-500 shrink-0" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1">
          Wochen-Rückblick
        </span>
        <TrendIcon trend={data.trend} />
        <button onClick={fetchData} aria-label="Aktualisieren" className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
          <RefreshCw className={cn('w-3 h-3 text-slate-400', loading && 'animate-spin')} />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 px-4 pt-3 pb-2">
        <div className="text-center">
          <p className="text-xl font-black tabular-nums text-slate-800 dark:text-slate-100">{data.gesamt_stopps}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Stopps</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-black tabular-nums text-slate-800 dark:text-slate-100">{data.avg_stopps_pro_tag.toFixed(1)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Ø / Tag</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-black tabular-nums text-slate-800 dark:text-slate-100">{data.gesamt_km}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">km</p>
        </div>
      </div>

      {/* Balken-Diagramm */}
      <div className="px-4 pb-2">
        <div className="flex items-end gap-1 h-20">
          {data.tage.map(t => {
            const h = maxStopps > 0 ? Math.round((t.stopps / maxStopps) * 100) : 0;
            const isBest    = t.datum === data.bester_tag_datum;
            const isHeute   = t.datum === heute;
            const barColor  = isBest    ? 'bg-amber-400 dark:bg-amber-500' :
                              isHeute   ? 'bg-violet-400 dark:bg-violet-500' :
                                         'bg-slate-300 dark:bg-slate-600';
            return (
              <div key={t.datum} className="flex-1 flex flex-col items-center gap-0.5">
                {isBest && <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400 shrink-0" />}
                <div className="w-full flex items-end" style={{ height: '60px' }}>
                  <div
                    className={cn('w-full rounded-t-sm transition-all duration-500', barColor)}
                    style={{ height: `${h}%` }}
                    title={`${t.stopps} Stopps`}
                  />
                </div>
                <span className={cn('text-[9px] tabular-nums', isHeute ? 'text-violet-500 font-bold' : 'text-slate-400')}>
                  {t.wochentag}
                </span>
                <span className="text-[9px] tabular-nums text-slate-500 font-semibold">{t.stopps}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bester-Tag-Badge */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-1.5">
          <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
            Bester Tag: {data.bester_tag_stopps} Stopps
          </span>
          <span className="text-[10px] text-amber-500 ml-auto">
            {new Date(data.bester_tag_datum + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
}
