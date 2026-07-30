'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, AlertTriangle, CheckCircle2, Zap, ChefHat, Flame, Clock, BarChart2, TrendingUp, RefreshCw } from 'lucide-react';

/**
 * Phase 4500 — Smart-Timing V8 Farbkodierung-Countdown Ultra
 *
 * 5-stufige Ampel: grün / hellgrün / gelb / orange / rot
 * Echtzeit-Countdown je aktiver Bestellung (1-Sek-Tick)
 * Stationsübersicht + Kochstart-Empfehlung + Schicht-Score
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

interface StationSummary {
  name: string;
  aktiv: number;
  wartend: number;
  auslastung_pct: number;
}

interface ApiData {
  timing_score: number;
  on_time_pct: number;
  avg_prep_min: number;
  ziel_prep_min: number;
  ueberfaellig: number;
  fahrer_wartet_anzahl: number;
  bestellungen: OrderRow[];
  stationen: StationSummary[];
  schicht_delta_pct: number;
}

const MOCK: ApiData = {
  timing_score: 89,
  on_time_pct: 93,
  avg_prep_min: 13,
  ziel_prep_min: 17,
  ueberfaellig: 1,
  fahrer_wartet_anzahl: 1,
  schicht_delta_pct: 4,
  stationen: [
    { name: 'Pizza',  aktiv: 2, wartend: 1, auslastung_pct: 80 },
    { name: 'Grill',  aktiv: 1, wartend: 0, auslastung_pct: 55 },
    { name: 'Pasta',  aktiv: 1, wartend: 1, auslastung_pct: 45 },
    { name: 'Salat',  aktiv: 0, wartend: 2, auslastung_pct: 20 },
    { name: 'Dessert',aktiv: 0, wartend: 0, auslastung_pct: 0  },
  ],
  bestellungen: [
    { order_id: 'o1', bestellnummer: '0081', kunde_name: 'K. Schmidt',  status: 'in_zubereitung', remaining_sec: 900,  fahrer_wartet: false, ampel: 'gruen',     station: 'Pizza',  artikel_anzahl: 3, kochstart_empfehlung_min: null },
    { order_id: 'o2', bestellnummer: '0082', kunde_name: 'A. Müller',   status: 'in_zubereitung', remaining_sec: 420,  fahrer_wartet: false, ampel: 'hellgruen', station: 'Pizza',  artikel_anzahl: 2, kochstart_empfehlung_min: null },
    { order_id: 'o3', bestellnummer: '0083', kunde_name: 'B. Weber',    status: 'in_zubereitung', remaining_sec: 195,  fahrer_wartet: false, ampel: 'gelb',      station: 'Grill',  artikel_anzahl: 4, kochstart_empfehlung_min: null },
    { order_id: 'o4', bestellnummer: '0084', kunde_name: 'T. Bauer',    status: 'in_zubereitung', remaining_sec: 60,   fahrer_wartet: true,  ampel: 'orange',    station: 'Grill',  artikel_anzahl: 2, kochstart_empfehlung_min: null },
    { order_id: 'o5', bestellnummer: '0080', kunde_name: 'S. Fischer',  status: 'fertig',          remaining_sec: -240, fahrer_wartet: true,  ampel: 'rot',       station: 'Pasta',  artikel_anzahl: 3, kochstart_empfehlung_min: null },
    { order_id: 'o6', bestellnummer: '0085', kunde_name: 'M. Wagner',   status: 'wartend',         remaining_sec: 1500, fahrer_wartet: false, ampel: 'gruen',     station: 'Salat',  artikel_anzahl: 1, kochstart_empfehlung_min: 8   },
    { order_id: 'o7', bestellnummer: '0086', kunde_name: 'R. Klein',    status: 'wartend',         remaining_sec: 1200, fahrer_wartet: false, ampel: 'gruen',     station: 'Dessert',artikel_anzahl: 2, kochstart_empfehlung_min: 12  },
  ],
};

const AMPEL_CONFIG: Record<Ampel5, { dot: string; bg: string; text: string; bar: string; border: string; label: string }> = {
  gruen:     { dot: 'bg-green-500',       bg: 'bg-green-50 dark:bg-green-950',         text: 'text-green-700 dark:text-green-300',       bar: 'bg-green-500',   border: 'border-green-200 dark:border-green-800',  label: '>7m'   },
  hellgruen: { dot: 'bg-emerald-400',     bg: 'bg-emerald-50 dark:bg-emerald-950',     text: 'text-emerald-700 dark:text-emerald-300',   bar: 'bg-emerald-400', border: 'border-emerald-200 dark:border-emerald-800', label: '5–7m' },
  gelb:      { dot: 'bg-yellow-400',      bg: 'bg-yellow-50 dark:bg-yellow-950',       text: 'text-yellow-700 dark:text-yellow-300',     bar: 'bg-yellow-400',  border: 'border-yellow-200 dark:border-yellow-800', label: '2–5m'  },
  orange:    { dot: 'bg-orange-500',      bg: 'bg-orange-50 dark:bg-orange-950',       text: 'text-orange-700 dark:text-orange-300',     bar: 'bg-orange-500',  border: 'border-orange-300 dark:border-orange-700', label: '0–2m'  },
  rot:       { dot: 'bg-red-500 animate-pulse', bg: 'bg-red-50 dark:bg-red-950',       text: 'text-red-700 dark:text-red-300',           bar: 'bg-red-500',     border: 'border-red-300 dark:border-red-700',       label: 'Übf.'  },
};

function calcAmpel(sec: number): Ampel5 {
  if (sec < 0)   return 'rot';
  if (sec < 120) return 'orange';
  if (sec < 300) return 'gelb';
  if (sec < 420) return 'hellgruen';
  return 'gruen';
}

function fmtSec(sec: number): string {
  if (sec <= 0) return `+${Math.ceil(Math.abs(sec) / 60)}m`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 85 ? 'text-green-600' : score >= 70 ? 'text-yellow-600' : 'text-red-600';
  return (
    <div className="flex flex-col items-center">
      <div className={`text-3xl font-bold tabular-nums ${color}`}>{score}</div>
      <div className="text-xs text-muted-foreground mt-0.5">Timing-Score</div>
    </div>
  );
}

export function KitchenPhase4500SmartTimingV8FarbkodierungCountdown({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [ticks, setTicks] = useState<Map<string, number>>(new Map());
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [useMock, setUseMock] = useState(true);

  const fetchData = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/kitchen/smart-timing?location_id=${locationId}`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error('API error');
      const d = await res.json();
      if (d?.bestellungen) {
        setData(d);
        setUseMock(false);
        setTicks(new Map(d.bestellungen.map((o: OrderRow) => [o.order_id, o.remaining_sec])));
        setLastUpdate(new Date());
      }
    } catch {
      setUseMock(true);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (!locationId) return;
    const iv = setInterval(fetchData, 15_000);
    return () => clearInterval(iv);
  }, [fetchData, locationId]);

  useEffect(() => {
    if (useMock) {
      setTicks(new Map(MOCK.bestellungen.map(o => [o.order_id, o.remaining_sec])));
    }
  }, [useMock]);

  useEffect(() => {
    const t = setInterval(() => {
      setTicks(prev => {
        const next = new Map(prev);
        next.forEach((sec, id) => next.set(id, sec - 1));
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const orders = data.bestellungen;
  const active = orders.filter(o => o.status !== 'fertig' || (ticks.get(o.order_id) ?? o.remaining_sec) > -600);

  const ampelCounts: Record<Ampel5, number> = { gruen: 0, hellgruen: 0, gelb: 0, orange: 0, rot: 0 };
  active.forEach(o => {
    const sec = ticks.get(o.order_id) ?? o.remaining_sec;
    ampelCounts[calcAmpel(sec)]++;
  });

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-semibold">Smart-Timing V8</span>
          {useMock && (
            <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium">Demo</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {data.ueberfaellig > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
              <AlertTriangle className="h-3 w-3" />{data.ueberfaellig} überfällig
            </span>
          )}
          {data.fahrer_wartet_anzahl > 0 && (
            <span className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 font-medium">
              <Zap className="h-3 w-3" />{data.fahrer_wartet_anzahl} Fahrer wartet
            </span>
          )}
          <button onClick={fetchData} className="text-muted-foreground hover:text-foreground transition-colors" title="Aktualisieren">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <ScoreRing score={data.timing_score} />
        <div className="flex flex-col items-center">
          <div className="text-3xl font-bold tabular-nums text-blue-600 dark:text-blue-400">{data.on_time_pct}%</div>
          <div className="text-xs text-muted-foreground mt-0.5">Pünktlich</div>
        </div>
        <div className="flex flex-col items-center">
          <div className="text-3xl font-bold tabular-nums text-purple-600 dark:text-purple-400">{data.avg_prep_min}m</div>
          <div className="text-xs text-muted-foreground mt-0.5">Ø Prep-Zeit</div>
        </div>
        <div className="flex flex-col items-center">
          <div className={`text-3xl font-bold tabular-nums ${data.schicht_delta_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {data.schicht_delta_pct >= 0 ? '+' : ''}{data.schicht_delta_pct}%
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">vs. Ø Schicht</div>
        </div>
      </div>

      {/* Ampel-Legende */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(AMPEL_CONFIG) as [Ampel5, typeof AMPEL_CONFIG.gruen][]).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            <span className="text-xs text-muted-foreground">{cfg.label} ({ampelCounts[key]})</span>
          </div>
        ))}
      </div>

      {/* Stationen */}
      <div className="grid grid-cols-5 gap-1.5">
        {data.stationen.map(s => (
          <div key={s.name} className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-muted-foreground truncate">{s.name}</span>
              <span className="text-[10px] tabular-nums">{s.aktiv}+{s.wartend}</span>
            </div>
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${s.auslastung_pct >= 80 ? 'bg-red-500' : s.auslastung_pct >= 60 ? 'bg-orange-400' : 'bg-green-500'}`}
                style={{ width: `${s.auslastung_pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Countdown-Kacheln */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {active.map(o => {
          const sec = ticks.get(o.order_id) ?? o.remaining_sec;
          const ampel = calcAmpel(sec);
          const cfg = AMPEL_CONFIG[ampel];
          return (
            <div key={o.order_id} className={`rounded-lg border p-2.5 ${cfg.bg} ${cfg.border}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <span className="text-xs font-semibold">#{o.bestellnummer}</span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{o.kunde_name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {o.fahrer_wartet && <Zap className="h-3 w-3 text-orange-500" aria-label="Fahrer wartet" />}
                  <span className={`text-sm font-bold tabular-nums ${cfg.text}`}>{fmtSec(sec)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <ChefHat className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">{o.station} · {o.artikel_anzahl} Art.</span>
                </div>
                {o.kochstart_empfehlung_min !== null && (
                  <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-medium">
                    Kochen in {o.kochstart_empfehlung_min}m
                  </span>
                )}
                {o.status === 'fertig' && (
                  <span className="flex items-center gap-0.5 text-[10px] text-green-700 dark:text-green-300 font-medium">
                    <CheckCircle2 className="h-3 w-3" /> Fertig
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {active.length === 0 && (
        <div className="flex flex-col items-center py-6 text-muted-foreground gap-2">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
          <span className="text-sm">Keine aktiven Bestellungen</span>
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Ziel: {data.ziel_prep_min} min</span>
        <span>Aktualisiert: {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
      </div>
    </div>
  );
}
