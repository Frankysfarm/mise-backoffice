'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, ShieldCheck } from 'lucide-react';

interface FahrerLiefertreue {
  fahrer_id: string;
  fahrer_name: string;
  liefertreue_heute: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerLiefertreue[];
  team_avg_liefertreue: number;
  alert_count: number;
}

function dot(pct: number) {
  if (pct >= 95) return 'bg-green-500';
  if (pct >= 85) return 'bg-amber-400';
  return 'bg-red-500';
}

function textColor(pct: number) {
  if (pct >= 95) return 'text-green-600';
  if (pct >= 85) return 'text-amber-600';
  return 'text-red-600';
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'd2', fahrer_name: 'Sara K.',  liefertreue_heute: 80, ampel: 'rot',   alert: true  },
    { fahrer_id: 'd3', fahrer_name: 'Tim B.',   liefertreue_heute: 90, ampel: 'gelb',  alert: false },
    { fahrer_id: 'd4', fahrer_name: 'Julia F.', liefertreue_heute: 95, ampel: 'gruen', alert: false },
    { fahrer_id: 'd1', fahrer_name: 'Max M.',   liefertreue_heute: 98, ampel: 'gruen', alert: false },
  ],
  team_avg_liefertreue: 90.8,
  alert_count: 1,
};

export function KitchenPhase2501LiefertreueTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-liefertreue-heute?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const hasAlert = data.alert_count > 0;
  const sorted = [...data.fahrer].sort((a, b) => a.liefertreue_heute - b.liefertreue_heute);
  const alertFahrer = data.fahrer.filter(f => f.alert).map(f => f.fahrer_name);

  return (
    <div className={`rounded-xl border shadow-sm ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className={hasAlert ? 'text-red-600' : 'text-emerald-500'} />
          <span className="text-xs font-bold text-gray-700">Liefertreue</span>
          <span className={`text-xs font-black tabular-nums ${hasAlert ? 'text-red-700' : 'text-gray-700'}`}>
            Ø {data.team_avg_liefertreue.toFixed(0)}%
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
              Liefertreue &lt;85%: {alertFahrer.join(', ')} — Route überprüfen!
            </div>
          )}
          {sorted.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full shrink-0 ${dot(f.liefertreue_heute)}`} />
              <span className="text-[10px] text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
              <span className={`text-[10px] font-black tabular-nums shrink-0 ${textColor(f.liefertreue_heute)}`}>
                {f.liefertreue_heute}%
              </span>
            </div>
          ))}
          <div className="pt-0.5 text-[8px] text-gray-400">30-Min-Polling · Ziel: ≥95% Liefertreue</div>
        </div>
      )}
    </div>
  );
}
