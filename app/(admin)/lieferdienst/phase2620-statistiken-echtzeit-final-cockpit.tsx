'use client';
import { useEffect, useRef, useState } from 'react';
import { BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  AlertCircle, TrendingUp, TrendingDown, Minus, RefreshCw, BarChart3,
  Clock, Users, Euro, Target, Star, Package, Truck, XCircle,
} from 'lucide-react';

interface KpiTile {
  key: string;
  label: string;
  value: string;
  sub?: string;
  trend: 'steigend' | 'fallend' | 'gleich';
  delta: string;
  ampel: 'gruen' | 'gelb' | 'rot';
  icon: string;
}

interface StundeEintrag {
  stunde: string;
  bestellungen: number;
  umsatz: number;
}

interface ZoneEntry {
  name: string;
  bestellungen: number;
  umsatz: number;
  lieferzeit: number;
}

interface FahrerEntry {
  name: string;
  touren: number;
  bewertung: number;
  puenktlichkeit: number;
}

interface AlertEntry {
  text: string;
  ampel: 'rot' | 'gelb';
}

interface ApiData {
  kpis: KpiTile[];
  stunden: StundeEintrag[];
  zonen: ZoneEntry[];
  fahrer: FahrerEntry[];
  alerts: AlertEntry[];
  letzte_aktualisierung: string;
}

const MOCK: ApiData = {
  kpis: [
    { key: 'bestellungen',   label: 'Bestellungen',   value: '63',       sub: 'heute',    trend: 'steigend', delta: '+8',      ampel: 'gruen', icon: 'Package'  },
    { key: 'umsatz',         label: 'Umsatz',         value: '1.580 €',  sub: 'heute',    trend: 'steigend', delta: '+14%',    ampel: 'gruen', icon: 'Euro'     },
    { key: 'lieferzeit',     label: 'Ø Lieferzeit',   value: '27 Min',   sub: 'aktuell',  trend: 'fallend',  delta: '-3 Min',  ampel: 'gelb',  icon: 'Clock'    },
    { key: 'puenktlichkeit', label: 'Pünktlichkeit',  value: '87%',      sub: 'on-time',  trend: 'steigend', delta: '+4%',     ampel: 'gelb',  icon: 'Target'   },
    { key: 'bewertung',      label: 'Ø Bewertung',    value: '4.4 ★',    sub: 'heute',    trend: 'fallend',  delta: '-0.1',    ampel: 'gelb',  icon: 'Star'     },
    { key: 'fahrer',         label: 'Aktive Fahrer',  value: '5',        sub: 'online',   trend: 'gleich',   delta: '0',       ampel: 'gruen', icon: 'Users'    },
    { key: 'sla',            label: 'SLA-Quote',      value: '93%',      sub: '≤35 Min',  trend: 'steigend', delta: '+2%',     ampel: 'gruen', icon: 'Truck'    },
    { key: 'storno',         label: 'Storno-Rate',    value: '3,2%',     sub: 'heute',    trend: 'fallend',  delta: '-0,8%',   ampel: 'gruen', icon: 'XCircle'  },
  ],
  stunden: [
    { stunde: '10', bestellungen: 3,  umsatz: 78  },
    { stunde: '11', bestellungen: 7,  umsatz: 182 },
    { stunde: '12', bestellungen: 14, umsatz: 368 },
    { stunde: '13', bestellungen: 11, umsatz: 290 },
    { stunde: '14', bestellungen: 8,  umsatz: 210 },
    { stunde: '15', bestellungen: 6,  umsatz: 158 },
    { stunde: '16', bestellungen: 5,  umsatz: 132 },
    { stunde: '17', bestellungen: 9,  umsatz: 162 },
  ],
  zonen: [
    { name: 'Mitte',   bestellungen: 22, umsatz: 560, lieferzeit: 24 },
    { name: 'Nord',    bestellungen: 18, umsatz: 450, lieferzeit: 29 },
    { name: 'West',    bestellungen: 15, umsatz: 380, lieferzeit: 31 },
    { name: 'Süd',     bestellungen: 8,  umsatz: 190, lieferzeit: 27 },
  ],
  fahrer: [
    { name: 'Mehmet K.', touren: 9, bewertung: 4.8, puenktlichkeit: 94 },
    { name: 'Jonas W.',  touren: 8, bewertung: 4.6, puenktlichkeit: 91 },
    { name: 'Ali R.',    touren: 7, bewertung: 4.4, puenktlichkeit: 88 },
    { name: 'Tom B.',    touren: 6, bewertung: 4.3, puenktlichkeit: 85 },
    { name: 'Lena P.',   touren: 5, bewertung: 4.1, puenktlichkeit: 82 },
  ],
  alerts: [
    { text: 'Zone West: Lieferzeit >30 Min', ampel: 'gelb' },
  ],
  letzte_aktualisierung: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
};

function ampelBg(a: string) {
  if (a === 'rot')  return 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800';
  if (a === 'gelb') return 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-700';
  return 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800';
}

function ampelText(a: string) {
  if (a === 'rot')  return 'text-red-700 dark:text-red-400';
  if (a === 'gelb') return 'text-amber-700 dark:text-amber-400';
  return 'text-green-700 dark:text-green-400';
}

function ampelDot(a: string) {
  if (a === 'rot')  return 'bg-red-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

function TrendIcon({ t }: { t: string }) {
  if (t === 'steigend') return <TrendingUp size={11} className="text-green-600" />;
  if (t === 'fallend')  return <TrendingDown size={11} className="text-red-500" />;
  return <Minus size={11} className="text-gray-400" />;
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Package, Euro, Clock, Target, Star, Users, Truck, XCircle,
};

type ChartMode = 'bestellungen' | 'umsatz';

const POLL_MS = 3 * 60 * 1000;

export function LieferdienstPhase2620StatistikenEchtzeitFinalCockpit({ locationId }: { locationId?: string | null }) {
  const [data, setData]         = useState<ApiData | null>(null);
  const [loading, setLoading]   = useState(false);
  const [chart, setChart]       = useState<ChartMode>('bestellungen');
  const [expanded, setExpanded] = useState<'zonen' | 'fahrer' | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => {
    if (!locationId) { setData(MOCK); return; }
    setLoading(true);
    fetch(`/api/delivery/lieferdienst/statistiken-echtzeit?location_id=${locationId}`)
      .then(r => r.json())
      .then((d: ApiData) => setData(d))
      .catch(() => setData(MOCK))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center text-gray-400 text-sm">
      <RefreshCw size={18} className="animate-spin mx-auto mb-2" />Statistiken werden geladen…
    </div>
  );

  const barColor = (idx: number) => {
    const colors = ['#3b82f6','#6366f1','#8b5cf6','#a78bfa','#c4b5fd','#ddd6fe','#e0e7ff','#ede9fe'];
    return colors[idx % colors.length];
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 overflow-hidden mb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} />
          <span className="font-semibold text-sm">Statistiken Echtzeit</span>
          {loading && <RefreshCw size={12} className="animate-spin opacity-70" />}
        </div>
        <span className="text-xs opacity-75">Stand: {data.letzte_aktualisierung}</span>
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800">
          {data.alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
              <AlertCircle size={12} />
              {a.text}
            </div>
          ))}
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {data.kpis.map(k => {
            const Icon = ICON_MAP[k.icon] ?? Package;
            return (
              <div key={k.key} className={`rounded-lg border p-3 ${ampelBg(k.ampel)}`}>
                <div className="flex items-center justify-between mb-1">
                  <Icon size={13} className={ampelText(k.ampel)} />
                  <div className={`w-2 h-2 rounded-full ${ampelDot(k.ampel)}`} />
                </div>
                <div className={`text-xl font-bold leading-none ${ampelText(k.ampel)}`}>{k.value}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{k.label}</div>
                <div className="flex items-center gap-1 mt-1">
                  <TrendIcon t={k.trend} />
                  <span className="text-xs text-gray-400">{k.delta}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Stunden-Chart */}
        <div className="rounded-lg border border-gray-100 dark:border-gray-700 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Stundenverlauf heute</span>
            <div className="flex rounded-md border border-gray-200 dark:border-gray-600 overflow-hidden text-xs">
              {(['bestellungen','umsatz'] as ChartMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setChart(m)}
                  className={`px-2 py-0.5 capitalize transition-colors ${chart === m ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50'}`}
                >
                  {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz'}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={90}>
            <BarChart data={data.stunden} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="stunde" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => chart === 'umsatz' ? `${v} €` : `${v}`}
                labelFormatter={(l: string) => `${l}:00 Uhr`}
                contentStyle={{ fontSize: 11 }}
              />
              <Bar dataKey={chart} radius={[3,3,0,0]}>
                {data.stunden.map((_, i) => <Cell key={i} fill={barColor(i)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Zonen-Ranking */}
        <div className="rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 transition-colors"
            onClick={() => setExpanded(e => e === 'zonen' ? null : 'zonen')}
          >
            <span>Zonen-Ranking</span>
            <span className="text-gray-400">{expanded === 'zonen' ? '▲' : '▼'}</span>
          </button>
          {expanded === 'zonen' && (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.zonen.map((z, i) => (
                <div key={z.name} className="flex items-center px-3 py-2 gap-3">
                  <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex-1">{z.name}</span>
                  <span className="text-xs text-blue-600 font-semibold">{z.bestellungen} Bestellungen</span>
                  <span className="text-xs text-gray-400">{z.lieferzeit} Min</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top-Fahrer */}
        <div className="rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 transition-colors"
            onClick={() => setExpanded(e => e === 'fahrer' ? null : 'fahrer')}
          >
            <span>Top-Fahrer heute</span>
            <span className="text-gray-400">{expanded === 'fahrer' ? '▲' : '▼'}</span>
          </button>
          {expanded === 'fahrer' && (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.fahrer.map((f, i) => (
                <div key={f.name} className="flex items-center px-3 py-2 gap-3">
                  <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex-1">{f.name}</span>
                  <span className="text-xs text-indigo-600 font-semibold">{f.touren} Touren</span>
                  <span className="text-xs text-amber-600">{f.bewertung.toFixed(1)} ★</span>
                  <span className="text-xs text-green-600">{f.puenktlichkeit}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
