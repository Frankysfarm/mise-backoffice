'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  puenktlich_rate: number;
  puenktlich_anzahl: number;
  gesamt_lieferungen: number;
  ampel: string;
  trend: string;
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_rate: number;
  alert_count: number;
}

const ZIEL_RATE = 90;
const WARN_RATE = 70;

function calcAmpel(rate: number): string {
  if (rate >= ZIEL_RATE) return 'gruen';
  if (rate >= WARN_RATE) return 'gelb';
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
  if (trend === 'steigend') return <TrendingUp   size={11} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={11} className="text-red-500" />;
  return                           <Minus        size={11} className="text-gray-400" />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f3', fahrer_name: 'Tim W.',  puenktlich_rate: 62.5, puenktlich_anzahl:  5, gesamt_lieferungen:  8, ampel: 'rot',   trend: 'fallend',  alert: true  },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.', puenktlich_rate: 81.3, puenktlich_anzahl: 13, gesamt_lieferungen: 16, ampel: 'gelb',  trend: 'stabil',   alert: false },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',  puenktlich_rate: 95.5, puenktlich_anzahl: 21, gesamt_lieferungen: 22, ampel: 'gruen', trend: 'steigend', alert: false },
    { fahrer_id: 'f4', fahrer_name: 'Anna B.', puenktlich_rate: 100.0, puenktlich_anzahl: 10, gesamt_lieferungen: 10, ampel: 'gruen', trend: 'steigend', alert: false },
  ],
  team_avg_rate: 84.8,
  alert_count: 1,
};

export function KitchenPhase2806PuenktlichkeitsTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-puenktlichkeitsrate?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched = data.fahrer.map(f => ({ ...f, ampel: f.ampel || calcAmpel(f.puenktlich_rate) }));
  // Aufsteigend (niedrigste Rate oben = schlechteste zuerst für Alert-Sichtbarkeit)
  const sorted   = [...enriched].sort((a, b) => a.puenktlich_rate - b.puenktlich_rate);
  const alerts   = enriched.filter(f => f.alert || f.puenktlich_rate < WARN_RATE);
  const hasAlert = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_avg_rate);

  return (
    <div className={`rounded-xl border p-3 mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-indigo-500" />
          <span className="font-semibold text-xs text-gray-800">Pünktlichkeit Fahrer</span>
          {hasAlert && <AlertTriangle size={12} className="text-red-500" />}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${dotCls(teamAmpel)} text-white`}>
            Ø {data.team_avg_rate}%
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
              <span>— Niedrige Pünktlichkeit! ({f.puenktlich_rate}%)</span>
            </div>
          ))}

          {/* Fahrerliste kompakt */}
          {sorted.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
              <span className={`w-2 h-2 flex-shrink-0 rounded-full ${dotCls(f.ampel)}`} />
              <span className="text-xs text-gray-800 flex-1 truncate">{f.fahrer_name}</span>
              <span className="text-[10px] text-gray-400">{f.puenktlich_anzahl}/{f.gesamt_lieferungen}</span>
              <TrendIcon trend={f.trend} />
              <span className={`text-xs font-semibold ${textCls(f.ampel)}`}>{f.puenktlich_rate}%</span>
            </div>
          ))}

          {/* Ziel */}
          <div className="text-[10px] text-gray-400 text-center pt-1">
            Ziel ≥{ZIEL_RATE}% — {data.alert_count === 0 ? 'Alle im Zielbereich ✓' : `${data.alert_count} Fahrer unter ${WARN_RATE}%`}
          </div>
        </div>
      )}
    </div>
  );
}
