'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  auslastung_pct: number;
  trend: string;
  ampel: string;
  alert_gering: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_pct: number;
  alert_count: number;
  jahr: number;
}

const ZIEL_PCT  = 60;
const ALERT_PCT = 40;

function ampelDot(a: string) {
  if (a === 'rot')  return 'bg-red-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

function ampelText(a: string) {
  if (a === 'rot')  return 'text-red-600';
  if (a === 'gelb') return 'text-amber-600';
  return 'text-green-600';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={11} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={11} className="text-red-500"   />;
  return                           <Minus        size={11} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', auslastung_pct: 71.8, trend: 'steigend', ampel: 'gruen', alert_gering: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   auslastung_pct: 64.2, trend: 'stabil',   ampel: 'gruen', alert_gering: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  auslastung_pct: 52.7, trend: 'fallend',  ampel: 'gelb',  alert_gering: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   auslastung_pct: 37.5, trend: 'fallend',  ampel: 'rot',   alert_gering: true  },
  ],
  team_avg_pct: 56.6,
  alert_count: 1,
  jahr: 2026,
};

export function KitchenPhase3069JahresauslastungTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-jahresauslastung?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  const list    = data?.fahrer ?? [];
  const teamPct = data?.team_avg_pct ?? 0;
  const teamAmpelText = teamPct >= ZIEL_PCT ? 'text-green-600' : teamPct >= ALERT_PCT ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Calendar size={15} className="text-red-500 shrink-0" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">
            Jahresauslastung {data?.jahr ?? ''}
          </span>
          <span className={`font-bold text-sm ml-1 ${teamAmpelText}`}>{teamPct.toFixed(1)} %</span>
          {(data?.alert_count ?? 0) > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-700 bg-red-100 rounded-full px-1.5 py-0.5 shrink-0">
              <AlertTriangle size={9} /> {data?.alert_count}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={15} className="text-gray-500 shrink-0" /> : <ChevronDown size={15} className="text-gray-500 shrink-0" />}
      </button>

      {open && (
        <div className="p-3 space-y-1.5">
          {/* Alert */}
          {list.some(f => f.alert_gering) && (
            <div className="flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-2.5 py-1.5">
              <AlertTriangle size={12} />
              {list.filter(f => f.alert_gering).map(f => f.fahrer_name).join(', ')} — Geringe Jahresauslastung!
            </div>
          )}

          {/* Fahrerliste kompakt */}
          {list.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <span className={`w-2 h-2 rounded-full shrink-0 ${ampelDot(f.ampel)}`} />
              <span className="flex-1 text-xs font-medium text-gray-700 dark:text-gray-200 truncate">{f.fahrer_name}</span>
              <div className="flex items-center gap-1 shrink-0">
                <span className={`text-xs font-bold ${ampelText(f.ampel)}`}>{f.auslastung_pct.toFixed(1)} %</span>
                <TrendIcon trend={f.trend} />
              </div>
              {/* Mini-Balken */}
              <div className="relative w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shrink-0">
                <div
                  className={`h-full rounded-full ${f.ampel === 'rot' ? 'bg-red-500' : f.ampel === 'gelb' ? 'bg-amber-400' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(100, f.auslastung_pct)}%` }}
                />
                <div className="absolute top-0 bottom-0 w-px bg-gray-600 opacity-50" style={{ left: `${ZIEL_PCT}%` }} />
              </div>
            </div>
          ))}

          <div className="text-xs text-gray-400 text-right pt-0.5">Ziel ≥ {ZIEL_PCT} %</div>
        </div>
      )}
    </div>
  );
}
