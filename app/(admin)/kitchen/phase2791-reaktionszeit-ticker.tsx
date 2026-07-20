'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_min: number;
  batches_heute: number;
  ampel: string;
  trend: string;
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_min: number;
  alert_count: number;
}

const ZIEL_MIN = 2;
const WARN_MIN = 5;

function calcAmpel(m: number): string {
  if (m <= ZIEL_MIN) return 'gruen';
  if (m <= WARN_MIN) return 'gelb';
  return 'rot';
}

function dotCls(a: string): string {
  if (a === 'rot')  return 'bg-red-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

function textCls(a: string): string {
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
    { fahrer_id: 'f3', fahrer_name: 'Tim W.',  avg_min: 6.5, batches_heute: 6, ampel: 'rot',   trend: 'steigend', alert: true  },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.', avg_min: 3.2, batches_heute: 8, ampel: 'gelb',  trend: 'stabil',   alert: false },
    { fahrer_id: 'f4', fahrer_name: 'Anna B.', avg_min: 2.1, batches_heute: 10, ampel: 'gruen', trend: 'stabil',  alert: false },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',  avg_min: 1.4, batches_heute: 11, ampel: 'gruen', trend: 'fallend', alert: false },
  ],
  team_avg_min: 3.3,
  alert_count: 1,
};

export function KitchenPhase2791ReaktionszeitTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-reaktionszeit-auf-zuweisung?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched  = data.fahrer.map(f => ({ ...f, ampel: f.ampel || calcAmpel(f.avg_min) }));
  // Absteigend (höchste Reaktionszeit oben = schlechteste zuerst)
  const sorted    = [...enriched].sort((a, b) => b.avg_min - a.avg_min);
  const alerts    = enriched.filter(f => f.alert || f.avg_min > WARN_MIN);
  const hasAlert  = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_avg_min);

  return (
    <div className={`rounded-xl border p-3 mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-blue-500" />
          <span className="font-semibold text-xs text-gray-800">Reaktionszeit Fahrer</span>
          {hasAlert && <AlertTriangle size={12} className="text-red-500" />}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${dotCls(teamAmpel)} text-white`}>
            Ø {data.team_avg_min} Min
          </span>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {/* Alert-Banner */}
          {alerts.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-1 text-[10px] text-red-700 bg-red-100 rounded px-2 py-1">
              <AlertTriangle size={10} />
              <span className="font-medium">{f.fahrer_name}</span>
              <span>— Langsame Reaktion! ({f.avg_min} Min)</span>
            </div>
          ))}

          {/* Fahrerliste kompakt */}
          {sorted.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
              <span className={`w-2 h-2 flex-shrink-0 rounded-full ${dotCls(f.ampel)}`} />
              <span className="text-xs text-gray-800 flex-1 truncate">{f.fahrer_name}</span>
              <TrendIcon trend={f.trend} />
              <span className={`text-xs font-semibold ${textCls(f.ampel)}`}>{f.avg_min} Min</span>
            </div>
          ))}

          {/* Ziel */}
          <div className="text-[10px] text-gray-400 text-center pt-1">
            Ziel ≤{ZIEL_MIN} Min — {data.alert_count === 0 ? 'Alle im Zielbereich ✓' : `${data.alert_count} Fahrer über ${WARN_MIN} Min`}
          </div>
        </div>
      )}
    </div>
  );
}
