'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Zap } from 'lucide-react';

interface FahrerDurchsatz {
  fahrer_id: string;
  fahrer_name: string;
  bph: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerDurchsatz[];
  team_avg_bph: number;
  alert_count: number;
}

function dot(bph: number) {
  if (bph >= 3) return 'bg-green-500';
  if (bph >= 2) return 'bg-amber-400';
  return 'bg-red-500';
}

function textColor(bph: number) {
  if (bph >= 3) return 'text-green-600';
  if (bph >= 2) return 'text-amber-600';
  return 'text-red-600';
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'mock-f3', fahrer_name: 'Tim B.',   bph: 1.6, ampel: 'rot'   },
    { fahrer_id: 'mock-f2', fahrer_name: 'Sara K.',  bph: 3.8, ampel: 'gelb'  },
    { fahrer_id: 'mock-f4', fahrer_name: 'Julia F.', bph: 4.5, ampel: 'gruen' },
    { fahrer_id: 'mock-f1', fahrer_name: 'Max M.',   bph: 5.2, ampel: 'gruen' },
  ],
  team_avg_bph: 3.8,
  alert_count: 1,
};

export function KitchenPhase2506DurchsatzTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-durchsatz?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const hasAlert = data.alert_count > 0;
  const sorted = [...data.fahrer].sort((a, b) => a.bph - b.bph);
  const alertFahrer = data.fahrer.filter(f => f.ampel === 'rot').map(f => f.fahrer_name);

  return (
    <div className={`rounded-xl border shadow-sm ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Zap size={14} className={hasAlert ? 'text-red-600' : 'text-emerald-500'} />
          <span className="text-xs font-bold text-gray-700">Durchsatz</span>
          <span className={`text-xs font-black tabular-nums ${hasAlert ? 'text-red-700' : 'text-gray-700'}`}>
            Ø {data.team_avg_bph.toFixed(1)}/h
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
              Durchsatz &lt;2/h: {alertFahrer.join(', ')} — Route beschleunigen!
            </div>
          )}
          {sorted.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full shrink-0 ${dot(f.bph)}`} />
              <span className="text-[10px] text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
              <span className={`text-[10px] font-black tabular-nums shrink-0 ${textColor(f.bph)}`}>
                {f.bph.toFixed(1)}/h
              </span>
            </div>
          ))}
          <div className="pt-0.5 text-[8px] text-gray-400">30-Min-Polling · Ziel: ≥3 Lieferungen/h</div>
        </div>
      )}
    </div>
  );
}
