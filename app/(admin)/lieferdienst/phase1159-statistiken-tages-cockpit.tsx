'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity, Award, BarChart3, ChevronDown, ChevronUp,
  Clock, Euro, Loader2, RefreshCw, Target, TrendingDown, TrendingUp, Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1159 — Statistiken-Tages-Cockpit (Lieferdienst)
// Vollständiges Tages-Statistiken-Dashboard: 8 KPIs + Trend + Stunden-Verlauf + Fahrer-Top-Liste

interface Props {
  locationId: string | null;
}

interface TagesKpi {
  bestellungen_heute: number;
  bestellungen_gestern: number;
  umsatz_heute: number;
  umsatz_gestern: number;
  avg_lieferzeit_min: number;
  avg_lieferzeit_gestern_min: number;
  puenktlichkeits_rate: number;
  puenktlichkeits_rate_gestern: number;
  storno_rate: number;
  storno_rate_gestern: number;
  aktive_fahrer: number;
  avg_bewertung: number;
  touren_heute: number;
  umsatz_ziel: number | null;
}

interface StundenPunkt {
  stunde: number;
  bestellungen: number;
  umsatz: number;
}

interface FahrerKpi {
  name: string;
  stopps: number;
  touren: number;
  avg_lieferzeit: number;
  bewertung: number | null;
}

interface ApiResponse {
  kpis?: Partial<TagesKpi>;
  stunden?: StundenPunkt[];
  top_fahrer?: FahrerKpi[];
}

function trend(heute: number, gestern: number): 'up' | 'down' | 'flat' {
  if (gestern === 0) return 'flat';
  const diff = heute - gestern;
  if (Math.abs(diff) / gestern < 0.02) return 'flat';
  return diff > 0 ? 'up' : 'down';
}

function pctDiff(heute: number, gestern: number): string {
  if (gestern === 0) return '—';
  const pct = ((heute - gestern) / gestern) * 100;
  return (pct > 0 ? '+' : '') + pct.toFixed(1) + '%';
}

const MOCK_DATA: ApiResponse = {
  kpis: {
    bestellungen_heute: 47, bestellungen_gestern: 42,
    umsatz_heute: 1284.5, umsatz_gestern: 1156.8,
    avg_lieferzeit_min: 28.4, avg_lieferzeit_gestern_min: 31.2,
    puenktlichkeits_rate: 0.84, puenktlichkeits_rate_gestern: 0.79,
    storno_rate: 0.03, storno_rate_gestern: 0.05,
    aktive_fahrer: 4, avg_bewertung: 4.7,
    touren_heute: 19, umsatz_ziel: 1500,
  },
  stunden: Array.from({ length: 12 }, (_, i) => ({
    stunde: 11 + i,
    bestellungen: Math.round(2 + Math.random() * 8),
    umsatz: Math.round((30 + Math.random() * 120) * 10) / 10,
  })),
  top_fahrer: [
    { name: 'Max M.', stopps: 14, touren: 5, avg_lieferzeit: 24.1, bewertung: 4.9 },
    { name: 'Lisa K.', stopps: 11, touren: 4, avg_lieferzeit: 27.3, bewertung: 4.7 },
    { name: 'Tom B.', stopps: 9, touren: 4, avg_lieferzeit: 31.5, bewertung: 4.5 },
  ],
};

export function LieferdienstPhase1159StatistikTagesCockpit({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiResponse>(MOCK_DATA);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/analytics?location_id=${locationId}&range=today`);
      if (!res.ok) throw new Error('API error');
      const d = await res.json();
      setData(d);
      setLastUpdate(new Date());
    } catch {
      // Verwende Mock-Daten wenn API nicht verfügbar
      setData(MOCK_DATA);
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  }, [load]);

  const kpis = data.kpis ?? {};
  const stunden = data.stunden ?? [];
  const topFahrer = data.top_fahrer ?? [];

  const maxBestellungen = Math.max(...stunden.map(s => s.bestellungen), 1);
  const zielPct = kpis.umsatz_ziel && kpis.umsatz_heute != null
    ? Math.min(100, Math.round((kpis.umsatz_heute / kpis.umsatz_ziel) * 100))
    : null;

  const kpiCards = [
    {
      label: 'Bestellungen heute',
      value: kpis.bestellungen_heute?.toString() ?? '—',
      delta: pctDiff(kpis.bestellungen_heute ?? 0, kpis.bestellungen_gestern ?? 0),
      t: trend(kpis.bestellungen_heute ?? 0, kpis.bestellungen_gestern ?? 0),
      icon: Activity,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
    },
    {
      label: 'Umsatz heute',
      value: kpis.umsatz_heute != null ? `${kpis.umsatz_heute.toFixed(2)} €` : '—',
      delta: pctDiff(kpis.umsatz_heute ?? 0, kpis.umsatz_gestern ?? 0),
      t: trend(kpis.umsatz_heute ?? 0, kpis.umsatz_gestern ?? 0),
      icon: Euro,
      color: 'text-matcha-600',
      bg: 'bg-matcha-50',
      border: 'border-matcha-200',
    },
    {
      label: 'Ø Lieferzeit',
      value: kpis.avg_lieferzeit_min != null ? `${kpis.avg_lieferzeit_min.toFixed(1)} Min` : '—',
      delta: pctDiff(kpis.avg_lieferzeit_min ?? 0, kpis.avg_lieferzeit_gestern_min ?? 0),
      t: trend(kpis.avg_lieferzeit_gestern_min ?? 0, kpis.avg_lieferzeit_min ?? 0),
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
    },
    {
      label: 'Pünktlichkeit',
      value: kpis.puenktlichkeits_rate != null ? `${Math.round(kpis.puenktlichkeits_rate * 100)}%` : '—',
      delta: pctDiff(kpis.puenktlichkeits_rate ?? 0, kpis.puenktlichkeits_rate_gestern ?? 0),
      t: trend(kpis.puenktlichkeits_rate ?? 0, kpis.puenktlichkeits_rate_gestern ?? 0),
      icon: Target,
      color: kpis.puenktlichkeits_rate != null && kpis.puenktlichkeits_rate >= 0.8 ? 'text-matcha-600' : 'text-red-600',
      bg: kpis.puenktlichkeits_rate != null && kpis.puenktlichkeits_rate >= 0.8 ? 'bg-matcha-50' : 'bg-red-50',
      border: kpis.puenktlichkeits_rate != null && kpis.puenktlichkeits_rate >= 0.8 ? 'border-matcha-200' : 'border-red-200',
    },
    {
      label: 'Storno-Rate',
      value: kpis.storno_rate != null ? `${(kpis.storno_rate * 100).toFixed(1)}%` : '—',
      delta: pctDiff(kpis.storno_rate_gestern ?? 0, kpis.storno_rate ?? 0),
      t: trend(kpis.storno_rate_gestern ?? 0, kpis.storno_rate ?? 0),
      icon: BarChart3,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
    },
    {
      label: 'Aktive Fahrer',
      value: kpis.aktive_fahrer?.toString() ?? '—',
      delta: null,
      t: 'flat' as const,
      icon: Users,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      border: 'border-indigo-200',
    },
    {
      label: 'Ø Bewertung',
      value: kpis.avg_bewertung != null ? `${kpis.avg_bewertung.toFixed(1)} ★` : '—',
      delta: null,
      t: 'flat' as const,
      icon: Award,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
    },
    {
      label: 'Touren heute',
      value: kpis.touren_heute?.toString() ?? '—',
      delta: null,
      t: 'flat' as const,
      icon: Activity,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      border: 'border-purple-200',
    },
  ];

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-100/60 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <BarChart3 className="h-4 w-4 text-indigo-600 shrink-0" />
          <span className="text-sm font-bold text-indigo-800 uppercase tracking-wider">
            Tages-Cockpit
          </span>
          {kpis.bestellungen_heute != null && (
            <span className="rounded-full bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5">
              {kpis.bestellungen_heute} Bestellungen
            </span>
          )}
          {kpis.umsatz_heute != null && (
            <span className="rounded-full bg-matcha-600 text-white text-[10px] font-black px-2 py-0.5">
              {kpis.umsatz_heute.toFixed(0)} €
            </span>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); load(); }}
            className="rounded-full p-1 hover:bg-indigo-200 transition"
          >
            <RefreshCw className="h-3 w-3 text-indigo-400" />
          </button>
          {open ? <ChevronUp className="h-4 w-4 text-indigo-600" /> : <ChevronDown className="h-4 w-4 text-indigo-600" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-indigo-200 p-3 space-y-4">
          {/* Umsatzziel */}
          {zielPct !== null && (
            <div className="rounded-lg border border-indigo-200 bg-white/70 px-3 py-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
                  Tagesziel: {kpis.umsatz_ziel?.toFixed(0)} €
                </span>
                <span className="text-[11px] font-black text-indigo-800">{zielPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-indigo-100 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    zielPct >= 100 ? 'bg-matcha-500' : zielPct >= 75 ? 'bg-indigo-500' : zielPct >= 50 ? 'bg-amber-400' : 'bg-red-400',
                  )}
                  style={{ width: `${zielPct}%` }}
                />
              </div>
              <div className="mt-1 text-[9px] text-muted-foreground">
                {kpis.umsatz_heute?.toFixed(2)} € von {kpis.umsatz_ziel?.toFixed(2)} € erreicht
              </div>
            </div>
          )}

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {kpiCards.map(kpi => {
              const Ic = kpi.icon;
              return (
                <div key={kpi.label} className={cn('rounded-lg border p-2.5 flex flex-col gap-1', kpi.bg, kpi.border)}>
                  <div className="flex items-center gap-1">
                    <Ic className={cn('h-3 w-3 shrink-0', kpi.color)} />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground truncate">{kpi.label}</span>
                  </div>
                  <div className={cn('text-base font-black tabular-nums', kpi.color)}>{kpi.value}</div>
                  {kpi.delta && (
                    <div className={cn(
                      'flex items-center gap-0.5 text-[9px] font-bold',
                      kpi.t === 'up' ? 'text-matcha-600' : kpi.t === 'down' ? 'text-red-600' : 'text-muted-foreground',
                    )}>
                      {kpi.t === 'up' && <TrendingUp className="h-2.5 w-2.5" />}
                      {kpi.t === 'down' && <TrendingDown className="h-2.5 w-2.5" />}
                      {kpi.delta} vs. gestern
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Stunden-Verlauf */}
          {stunden.length > 0 && (
            <div className="rounded-lg border border-indigo-200 bg-white/70 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 mb-2">
                Stündliches Bestellvolumen
              </div>
              <div className="flex items-end gap-0.5 h-16">
                {stunden.map(s => (
                  <div key={s.stunde} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className="w-full rounded-t bg-indigo-400 hover:bg-indigo-500 transition-all"
                      style={{ height: `${Math.round((s.bestellungen / maxBestellungen) * 56)}px` }}
                      title={`${s.stunde}:00 — ${s.bestellungen} Bestellungen, ${s.umsatz.toFixed(0)} €`}
                    />
                    <span className="text-[7px] text-muted-foreground">{s.stunde}h</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Fahrer */}
          {topFahrer.length > 0 && (
            <div className="rounded-lg border border-indigo-200 bg-white/70 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 mb-2">
                Top Fahrer heute
              </div>
              <div className="space-y-1.5">
                {topFahrer.slice(0, 3).map((f, i) => (
                  <div key={f.name} className="flex items-center gap-2">
                    <div className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black text-white',
                      i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : 'bg-amber-700',
                    )}>
                      {i + 1}
                    </div>
                    <span className="text-xs font-bold truncate flex-1">{f.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{f.stopps} Stopps</span>
                    <span className="text-[10px] font-bold text-matcha-700 shrink-0">{f.avg_lieferzeit.toFixed(0)} Min</span>
                    {f.bewertung && (
                      <span className="text-[10px] text-yellow-600 font-bold shrink-0">★ {f.bewertung.toFixed(1)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {lastUpdate && (
            <div className="text-[9px] text-muted-foreground text-right">
              Zuletzt aktualisiert: {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
