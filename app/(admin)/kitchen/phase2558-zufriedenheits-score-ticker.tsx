'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Smile } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg: number;
  alert_count: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f5', fahrer_name: 'Jana F.',  score: 51, ampel: 'rot',   alert: true  },
    { fahrer_id: 'f3', fahrer_name: 'Lena S.',  score: 57, ampel: 'rot',   alert: true  },
    { fahrer_id: 'f2', fahrer_name: 'Sarah K.', score: 74, ampel: 'gelb',  alert: false },
    { fahrer_id: 'f4', fahrer_name: 'Tom B.',   score: 83, ampel: 'gruen', alert: false },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   score: 88, ampel: 'gruen', alert: false },
  ],
  team_avg: 71,
  alert_count: 2,
};

function dot(ampel: string) {
  if (ampel === 'gruen') return 'bg-green-500';
  if (ampel === 'gelb')  return 'bg-amber-400';
  return 'bg-red-500';
}

export function KitchenPhase2558ZufriedenheitsScoreTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-zufriedenheits-score-v2?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const hasAlert = data.alert_count > 0;
  const alertFahrer = data.fahrer.filter(f => f.alert).map(f => f.fahrer_name);
  const sorted = [...data.fahrer].sort((a, b) => a.score - b.score);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-700/60 bg-red-900/20' : 'border-matcha-700/50 bg-matcha-900/50'} overflow-hidden mb-3`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Smile size={14} className={hasAlert ? 'text-red-400' : 'text-matcha-400'} />
          <span className="text-[11px] font-black uppercase tracking-widest text-matcha-300">
            Zufriedenheits-Score
          </span>
          {hasAlert && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-black text-white animate-pulse">
              {data.alert_count} Alert{data.alert_count > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${hasAlert ? 'text-red-400' : 'text-matcha-300'}`}>
            Ø {data.team_avg}
          </span>
          {open ? <ChevronUp size={14} className="text-matcha-500" /> : <ChevronDown size={14} className="text-matcha-500" />}
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {hasAlert && (
            <div className="flex items-center gap-2 rounded-lg bg-red-900/40 border border-red-700/60 px-2.5 py-1.5">
              <AlertTriangle size={12} className="text-red-400 flex-shrink-0" />
              <p className="text-[10px] text-red-300 font-semibold">
                Zufriedenheit &lt;60: {alertFahrer.join(', ')}
              </p>
            </div>
          )}

          <div className="space-y-1">
            {sorted.map(f => (
              <div key={f.fahrer_id} className="flex items-center gap-2 text-[10px]">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dot(f.ampel)}`} />
                <span className="text-matcha-300 w-16 truncate">{f.fahrer_name}</span>
                <div className="flex-1 relative h-1 rounded-full bg-matcha-800">
                  <div
                    className={`absolute left-0 top-0 h-full rounded-full ${dot(f.ampel)}`}
                    style={{ width: `${f.score}%` }}
                  />
                </div>
                <span className={`font-mono font-bold w-6 text-right ${f.alert ? 'text-red-400' : 'text-matcha-300'}`}>
                  {f.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
