'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, ClipboardList } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  erfuellungsrate: number;
  trend: 'steigend' | 'fallend' | 'stabil';
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_rate: number;
}

function ampelVon(rate: number): 'gruen' | 'gelb' | 'rot' {
  if (rate >= 90) return 'gruen';
  if (rate >= 70) return 'gelb';
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
  if (trend === 'steigend') return <TrendingUp   size={11} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={11} className="text-red-500"   />;
  return                           <Minus        size={11} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   erfuellungsrate: 68.8, trend: 'fallend'  },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', erfuellungsrate: 93.8, trend: 'steigend' },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  erfuellungsrate: 100,  trend: 'steigend' },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   erfuellungsrate: 100,  trend: 'stabil'   },
  ],
  team_avg_rate: 90.7,
};

export function KitchenPhase2685SchichtBilanzTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-schicht-bilanz-v2?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched  = data.fahrer.map(f => ({ ...f, ampel: ampelVon(f.erfuellungsrate) }));
  const sorted    = [...enriched].sort((a, b) => a.erfuellungsrate - b.erfuellungsrate);
  const alerts    = enriched.filter(f => f.erfuellungsrate < 70);
  const hasAlert  = alerts.length > 0;
  const teamAmpel = ampelVon(data.team_avg_rate);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <ClipboardList size={15} className={hasAlert ? 'text-red-500' : 'text-gray-500'} />
          <span className="font-semibold text-sm text-gray-800">Schicht-Bilanz</span>
          <span className={`text-xs font-bold ${textCls(teamAmpel)}`}>
            Ø {data.team_avg_rate}%
          </span>
          {hasAlert && (
            <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
              {alerts.length}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-2">
          {/* Alert Banner */}
          {hasAlert && (
            <div className="flex items-start gap-2 bg-red-100 border border-red-200 rounded-lg px-3 py-1.5">
              <AlertTriangle size={13} className="text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700 font-medium">
                Schicht unterbesetzt! {alerts.map(a => a.fahrer_name).join(', ')}
              </p>
            </div>
          )}

          {/* Driver list */}
          {sorted.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${dotCls(f.ampel)}`} />
              <span className="text-xs text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
              <TrendIcon trend={f.trend} />
              <span className={`text-xs font-bold ${textCls(f.ampel)}`}>{f.erfuellungsrate}%</span>
            </div>
          ))}

          {/* Ziel */}
          <p className="text-xs text-gray-400 pt-1">Ziel ≥90% Erfüllungsrate/Fahrer</p>
        </div>
      )}
    </div>
  );
}
