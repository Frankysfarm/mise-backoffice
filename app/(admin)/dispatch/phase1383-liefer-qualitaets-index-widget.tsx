'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Award, BarChart2, RefreshCw, ShieldCheck, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

type QualityStatus = 'excellent' | 'gut' | 'mittel' | 'kritisch';

export interface LieferQualitaetsIndexData {
  index: number;
  trend_vs_7tage: number;
  status: QualityStatus;
  kpis: {
    puenktlichkeit_pct: number;
    kundenbewertung_avg: number;
    storno_rate_pct: number;
    vollstaendigkeit_pct: number;
  };
  location_id: string;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function parseLieferQualitaetsIndex(value: unknown, locationId: string): LieferQualitaetsIndexData | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const kpis = candidate.kpis;
  if (!kpis || typeof kpis !== 'object' || Array.isArray(kpis)) return null;
  const rawKpis = kpis as Record<string, unknown>;
  if (
    !isFiniteNumber(candidate.index) || candidate.index < 0 || candidate.index > 100 ||
    !isFiniteNumber(candidate.trend_vs_7tage) ||
    !['excellent', 'gut', 'mittel', 'kritisch'].includes(String(candidate.status)) ||
    candidate.location_id !== locationId ||
    typeof candidate.generiert_am !== 'string' || !Number.isFinite(Date.parse(candidate.generiert_am)) ||
    !isFiniteNumber(rawKpis.puenktlichkeit_pct) ||
    !isFiniteNumber(rawKpis.kundenbewertung_avg) ||
    !isFiniteNumber(rawKpis.storno_rate_pct) ||
    !isFiniteNumber(rawKpis.vollstaendigkeit_pct)
  ) return null;
  return candidate as unknown as LieferQualitaetsIndexData;
}

function indexLevel(score: number): { label: string; color: string; bg: string; border: string } {
  if (score >= 80) return { label: 'Sehr gut', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-200 dark:border-emerald-800' };
  if (score >= 60) return { label: 'Mittel', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-700' };
  return { label: 'Kritisch', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/20', border: 'border-red-200 dark:border-red-700' };
}

export function DispatchPhase1383LieferQualitaetsIndexWidget({ locationId }: Props) {
  const [data, setData] = useState<LieferQualitaetsIndexData | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!locationId) {
      setData(null);
      setUnavailable(false);
      return;
    }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setUnavailable(false);
    try {
      const response = await fetch(`/api/delivery/admin/liefer-qualitaets-index?location_id=${encodeURIComponent(locationId)}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`http-${response.status}`);
      const parsed = parseLieferQualitaetsIndex(await response.json(), locationId);
      if (!parsed) throw new Error('invalid-response-shape');
      setData(parsed);
    } catch (error) {
      if (controller.signal.aborted) return;
      setData(null);
      setUnavailable(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => { void load(); }, 10 * 60 * 1000);
    return () => {
      clearInterval(timer);
      requestRef.current?.abort();
    };
  }, [load]);

  if (!data) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/30">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Liefer-Qualitäts-Index</span>
          {loading && <RefreshCw className="ml-auto h-3.5 w-3.5 animate-spin text-slate-400" />}
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>{unavailable ? 'Aktuell nicht verfügbar.' : locationId ? 'Wird geladen …' : 'Standort auswählen.'}</span>
          {unavailable && <button type="button" onClick={() => { void load(); }} className="rounded border border-slate-300 px-2 py-1 font-medium hover:bg-white">Erneut versuchen</button>}
        </div>
      </div>
    );
  }

  const level = indexLevel(data.index);
  const metrics = [
    { label: 'Pünktlichkeit', value: `${data.kpis.puenktlichkeit_pct}%`, icon: <ShieldCheck className="h-3.5 w-3.5" /> },
    { label: 'Bewertung', value: data.kpis.kundenbewertung_avg.toFixed(1), icon: <Star className="h-3.5 w-3.5" /> },
    { label: 'Vollständig', value: `${data.kpis.vollstaendigkeit_pct}%`, icon: <Award className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className={cn('rounded-xl border p-4', level.border, level.bg)}>
      <div className="flex items-center gap-2">
        <BarChart2 className={cn('h-4 w-4', level.color)} />
        <span className={cn('text-sm font-semibold', level.color)}>Liefer-Qualitäts-Index</span>
        <span className={cn('ml-auto text-lg font-bold', level.color)}>{data.index}</span>
        <span className={cn('rounded-full bg-white/60 px-2 py-0.5 text-xs font-medium dark:bg-black/20', level.color)}>{level.label}</span>
        {loading && <RefreshCw className="h-3 w-3 animate-spin text-slate-400" />}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg border border-white/70 p-2 text-center dark:border-black/20">
            <div className={cn('flex items-center justify-center gap-1', level.color)}>{metric.icon}<span className="text-lg font-bold">{metric.value}</span></div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{metric.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">Trend gegenüber 7 Tagen: {data.trend_vs_7tage > 0 ? '+' : ''}{data.trend_vs_7tage} Punkte · Stornoquote {data.kpis.storno_rate_pct}%</div>
    </div>
  );
}
