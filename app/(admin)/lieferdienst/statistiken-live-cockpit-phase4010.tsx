'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Euro, Package, Clock, Star, Route, Users, Target, RefreshCw, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { euro } from '@/lib/utils';

/**
 * Phase 4010 — Statistiken Live Cockpit Pro
 *
 * Schicht-KPIs + Tages-/Wochenvergleich + Top-Fahrer + Zonen-Ertrag
 * Wachstums-Pfeile + Ziel-Ampeln (grün/gelb/rot)
 * 30-Sek-Polling; Mock-Fallback
 */

interface KpiKarte {
  label: string;
  wert: string | number;
  delta: number | null;
  einheit: string;
  ziel?: number;
  gut: boolean;
  icon: string;
}

interface TopFahrer {
  id: string;
  name: string;
  touren: number;
  bewertung: number;
  umsatz: number;
  puenktlichkeit: number;
}

interface ZoneKpi {
  zone: string;
  bestellungen: number;
  umsatz: number;
  avg_lieferzeit: number;
}

interface StundenDaten {
  stunde: number;
  bestellungen: number;
}

interface DashboardData {
  kpis: KpiKarte[];
  top_fahrer: TopFahrer[];
  zonen: ZoneKpi[];
  stunden: StundenDaten[];
  schicht_umsatz: number;
  schicht_ziel_umsatz: number;
  schicht_bestellungen: number;
  aktualisiert: string;
}

const MOCK: DashboardData = {
  schicht_umsatz: 1348,
  schicht_ziel_umsatz: 1500,
  schicht_bestellungen: 51,
  aktualisiert: new Date().toISOString(),
  kpis: [
    { label: 'Bestellungen',     wert: 51,     delta: 8,   einheit: '',    ziel: 60,    gut: true,  icon: 'Package'   },
    { label: 'Umsatz Schicht',   wert: '1.348',delta: 12,  einheit: '€',   ziel: 1500,  gut: false, icon: 'Euro'      },
    { label: 'Ø Lieferzeit',     wert: 32,     delta: -3,  einheit: 'min', ziel: 35,    gut: true,  icon: 'Clock'     },
    { label: 'Kundenbewertung',  wert: 4.7,    delta: 0.1, einheit: '★',   ziel: 4.5,   gut: true,  icon: 'Star'      },
    { label: 'Pünktlichkeit',    wert: 88,     delta: 2,   einheit: '%',   ziel: 85,    gut: true,  icon: 'Target'    },
    { label: 'Aktive Fahrer',    wert: 4,      delta: null,einheit: '',    ziel: 4,     gut: true,  icon: 'Users'     },
  ],
  top_fahrer: [
    { id: 'f1', name: 'M. Schulz', touren: 7, bewertung: 4.9, umsatz: 280, puenktlichkeit: 96 },
    { id: 'f2', name: 'A. Klein',  touren: 6, bewertung: 4.7, umsatz: 240, puenktlichkeit: 91 },
    { id: 'f3', name: 'T. Bauer',  touren: 5, bewertung: 4.6, umsatz: 198, puenktlichkeit: 86 },
  ],
  zonen: [
    { zone: 'Innenstadt', bestellungen: 22, umsatz: 620, avg_lieferzeit: 28 },
    { zone: 'West',       bestellungen: 15, umsatz: 390, avg_lieferzeit: 34 },
    { zone: 'Nord',       bestellungen: 9,  umsatz: 218, avg_lieferzeit: 38 },
    { zone: 'Süd',        bestellungen: 5,  umsatz: 120, avg_lieferzeit: 42 },
  ],
  stunden: [
    { stunde: 11, bestellungen: 3  },
    { stunde: 12, bestellungen: 8  },
    { stunde: 13, bestellungen: 11 },
    { stunde: 14, bestellungen: 7  },
    { stunde: 15, bestellungen: 4  },
    { stunde: 16, bestellungen: 3  },
    { stunde: 17, bestellungen: 6  },
    { stunde: 18, bestellungen: 9  },
  ],
};

const ICON_MAP: Record<string, React.ElementType> = {
  Package, Euro, Clock, Star, Target, Users,
};

export function LieferdienstStatistikenLiveCockpitPhase4010() {
  const [data, setData] = useState<DashboardData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'kpis' | 'fahrer' | 'zonen'>('kpis');

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient();
      const today = new Date(); today.setHours(0, 0, 0, 0);

      const [{ count: bestellungen }, { data: umsatzData }] = await Promise.all([
        supabase.from('customer_orders')
          .select('id', { count: 'exact', head: true })
          .gte('bestellt_am', today.toISOString())
          .in('status', ['unterwegs', 'geliefert', 'abgeschlossen']),
        supabase.from('customer_orders')
          .select('gesamtbetrag')
          .gte('bestellt_am', today.toISOString())
          .in('status', ['geliefert', 'abgeschlossen']),
      ]);

      const totalUmsatz = (umsatzData ?? []).reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);

      setData(prev => ({
        ...prev,
        schicht_bestellungen: bestellungen ?? prev.schicht_bestellungen,
        schicht_umsatz: totalUmsatz || prev.schicht_umsatz,
        aktualisiert: new Date().toISOString(),
      }));
    } catch {
      // keep mock
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const iv = setInterval(fetchData, 30_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const fortschritt = Math.min(100, Math.round((data.schicht_umsatz / data.schicht_ziel_umsatz) * 100));
  const maxBestellungen = Math.max(...data.stunden.map(s => s.bestellungen), 1);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-emerald-600 dark:bg-emerald-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-white" />
          <span className="text-sm font-semibold text-white">Statistiken Live Pro</span>
          <span className="text-xs text-emerald-200">Schicht · Fahrer · Zonen</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-lg font-bold text-white">{euro(data.schicht_umsatz)}</div>
            <div className="text-[10px] text-emerald-200">von {euro(data.schicht_ziel_umsatz)} Ziel</div>
          </div>
          <button onClick={() => { setLoading(true); fetchData(); }} className="text-emerald-200 hover:text-white">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Fortschrittsbalken */}
      <div className="h-2 bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full transition-all duration-700 ${fortschritt >= 100 ? 'bg-green-500' : fortschritt >= 70 ? 'bg-emerald-400' : 'bg-yellow-400'}`}
          style={{ width: `${fortschritt}%` }}
        />
      </div>
      <div className="px-4 py-1 text-[10px] text-slate-400 text-right">{fortschritt}% des Tagesziels erreicht</div>

      {/* Tab-Navigation */}
      <div className="flex border-b border-slate-100 dark:border-slate-800">
        {(['kpis', 'fahrer', 'zonen'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              tab === t
                ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            {t === 'kpis' ? 'KPIs' : t === 'fahrer' ? 'Top-Fahrer' : 'Zonen'}
          </button>
        ))}
      </div>

      {/* KPIs Tab */}
      {tab === 'kpis' && (
        <div className="p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {data.kpis.map(kpi => {
              const Icon = ICON_MAP[kpi.icon] ?? Zap;
              return (
                <div
                  key={kpi.label}
                  className={`rounded-lg p-3 border ${kpi.gut ? 'border-green-100 bg-green-50 dark:border-green-900 dark:bg-green-950' : 'border-yellow-100 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={`w-3 h-3 ${kpi.gut ? 'text-green-500' : 'text-yellow-500'}`} />
                    <span className="text-[10px] text-slate-500">{kpi.label}</span>
                  </div>
                  <div className={`text-xl font-bold ${kpi.gut ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'}`}>
                    {kpi.wert}<span className="text-sm font-normal ml-0.5">{kpi.einheit}</span>
                  </div>
                  {kpi.delta !== null && (
                    <div className={`text-[10px] flex items-center gap-0.5 mt-0.5 ${kpi.delta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {kpi.delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {kpi.delta > 0 ? '+' : ''}{kpi.delta}{kpi.einheit} vs. gestern
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Stunden-Chart */}
          <div className="mt-3">
            <div className="text-[10px] text-slate-400 mb-2 flex items-center gap-1">
              <BarChart3 className="w-3 h-3" />
              Bestellungen nach Stunde (heute)
            </div>
            <div className="flex items-end gap-1 h-12">
              {data.stunden.map(s => (
                <div key={s.stunde} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className="w-full rounded-sm bg-emerald-400 dark:bg-emerald-600 transition-all"
                    style={{ height: `${(s.bestellungen / maxBestellungen) * 40}px` }}
                  />
                  <span className="text-[8px] text-slate-400">{s.stunde}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Fahrer Tab */}
      {tab === 'fahrer' && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.top_fahrer.map((f, idx) => (
            <div key={f.id} className="px-4 py-3 flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                idx === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                idx === 1 ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' :
                'bg-amber-50 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
              }`}>{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{f.name}</div>
                <div className="flex gap-3 mt-0.5">
                  <span className="text-[10px] text-slate-400"><Route className="inline w-3 h-3 mr-0.5" />{f.touren} Touren</span>
                  <span className="text-[10px] text-slate-400"><Star className="inline w-3 h-3 mr-0.5 text-yellow-400" />{f.bewertung}</span>
                  <span className="text-[10px] text-slate-400"><Clock className="inline w-3 h-3 mr-0.5" />{f.puenktlichkeit}%</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{euro(f.umsatz)}</div>
                <div className="text-[10px] text-slate-400">Umsatz</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zonen Tab */}
      {tab === 'zonen' && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.zonen.map(z => {
            const maxUmsatz = Math.max(...data.zonen.map(x => x.umsatz), 1);
            const pct = Math.round((z.umsatz / maxUmsatz) * 100);
            return (
              <div key={z.zone} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{z.zone}</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{euro(z.umsatz)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mb-1">
                  <div className="h-full rounded-full bg-emerald-400 dark:bg-emerald-600 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex gap-3">
                  <span className="text-[10px] text-slate-400"><Package className="inline w-3 h-3 mr-0.5" />{z.bestellungen} Bestellungen</span>
                  <span className="text-[10px] text-slate-400"><Clock className="inline w-3 h-3 mr-0.5" />Ø {z.avg_lieferzeit}m</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
        <span className="text-[10px] text-slate-400">{data.schicht_bestellungen} Bestellungen heute</span>
        <span className="text-[10px] text-slate-300 dark:text-slate-600">
          {new Date(data.aktualisiert).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
