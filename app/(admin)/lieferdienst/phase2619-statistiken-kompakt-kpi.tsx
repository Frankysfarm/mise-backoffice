'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';

interface KpiEntry {
  label: string;
  value: string;
  trend: string;
  trend_delta: string;
  ampel: string;
}

interface ApiData {
  kpis: KpiEntry[];
  letzte_aktualisierung: string;
}

function ampelCls(a: string) {
  if (a === 'rot')  return 'text-red-600';
  if (a === 'gelb') return 'text-amber-600';
  return 'text-green-600';
}

function dotCls(a: string) {
  if (a === 'rot')  return 'bg-red-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend')  return <TrendingUp   size={10} className="text-green-600" />;
  if (trend === 'fallend')   return <TrendingDown size={10} className="text-red-500"   />;
  return                            <Minus        size={10} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  kpis: [
    { label: 'Bestellungen', value: '47',      trend: 'steigend', trend_delta: '+5',     ampel: 'gruen' },
    { label: 'Umsatz',       value: '1.240 €', trend: 'steigend', trend_delta: '+12%',   ampel: 'gruen' },
    { label: 'Lieferzeit',   value: '28 Min',  trend: 'fallend',  trend_delta: '-2 Min', ampel: 'gelb'  },
    { label: 'Pünktlichkeit',value: '84%',     trend: 'steigend', trend_delta: '+3%',    ampel: 'gelb'  },
    { label: 'Bewertung',    value: '4.3 ★',   trend: 'fallend',  trend_delta: '-0.1',   ampel: 'gelb'  },
    { label: 'Aktive Fahrer',value: '4',       trend: 'gleich',   trend_delta: '0',      ampel: 'gruen' },
    { label: 'SLA-Quote',    value: '91%',     trend: 'steigend', trend_delta: '+2%',    ampel: 'gruen' },
    { label: 'Storno-Rate',  value: '4%',      trend: 'fallend',  trend_delta: '-1%',    ampel: 'gruen' },
  ],
  letzte_aktualisierung: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
};

export function LieferdienstPhase2619StatistikenKompaktKpi({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    const load = () => {
      const base = locationId ? `/api/delivery/admin/stats-kompakt?location_id=${locationId}` : null;
      if (!base) { setData(MOCK); return; }
      fetch(base)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    };
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const alerts = data.kpis.filter(k => k.ampel === 'rot');

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Statistiken Kompakt</span>
          {alerts.length > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{alerts.length} Alert</span>
          )}
          <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto mr-2">Stand {data.letzte_aktualisierung}</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 py-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {data.kpis.map(k => (
              <div key={k.label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotCls(k.ampel)}`} />
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{k.label}</span>
                </div>
                <div className={`text-base font-bold ${ampelCls(k.ampel)}`}>{k.value}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <TrendIcon trend={k.trend} />
                  <span className="text-xs text-gray-400 dark:text-gray-500">{k.trend_delta}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
