'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Coins } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  tip_rate_pct: number;
  tip_sum_eur: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_rate_pct: number;
  alert_count: number;
}

function dotColor(ampel: string) {
  if (ampel === 'rot')  return 'bg-red-500';
  if (ampel === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f5', fahrer_name: 'Jana F.',  tip_rate_pct:  5.9, tip_sum_eur:  2.50, ampel: 'rot',   alert: true  },
    { fahrer_id: 'f2', fahrer_name: 'Sarah K.', tip_rate_pct:  7.4, tip_sum_eur:  3.20, ampel: 'rot',   alert: true  },
    { fahrer_id: 'f3', fahrer_name: 'Lena S.',  tip_rate_pct: 14.3, tip_sum_eur:  9.80, ampel: 'gelb',  alert: false },
    { fahrer_id: 'f4', fahrer_name: 'Tom B.',   tip_rate_pct: 22.9, tip_sum_eur: 14.00, ampel: 'gruen', alert: false },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   tip_rate_pct: 25.0, tip_sum_eur: 18.50, ampel: 'gruen', alert: false },
  ],
  team_avg_rate_pct: 15.1,
  alert_count: 2,
};

export function KitchenPhase2553TrinkgeldQuoteV2Ticker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-trinkgeld-quote-v2?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted = [...data.fahrer].sort((a, b) => a.tip_rate_pct - b.tip_rate_pct);
  const hasAlert    = data.alert_count > 0;
  const alertFahrer = data.fahrer.filter(f => f.alert).map(f => f.fahrer_name);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-3`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-1.5">
          <Coins size={14} className={hasAlert ? 'text-red-500' : 'text-green-600'} />
          <span className="font-semibold text-xs text-gray-800">Trinkgeld-Quote</span>
          {hasAlert && (
            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
              {data.alert_count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${hasAlert ? 'text-red-600' : 'text-green-600'}`}>
            Ø {data.team_avg_rate_pct.toFixed(1)}%
          </span>
          {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {hasAlert && (
            <div className="flex items-start gap-1.5 bg-red-100 border border-red-200 rounded-lg px-2 py-1.5">
              <AlertTriangle size={12} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 font-medium">
                Trinkgeld-Quote &lt;10%: {alertFahrer.join(', ')}
              </p>
            </div>
          )}
          <div className="space-y-1">
            {sorted.map(f => (
              <div key={f.fahrer_id} className="flex items-center gap-1.5 py-0.5">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor(f.ampel)}`} />
                <span className="text-xs text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
                <span className={`text-xs font-semibold ${f.ampel === 'rot' ? 'text-red-600' : f.ampel === 'gelb' ? 'text-amber-600' : 'text-green-600'}`}>
                  {f.tip_rate_pct.toFixed(1)}%
                </span>
                <span className="text-xs text-gray-400 ml-1">{f.tip_sum_eur.toFixed(2)}€</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
