'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, XCircle } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  storno_rate_pct: number;
  angebotene_touren: number;
  stornierte_touren: number;
  ampel: string;
  trend: string;
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_storno_rate_pct: number;
  alert_count: number;
}

const ZIEL_PCT = 5;
const WARN_PCT = 15;

function calcAmpel(pct: number): string {
  if (pct > WARN_PCT) return 'rot';
  if (pct > ZIEL_PCT) return 'gelb';
  return 'gruen';
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
  // steigend = schlechter (rot), fallend = besser (grün) — invertiert
  if (trend === 'steigend') return <TrendingUp   size={11} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={11} className="text-green-600" />;
  return                           <Minus        size={11} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f5', fahrer_name: 'Jana F.',   storno_rate_pct: 21.4, angebotene_touren: 14, stornierte_touren: 3, ampel: 'rot',   trend: 'steigend', alert: true  },
    { fahrer_id: 'f2', fahrer_name: 'Sarah K.',  storno_rate_pct: 18.5, angebotene_touren: 27, stornierte_touren: 5, ampel: 'rot',   trend: 'steigend', alert: true  },
    { fahrer_id: 'f3', fahrer_name: 'Lena S.',   storno_rate_pct:  8.7, angebotene_touren: 23, stornierte_touren: 2, ampel: 'gelb',  trend: 'steigend', alert: false },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',    storno_rate_pct:  3.2, angebotene_touren: 31, stornierte_touren: 1, ampel: 'gruen', trend: 'fallend',  alert: false },
    { fahrer_id: 'f4', fahrer_name: 'Tom B.',    storno_rate_pct:  2.1, angebotene_touren: 48, stornierte_touren: 1, ampel: 'gruen', trend: 'fallend',  alert: false },
  ],
  team_avg_storno_rate_pct: 10.8,
  alert_count: 2,
};

export function KitchenPhase2811StornoRateTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-storno-rate?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched = data.fahrer.map(f => ({ ...f, ampel: f.ampel || calcAmpel(f.storno_rate_pct) }));
  // Absteigend (höchste Rate oben = schlechteste zuerst)
  const sorted   = [...enriched].sort((a, b) => b.storno_rate_pct - a.storno_rate_pct);
  const alerts   = enriched.filter(f => f.alert || f.storno_rate_pct > WARN_PCT);
  const hasAlert = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_avg_storno_rate_pct);

  return (
    <div className={`rounded-xl border p-3 mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <XCircle size={14} className="text-orange-500" />
          <span className="font-semibold text-xs text-gray-800">Storno-Rate Fahrer</span>
          {hasAlert && <AlertTriangle size={12} className="text-red-500" />}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${dotCls(teamAmpel)} text-white`}>
            Ø {data.team_avg_storno_rate_pct}%
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
              <span>— Hohe Storno-Rate! ({f.storno_rate_pct}%)</span>
            </div>
          ))}

          {/* Fahrerliste kompakt */}
          {sorted.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
              <span className={`w-2 h-2 flex-shrink-0 rounded-full ${dotCls(f.ampel)}`} />
              <span className="text-xs text-gray-800 flex-1 truncate">{f.fahrer_name}</span>
              <span className="text-[10px] text-gray-400">{f.stornierte_touren}/{f.angebotene_touren}</span>
              <TrendIcon trend={f.trend} />
              <span className={`text-xs font-semibold ${textCls(f.ampel)}`}>{f.storno_rate_pct}%</span>
            </div>
          ))}

          {/* Ziel */}
          <div className="text-[10px] text-gray-400 text-center pt-1">
            Ziel ≤{ZIEL_PCT}% — {data.alert_count === 0 ? 'Alle im Zielbereich ✓' : `${data.alert_count} Fahrer über ${WARN_PCT}%`}
          </div>
        </div>
      )}
    </div>
  );
}
