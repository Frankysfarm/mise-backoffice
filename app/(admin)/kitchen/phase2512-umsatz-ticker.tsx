'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Euro } from 'lucide-react';

interface FahrerUmsatz {
  fahrer_id: string;
  fahrer_name: string;
  umsatz_euro: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerUmsatz[];
  team_total_euro: number;
  team_avg_euro: number;
  alert_count: number;
}

function dot(euro: number) {
  if (euro >= 200) return 'bg-green-500';
  if (euro >= 100) return 'bg-amber-400';
  return 'bg-red-500';
}

function textColor(euro: number) {
  if (euro >= 200) return 'text-green-600';
  if (euro >= 100) return 'text-amber-600';
  return 'text-red-600';
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'mock-f3', fahrer_name: 'Tim B.',   umsatz_euro: 78.20,  ampel: 'rot'   },
    { fahrer_id: 'mock-f2', fahrer_name: 'Sara K.',  umsatz_euro: 154.80, ampel: 'gelb'  },
    { fahrer_id: 'mock-f4', fahrer_name: 'Julia F.', umsatz_euro: 231.00, ampel: 'gruen' },
    { fahrer_id: 'mock-f1', fahrer_name: 'Max M.',   umsatz_euro: 287.50, ampel: 'gruen' },
  ],
  team_total_euro: 751.50,
  team_avg_euro: 187.88,
  alert_count: 1,
};

export function KitchenPhase2512UmsatzTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-umsatz?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const hasAlert = data.alert_count > 0;
  const sorted = [...data.fahrer].sort((a, b) => a.umsatz_euro - b.umsatz_euro);
  const alertFahrer = data.fahrer.filter(f => f.ampel === 'rot').map(f => f.fahrer_name);

  return (
    <div className={`rounded-xl border shadow-sm ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Euro size={14} className={hasAlert ? 'text-red-600' : 'text-emerald-500'} />
          <span className="text-xs font-bold text-gray-700">Umsatz</span>
          <span className={`text-xs font-black tabular-nums ${hasAlert ? 'text-red-700' : 'text-gray-700'}`}>
            {data.team_total_euro.toFixed(0)}€ gesamt
          </span>
          {hasAlert && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-black text-red-700 animate-pulse">
              <AlertTriangle size={9} /> {data.alert_count}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="border-t px-3 pb-3 pt-2 space-y-1.5">
          {alertFahrer.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-red-100 px-2 py-1.5 text-[10px] font-semibold text-red-800">
              <AlertTriangle size={11} className="shrink-0" />
              Umsatz &lt;100€: {alertFahrer.join(', ')} — mehr Touren einplanen!
            </div>
          )}
          {sorted.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full shrink-0 ${dot(f.umsatz_euro)}`} />
              <span className="text-[10px] text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
              <span className={`text-[10px] font-black tabular-nums shrink-0 ${textColor(f.umsatz_euro)}`}>
                {f.umsatz_euro.toFixed(0)}€
              </span>
            </div>
          ))}
          <div className="pt-0.5 text-[8px] text-gray-400">30-Min-Polling · Ziel: ≥200€/Fahrer · Ø {data.team_avg_euro.toFixed(0)}€</div>
        </div>
      )}
    </div>
  );
}
