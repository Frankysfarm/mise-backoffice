'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Fuel } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  kosten_heute: number;
  trend: 'steigend' | 'fallend' | 'stabil';
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_kosten: number;
}

function ampelVon(kosten: number): 'gruen' | 'gelb' | 'rot' {
  if (kosten <= 5)  return 'gruen';
  if (kosten <= 10) return 'gelb';
  return 'rot';
}

function dotCls(a: string) {
  if (a === 'rot')  return 'bg-red-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

function textCls(a: string) {
  if (a === 'rot')  return 'text-red-700';
  if (a === 'gelb') return 'text-amber-700';
  return 'text-green-700';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={11} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={11} className="text-green-600" />;
  return                           <Minus        size={11} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f3', fahrer_name: 'Tim W.',   kosten_heute: 16.18, trend: 'steigend' },
    { fahrer_id: 'f5', fahrer_name: 'Jonas W.', kosten_heute: 13.64, trend: 'stabil'   },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  kosten_heute: 11.42, trend: 'steigend' },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   kosten_heute:  8.09, trend: 'fallend'  },
    { fahrer_id: 'f4', fahrer_name: 'Lisa F.',  kosten_heute:  4.62, trend: 'fallend'  },
  ],
  team_avg_kosten: 10.79,
};

export function KitchenPhase2665KraftstoffkostenTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-kraftstoffkosten?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched  = data.fahrer.map(f => ({ ...f, ampel: ampelVon(f.kosten_heute) }));
  const sorted    = [...enriched].sort((a, b) => b.kosten_heute - a.kosten_heute);
  const alerts    = enriched.filter(f => f.kosten_heute > 10);
  const hasAlert  = alerts.length > 0;
  const teamAmpel = ampelVon(data.team_avg_kosten);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Fuel size={15} className="text-orange-500" />
          <span className="font-semibold text-sm text-gray-800">Kraftstoffkosten</span>
          {hasAlert && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {alerts.length} Alert{alerts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${textCls(teamAmpel)}`}>
            Ø {data.team_avg_kosten.toFixed(2)} €
          </span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {hasAlert && (
            <div className="flex items-start gap-2 bg-red-100 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle size={13} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 font-medium">
                Kraftstoffkosten zu hoch! {alerts.map(f => f.fahrer_name).join(', ')}
              </p>
            </div>
          )}

          <div className="space-y-1">
            {sorted.map(f => (
              <div key={f.fahrer_id} className="flex items-center gap-2 py-1">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotCls(f.ampel)}`} />
                <span className="text-xs text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
                <TrendIcon trend={f.trend} />
                <span className={`text-xs font-semibold w-16 text-right ${textCls(f.ampel)}`}>
                  {f.kosten_heute.toFixed(2)} €
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center text-xs text-gray-400 pt-1 border-t border-gray-100">
            <span>Ziel ≤5 €/Tag</span>
            <span>alle 30 Min</span>
          </div>
        </div>
      )}
    </div>
  );
}
