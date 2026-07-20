'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, CheckCircle2 } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  rate_pct: number;
  abgeschlossen: number;
  gesamt: number;
  ampel: string;
  trend: string;
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_pct: number;
  alert_count: number;
}

const ZIEL_PCT = 95;
const WARN_PCT = 80;

function calcAmpel(p: number): string {
  if (p >= ZIEL_PCT) return 'gruen';
  if (p >= WARN_PCT) return 'gelb';
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
  if (trend === 'fallend')  return <TrendingDown size={11} className="text-red-500"   />;
  return                           <Minus        size={11} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f3', fahrer_name: 'Tim W.',  rate_pct:  75, abgeschlossen:  6, gesamt:  8, ampel: 'rot',   trend: 'fallend',  alert: true  },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.', rate_pct:  88, abgeschlossen:  7, gesamt:  8, ampel: 'gelb',  trend: 'stabil',   alert: false },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',  rate_pct:  97, abgeschlossen: 11, gesamt: 11, ampel: 'gruen', trend: 'steigend', alert: false },
    { fahrer_id: 'f4', fahrer_name: 'Anna B.', rate_pct: 100, abgeschlossen: 10, gesamt: 10, ampel: 'gruen', trend: 'stabil',   alert: false },
  ],
  team_avg_pct: 90,
  alert_count: 1,
};

export function KitchenPhase2796AbschlussrateTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-tour-abschlussrate?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched = data.fahrer.map(f => ({ ...f, ampel: f.ampel || calcAmpel(f.rate_pct) }));
  // Aufsteigend (niedrigste Abschlussrate oben = schlechteste zuerst)
  const sorted   = [...enriched].sort((a, b) => a.rate_pct - b.rate_pct);
  const alerts   = enriched.filter(f => f.alert || f.rate_pct < WARN_PCT);
  const hasAlert = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_avg_pct);

  return (
    <div className={`rounded-xl border p-3 mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 size={14} className="text-green-500" />
          <span className="font-semibold text-xs text-gray-800">Abschlussrate Fahrer</span>
          {hasAlert && <AlertTriangle size={12} className="text-red-500" />}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${dotCls(teamAmpel)} text-white`}>
            Ø {data.team_avg_pct}%
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
              <span>— Niedrige Abschlussrate! ({f.rate_pct}%)</span>
            </div>
          ))}

          {/* Fahrerliste kompakt */}
          {sorted.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
              <span className={`w-2 h-2 flex-shrink-0 rounded-full ${dotCls(f.ampel)}`} />
              <span className="text-xs text-gray-800 flex-1 truncate">{f.fahrer_name}</span>
              <span className="text-[10px] text-gray-400">{f.abgeschlossen}/{f.gesamt}</span>
              <TrendIcon trend={f.trend} />
              <span className={`text-xs font-semibold ${textCls(f.ampel)}`}>{f.rate_pct}%</span>
            </div>
          ))}

          {/* Ziel */}
          <div className="text-[10px] text-gray-400 text-center pt-1">
            Ziel ≥{ZIEL_PCT}% — {data.alert_count === 0 ? 'Alle im Zielbereich ✓' : `${data.alert_count} Fahrer unter ${WARN_PCT}%`}
          </div>
        </div>
      )}
    </div>
  );
}
