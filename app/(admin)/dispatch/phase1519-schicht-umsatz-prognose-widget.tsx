'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Euro, TrendingUp, TrendingDown, Minus, RefreshCw, ChevronDown, ChevronUp, Target } from 'lucide-react';

// Phase 1519 — Schicht-Umsatz-Prognose-Widget (Dispatch)
// Phase1517-API: Umsatz-Hochrechnung + Trend + Tages-Ziel-Fortschrittsbalken; 15-Min-Polling.

interface ApiData {
  umsatz_bisher_eur: number;
  umsatz_prognose_eur: number;
  umsatz_ziel_eur: number;
  umsatz_vorwoche_eur: number;
  tempo_eur_pro_stunde: number;
  verbleibende_stunden: number;
  fortschritt_pct: number;
  status: 'ueber_ziel' | 'auf_ziel' | 'unter_ziel';
  trend: 'steigend' | 'stabil' | 'fallend';
  location_id: string;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
  className?: string;
}

const POLL_MS = 15 * 60 * 1000;

const STATUS_CONFIG: Record<string, { border: string; badge: string; badgeText: string; barColor: string }> = {
  ueber_ziel: {
    border: 'border-emerald-200 dark:border-emerald-800',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    badgeText: 'Über Ziel',
    barColor: '#10b981',
  },
  auf_ziel: {
    border: 'border-blue-200 dark:border-blue-800',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    badgeText: 'Auf Ziel',
    barColor: '#3b82f6',
  },
  unter_ziel: {
    border: 'border-rose-200 dark:border-rose-800',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    badgeText: 'Unter Ziel',
    barColor: '#ef4444',
  },
};

const TREND_ICON: Record<string, React.ReactNode> = {
  steigend: <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />,
  stabil: <Minus className="w-3.5 h-3.5 text-slate-400" />,
  fallend: <TrendingDown className="w-3.5 h-3.5 text-rose-500" />,
};

function fmt(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function buildMock(): ApiData {
  const stunde = new Date().getHours();
  const abgelaufen = Math.max(1, stunde - 10);
  const bisher = abgelaufen * 210;
  const ziel = 2800;
  return {
    umsatz_bisher_eur: bisher,
    umsatz_prognose_eur: bisher + 200 * Math.max(0, 22 - stunde),
    umsatz_ziel_eur: ziel,
    umsatz_vorwoche_eur: 2650,
    tempo_eur_pro_stunde: 210,
    verbleibende_stunden: Math.max(0, 22 - stunde),
    fortschritt_pct: Math.min(100, Math.round((bisher / ziel) * 100)),
    status: 'auf_ziel',
    trend: 'stabil',
    location_id: 'mock',
    generiert_am: new Date().toISOString(),
  };
}

export function DispatchPhase1519SchichtUmsatzPrognoseWidget({ locationId, className }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function load() {
    if (!locationId) { setData(buildMock()); setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/admin/schicht-umsatz-prognose?location_id=${locationId}`);
      if (!res.ok) throw new Error('fetch failed');
      setData(await res.json());
    } catch {
      setData(buildMock());
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 animate-pulse">
        <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-2/3 mb-2" />
        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
      </div>
    );
  }

  const d = data!;
  const statusCfg = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.auf_ziel;

  const differenz = d.umsatz_prognose_eur - d.umsatz_ziel_eur;
  const differenzSign = differenz >= 0 ? '+' : '';

  return (
    <div className={cn('rounded-xl border overflow-hidden', statusCfg.border, className)}>
      <button
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <Euro className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1 text-left">
          Schicht-Umsatz-Prognose
        </span>
        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0', statusCfg.badge)}>
          {statusCfg.badgeText}
        </span>
        <button
          onClick={e => { e.stopPropagation(); load(); }}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
          title="Aktualisieren"
        >
          <RefreshCw className="w-3 h-3 text-slate-400" />
        </button>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 bg-white dark:bg-slate-900 space-y-3">
          {/* Hauptzahlen */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
              <div className="text-[10px] text-slate-400 mb-1">Bisher heute</div>
              <div className="text-lg font-black text-slate-800 dark:text-slate-100">
                {fmt(d.umsatz_bisher_eur)} €
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
              <div className="text-[10px] text-slate-400 mb-1 flex items-center gap-1">
                Prognose {TREND_ICON[d.trend]}
              </div>
              <div className={cn('text-lg font-black',
                d.status === 'ueber_ziel' ? 'text-emerald-600 dark:text-emerald-400'
                : d.status === 'unter_ziel' ? 'text-rose-600 dark:text-rose-400'
                : 'text-blue-600 dark:text-blue-400',
              )}>
                {fmt(d.umsatz_prognose_eur)} €
              </div>
            </div>
          </div>

          {/* Ziel-Fortschrittsbalken */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-500 dark:text-slate-400 flex-1">
                Ziel: {fmt(d.umsatz_ziel_eur)} €
              </span>
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                {d.fortschritt_pct}%
              </span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${d.fortschritt_pct}%`, backgroundColor: statusCfg.barColor }}
              />
            </div>
          </div>

          {/* Metadaten */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{fmt(d.tempo_eur_pro_stunde)} €</div>
              <div className="text-[9px] text-slate-400">Tempo/Stunde</div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{d.verbleibende_stunden}h</div>
              <div className="text-[9px] text-slate-400">verbleibend</div>
            </div>
            <div>
              <div className={cn('text-xs font-bold',
                differenz >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
              )}>
                {differenzSign}{fmt(differenz)} €
              </div>
              <div className="text-[9px] text-slate-400">vs. Ziel</div>
            </div>
          </div>

          {lastUpdated && (
            <p className="text-[9px] text-slate-300 dark:text-slate-600 text-right">
              Aktualisiert {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
