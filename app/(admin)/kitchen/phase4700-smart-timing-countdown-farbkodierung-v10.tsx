'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, AlertTriangle, CheckCircle2, Zap, ChefHat, Flame, Clock, BarChart2, TrendingUp, RefreshCw } from 'lucide-react';

/**
 * Phase 4700 — Smart-Timing Countdown Farbkodierung V10
 *
 * 5-stufige Ampel: grün / hellgrün / gelb / orange / rot
 * Echtzeit-Countdown je aktiver Bestellung (1-Sek-Tick)
 * Score-Header + 4-KPI-Strip + Stationsübersicht
 * 15-Sek-Polling; Mock-Fallback wenn API nicht erreichbar
 */

type Ampel5 = 'gruen' | 'hellgruen' | 'gelb' | 'orange' | 'rot';

interface OrderRow {
  order_id: string;
  bestellnummer: string;
  kunde_name: string;
  status: 'wartend' | 'in_zubereitung' | 'fertig';
  remaining_sec: number;
  fahrer_wartet: boolean;
  ampel: Ampel5;
  station: string;
  artikel_anzahl: number;
  kochstart_empfehlung_min: number | null;
}

interface ApiData {
  timing_score: number;
  on_time_pct: number;
  avg_prep_min: number;
  ziel_prep_min: number;
  ueberfaellig: number;
  fahrer_wartet_anzahl: number;
  bestellungen: OrderRow[];
  schicht_delta_pct: number;
  queue_tiefe: number;
}

const MOCK: ApiData = {
  timing_score: 91,
  on_time_pct: 94,
  avg_prep_min: 12,
  ziel_prep_min: 17,
  ueberfaellig: 1,
  fahrer_wartet_anzahl: 1,
  schicht_delta_pct: 5,
  queue_tiefe: 7,
  bestellungen: [
    { order_id: 'o1', bestellnummer: '0091', kunde_name: 'K. Schmidt',  status: 'in_zubereitung', remaining_sec: 840,  fahrer_wartet: false, ampel: 'gruen',     station: 'Pizza',   artikel_anzahl: 3, kochstart_empfehlung_min: null },
    { order_id: 'o2', bestellnummer: '0092', kunde_name: 'A. Müller',   status: 'in_zubereitung', remaining_sec: 390,  fahrer_wartet: false, ampel: 'hellgruen', station: 'Pizza',   artikel_anzahl: 2, kochstart_empfehlung_min: null },
    { order_id: 'o3', bestellnummer: '0093', kunde_name: 'B. Weber',    status: 'in_zubereitung', remaining_sec: 180,  fahrer_wartet: false, ampel: 'gelb',      station: 'Grill',   artikel_anzahl: 4, kochstart_empfehlung_min: null },
    { order_id: 'o4', bestellnummer: '0094', kunde_name: 'T. Bauer',    status: 'in_zubereitung', remaining_sec: 55,   fahrer_wartet: true,  ampel: 'orange',    station: 'Grill',   artikel_anzahl: 2, kochstart_empfehlung_min: null },
    { order_id: 'o5', bestellnummer: '0090', kunde_name: 'S. Fischer',  status: 'fertig',          remaining_sec: -180, fahrer_wartet: true,  ampel: 'rot',       station: 'Pasta',   artikel_anzahl: 3, kochstart_empfehlung_min: null },
    { order_id: 'o6', bestellnummer: '0095', kunde_name: 'M. Wagner',   status: 'wartend',         remaining_sec: 1440, fahrer_wartet: false, ampel: 'gruen',     station: 'Salat',   artikel_anzahl: 1, kochstart_empfehlung_min: 7   },
    { order_id: 'o7', bestellnummer: '0096', kunde_name: 'R. Klein',    status: 'wartend',         remaining_sec: 1080, fahrer_wartet: false, ampel: 'hellgruen', station: 'Dessert', artikel_anzahl: 2, kochstart_empfehlung_min: 11  },
  ],
};

const AMPEL: Record<Ampel5, { dot: string; bg: string; text: string; bar: string; border: string; label: string }> = {
  gruen:     { dot: 'bg-green-500',              bg: 'bg-green-50 dark:bg-green-950',     text: 'text-green-700 dark:text-green-300',     bar: 'bg-green-500',   border: 'border-green-200 dark:border-green-800',   label: '>7m'  },
  hellgruen: { dot: 'bg-emerald-400',            bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-400', border: 'border-emerald-200 dark:border-emerald-800', label: '5–7m' },
  gelb:      { dot: 'bg-yellow-400',             bg: 'bg-yellow-50 dark:bg-yellow-950',   text: 'text-yellow-700 dark:text-yellow-300',   bar: 'bg-yellow-400',  border: 'border-yellow-200 dark:border-yellow-800',  label: '2–5m' },
  orange:    { dot: 'bg-orange-500',             bg: 'bg-orange-50 dark:bg-orange-950',   text: 'text-orange-700 dark:text-orange-300',   bar: 'bg-orange-500',  border: 'border-orange-300 dark:border-orange-700',  label: '0–2m' },
  rot:       { dot: 'bg-red-500 animate-pulse',  bg: 'bg-red-50 dark:bg-red-950',         text: 'text-red-700 dark:text-red-300',         bar: 'bg-red-500',     border: 'border-red-300 dark:border-red-700',        label: 'Übf.' },
};

function fmtSec(s: number): string {
  if (s < 0) return `+${Math.abs(Math.ceil(s / 60))}m übf.`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function scoreColor(score: number): string {
  if (score >= 85) return 'text-green-600 dark:text-green-400';
  if (score >= 70) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

export function KitchenPhase4700SmartTimingCountdownFarbkodierungV10() {
  const [data, setData] = useState<ApiData>(MOCK);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/kitchen/smart-timing', { cache: 'no-store' });
      if (!res.ok) throw new Error('api-error');
      const json = await res.json();
      setData(json);
      setLastUpdate(new Date());
    } catch {
      // keep mock
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const iv = setInterval(fetchData, 15_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1_000);
    return () => clearInterval(iv);
  }, []);

  const bestellungen = data.bestellungen.map(b => ({
    ...b,
    remaining_sec: b.remaining_sec - tick,
    ampel: ampelStufe(b.remaining_sec - tick, b.status),
  }));

  function ampelStufe(sec: number, status: string): Ampel5 {
    if (status === 'fertig' && sec < 0) return 'rot';
    if (sec > 420) return 'gruen';
    if (sec > 300) return 'hellgruen';
    if (sec > 120) return 'gelb';
    if (sec > 0)   return 'orange';
    return 'rot';
  }

  const urgent = bestellungen.filter(b => b.ampel === 'rot' || b.ampel === 'orange');

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-indigo-600 dark:bg-indigo-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-white" />
          <span className="text-sm font-semibold text-white">Smart-Timing V10</span>
          <span className="text-xs text-indigo-200">Countdown · Farbkodierung</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${scoreColor(data.timing_score)}`}>{data.timing_score}</span>
          <span className="text-xs text-indigo-200">Score</span>
          <button
            onClick={() => { setLoading(true); fetchData(); }}
            className="ml-2 text-indigo-200 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {urgent.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950 border-b border-red-200 dark:border-red-800">
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 animate-pulse" />
          <span className="text-xs font-semibold text-red-700 dark:text-red-300">
            {urgent.length} Bestellung{urgent.length > 1 ? 'en' : ''} kritisch —{' '}
            {urgent.map(b => `#${b.bestellnummer}`).join(', ')}
          </span>
        </div>
      )}

      {/* 4-KPI-Strip */}
      <div className="grid grid-cols-4 divide-x divide-slate-100 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800">
        {[
          { label: 'Pünktlich',   value: `${data.on_time_pct}%`,      icon: CheckCircle2, ok: data.on_time_pct >= 85 },
          { label: 'Ø Prep',      value: `${data.avg_prep_min}m`,      icon: Clock,        ok: data.avg_prep_min <= data.ziel_prep_min },
          { label: 'Überfällig',  value: `${data.ueberfaellig}`,       icon: Flame,        ok: data.ueberfaellig === 0 },
          { label: 'Queue',       value: `${data.queue_tiefe}`,        icon: BarChart2,    ok: data.queue_tiefe <= 8 },
        ].map(({ label, value, icon: Icon, ok }) => (
          <div key={label} className="flex flex-col items-center py-2 gap-0.5">
            <Icon className={`w-3.5 h-3.5 ${ok ? 'text-green-500' : 'text-red-500'}`} />
            <span className={`text-base font-bold ${ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{value}</span>
            <span className="text-[10px] text-slate-400">{label}</span>
          </div>
        ))}
      </div>

      {/* Countdown-Kacheln */}
      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {bestellungen
          .sort((a, b) => a.remaining_sec - b.remaining_sec)
          .map(b => {
            const cfg = AMPEL[b.ampel];
            return (
              <div
                key={b.order_id}
                className={`rounded-lg border ${cfg.border} ${cfg.bg} px-3 py-2 flex items-center gap-3`}
              >
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${cfg.text}`}>#{b.bestellnummer}</span>
                    <span className="text-[10px] text-slate-500 truncate">{b.kunde_name}</span>
                    {b.fahrer_wartet && (
                      <span className="text-[9px] bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 px-1 rounded shrink-0">Fahrer wartet</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-400">{b.station}</span>
                    <span className="text-[10px] text-slate-400">·</span>
                    <span className="text-[10px] text-slate-400">{b.artikel_anzahl} Artikel</span>
                    {b.kochstart_empfehlung_min && (
                      <span className="text-[9px] bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300 px-1 rounded">
                        Kochstart in {b.kochstart_empfehlung_min}m
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-sm font-mono font-bold ${cfg.text}`}>{fmtSec(b.remaining_sec)}</span>
                  <div className="text-[9px] text-slate-400 uppercase tracking-wide">{cfg.label}</div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Ampel-Legende */}
      <div className="px-3 pb-3 flex items-center gap-3 flex-wrap">
        {(Object.entries(AMPEL) as [Ampel5, typeof AMPEL[Ampel5]][]).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${cfg.dot.replace(' animate-pulse', '')}`} />
            <span className="text-[10px] text-slate-400">{cfg.label}</span>
          </div>
        ))}
        <span className="ml-auto text-[10px] text-slate-300 dark:text-slate-600">
          {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
