'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, XCircle } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  fehler: number;
  touren: number;
  fehlerquote_pct: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  alert: string | null;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_pct: number;
}

const ZIEL = 5;
const WARN = 15;

function calcAmpel(pct: number): 'gruen' | 'gelb' | 'rot' {
  if (pct < ZIEL) return 'gruen';
  if (pct <= WARN) return 'gelb';
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
  // steigend = mehr Fehler = schlechter → rot; fallend = weniger Fehler = besser → grün
  if (trend === 'steigend') return <TrendingUp   size={11} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={11} className="text-green-600" />;
  return                           <Minus        size={11} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', fehler: 2, touren:  9, fehlerquote_pct: 22.2, trend: 'steigend', alert: 'Fehlerquote zu hoch!' },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   fehler: 1, touren:  8, fehlerquote_pct: 12.5, trend: 'fallend',  alert: null                   },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  fehler: 1, touren: 10, fehlerquote_pct: 10.0, trend: 'steigend', alert: null                   },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   fehler: 0, touren: 12, fehlerquote_pct:  0.0, trend: 'fallend',  alert: null                   },
  ],
  team_avg_pct: 11.2,
};

export function KitchenPhase2770FehlerquoteTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-fehlerquote?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched  = data.fahrer.map((f: FahrerEntry) => ({ ...f, ampel: calcAmpel(f.fehlerquote_pct) }));
  // Absteigend: höchste Fehlerquote (schlechteste) oben
  const sorted    = [...enriched].sort((a, b) => b.fehlerquote_pct - a.fehlerquote_pct);
  const alerts    = enriched.filter((f: FahrerEntry & { ampel: string }) => f.alert !== null);
  const hasAlert  = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_avg_pct);

  return (
    <div className={`border rounded-xl p-3 mb-3 text-sm ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        className="w-full flex items-center justify-between font-semibold text-gray-800 mb-2"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2">
          <XCircle size={15} className="text-red-500" />
          Fehlerquote-Ticker
          <span className={`text-xs font-normal px-1.5 py-0.5 rounded-full ${textCls(teamAmpel)}`}>
            Ø {data.team_avg_pct}%
          </span>
          {hasAlert && <AlertTriangle size={13} className="text-red-500" />}
        </span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>

      {open && (
        <>
          {/* Alert-Banner */}
          {alerts.map(f => (
            <div key={f.fahrer_id} className="mb-2 px-2 py-1 rounded bg-red-100 border border-red-300 text-red-700 text-xs flex items-center gap-1">
              <AlertTriangle size={11} />
              <strong>{f.fahrer_name}</strong>: {f.alert} ({f.fehlerquote_pct}%)
            </div>
          ))}

          {/* Fahrerliste kompakt */}
          <div className="space-y-1">
            {sorted.map(f => (
              <div key={f.fahrer_id} className="flex items-center gap-2 py-0.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotCls(f.ampel)}`} />
                <span className="flex-1 text-gray-700 truncate">{f.fahrer_name}</span>
                <span className="text-gray-400 text-xs">{f.fehler}/{f.touren}</span>
                <TrendIcon trend={f.trend} />
                <span className={`font-semibold text-xs w-12 text-right ${textCls(f.ampel)}`}>
                  {f.fehlerquote_pct}%
                </span>
              </div>
            ))}
          </div>

          {/* Ziel */}
          <div className="mt-2 text-xs text-gray-400 text-right">Ziel: &lt;{ZIEL}% Fehlerquote</div>
        </>
      )}
    </div>
  );
}
