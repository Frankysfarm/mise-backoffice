'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Package, Clock, Star, Euro, Users, Target, Activity, AlertTriangle } from 'lucide-react';

interface KpiItem { label: string; wert: string; einheit: string; delta: number | null; gut: boolean; }
interface StundeItem { stunde: string; bestellungen: number; ziel: number; }
interface FahrerItem { id: string; name: string; score: number; touren: number; ampel: 'gruen' | 'gelb' | 'rot'; }
interface ZoneItem { zone: string; bestellungen: number; avg_lieferzeit_min: number; ampel: 'gruen' | 'gelb' | 'rot'; }

interface DashboardData {
  kpis: KpiItem[];
  stunden: StundeItem[];
  top_fahrer: FahrerItem[];
  zonen: ZoneItem[];
  aktualisiert: string;
  schicht_pct: number;
}

const MOCK: DashboardData = {
  kpis: [
    { label: 'Bestellungen',     wert: '52',    einheit: '',    delta:  9,   gut: true  },
    { label: 'Umsatz',           wert: '1.418', einheit: '€',   delta: 14,   gut: true  },
    { label: 'Ø Lieferzeit',     wert: '25',    einheit: 'min', delta: -2,   gut: true  },
    { label: 'Pünktlichkeit',    wert: '89',    einheit: '%',   delta:  3,   gut: true  },
    { label: 'Aktive Fahrer',    wert: '6',     einheit: '',    delta: null, gut: true  },
    { label: 'Ø Bewertung',      wert: '4.7',   einheit: '★',   delta:  0.1, gut: true  },
    { label: 'Storno-Rate',      wert: '2.8',   einheit: '%',   delta: -0.5, gut: true  },
    { label: 'Tour-Score Ø',     wert: '82',    einheit: '',    delta:  4,   gut: true  },
  ],
  stunden: [
    { stunde: '11', bestellungen: 4,  ziel: 5  },
    { stunde: '12', bestellungen: 9,  ziel: 8  },
    { stunde: '13', bestellungen: 11, ziel: 10 },
    { stunde: '14', bestellungen: 7,  ziel: 8  },
    { stunde: '15', bestellungen: 5,  ziel: 6  },
    { stunde: '16', bestellungen: 8,  ziel: 7  },
    { stunde: '17', bestellungen: 8,  ziel: 9  },
  ],
  top_fahrer: [
    { id: 'f1', name: 'Max K.',   score: 92, touren: 6, ampel: 'gruen' },
    { id: 'f2', name: 'Sara M.',  score: 85, touren: 5, ampel: 'gruen' },
    { id: 'f3', name: 'Tim R.',   score: 74, touren: 4, ampel: 'gelb'  },
    { id: 'f4', name: 'Jonas B.', score: 61, touren: 3, ampel: 'rot'   },
  ],
  zonen: [
    { zone: 'Mitte', bestellungen: 20, avg_lieferzeit_min: 22, ampel: 'gruen' },
    { zone: 'Nord',  bestellungen: 14, avg_lieferzeit_min: 27, ampel: 'gruen' },
    { zone: 'West',  bestellungen: 11, avg_lieferzeit_min: 32, ampel: 'gelb'  },
    { zone: 'Ost',   bestellungen:  7, avg_lieferzeit_min: 38, ampel: 'rot'   },
  ],
  aktualisiert: new Date().toLocaleTimeString('de-DE'),
  schicht_pct: 65,
};

const KPI_ICONS: Record<string, React.ElementType> = {
  'Bestellungen':  Package,
  'Umsatz':        Euro,
  'Ø Lieferzeit':  Clock,
  'Pünktlichkeit': Target,
  'Aktive Fahrer': Users,
  'Ø Bewertung':   Star,
  'Storno-Rate':   AlertTriangle,
  'Tour-Score Ø':  Activity,
};

export function LieferdienstPhase4005StatistikenLiveCockpit({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<DashboardData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/statistiken-cockpit?location_id=${locationId}`);
      if (res.ok) { const j = await res.json(); if (!j.error) setData({ ...j, aktualisiert: new Date().toLocaleTimeString('de-DE') }); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30_000); return () => clearInterval(id); }, [load]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-semibold text-gray-900">Statistiken Live-Cockpit</span>
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        <span className="text-[10px] text-gray-400">Akt. {data.aktualisiert}</span>
      </div>

      {/* Schicht-Fortschritt */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Schicht-Fortschritt</span>
          <span>{data.schicht_pct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-violet-400 rounded-full transition-all" style={{ width: `${data.schicht_pct}%` }} />
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {data.kpis.map((k) => {
          const Icon = KPI_ICONS[k.label] ?? Activity;
          const deltaPos = k.delta !== null && ((k.label === 'Ø Lieferzeit' || k.label === 'Storno-Rate') ? k.delta < 0 : k.delta > 0);
          const deltaNeg = k.delta !== null && ((k.label === 'Ø Lieferzeit' || k.label === 'Storno-Rate') ? k.delta > 0 : k.delta < 0);
          return (
            <div key={k.label} className="bg-gray-50 rounded-lg p-2 space-y-0.5">
              <div className="flex items-center gap-0.5">
                <Icon className="w-3 h-3 text-gray-400" />
                <span className="text-[8px] text-gray-500 truncate leading-tight">{k.label}</span>
              </div>
              <p className="text-sm font-bold text-gray-800">{k.wert}<span className="text-[9px] font-normal text-gray-400 ml-0.5">{k.einheit}</span></p>
              {k.delta !== null && (
                <div className={`flex items-center gap-0.5 text-[9px] font-semibold ${deltaPos ? 'text-green-500' : deltaNeg ? 'text-red-400' : 'text-gray-400'}`}>
                  {deltaPos ? <TrendingUp className="w-2.5 h-2.5" /> : deltaNeg ? <TrendingDown className="w-2.5 h-2.5" /> : null}
                  {k.delta > 0 ? '+' : ''}{k.delta}{k.einheit}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Stündlicher Trend */}
      <div>
        <p className="text-xs font-medium text-gray-600 mb-1.5">Stündlicher Verlauf</p>
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.stunden} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="stunde" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb' }}
                formatter={(v: number) => [`${v} Bestellungen`, '']}
                labelFormatter={(l: string) => `${l}:00 Uhr`}
              />
              <Bar dataKey="bestellungen" radius={[3, 3, 0, 0]}>
                {data.stunden.map((s, i) => (
                  <Cell key={i} fill={s.bestellungen >= s.ziel ? '#a78bfa' : '#d1d5db'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Fahrer + Zonen nebeneinander */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">Top Fahrer</p>
          <div className="space-y-1">
            {data.top_fahrer.map((f) => {
              const c = f.ampel === 'gruen' ? 'bg-green-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
              const tc = f.ampel === 'gruen' ? 'text-green-600' : f.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
              return (
                <div key={f.id} className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c}`} />
                  <span className="text-[10px] text-gray-700 flex-1 truncate">{f.name}</span>
                  <span className="text-[10px] text-gray-400">{f.touren}T</span>
                  <span className={`text-[10px] font-bold ${tc}`}>{f.score}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">Zonen</p>
          <div className="space-y-1">
            {data.zonen.map((z) => {
              const c = z.ampel === 'gruen' ? 'bg-green-400' : z.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
              const tc = z.ampel === 'gruen' ? 'text-green-600' : z.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
              return (
                <div key={z.zone} className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c}`} />
                  <span className="text-[10px] text-gray-700 flex-1">{z.zone}</span>
                  <span className="text-[10px] text-gray-400">{z.bestellungen}×</span>
                  <span className={`text-[10px] font-bold ${tc}`}>{z.avg_lieferzeit_min}m</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-[9px] text-gray-300 text-right">Alle 30s · Mock-Fallback aktiv</p>
    </div>
  );
}
