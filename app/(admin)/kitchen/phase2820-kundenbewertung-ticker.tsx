'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  bewertung_avg: number;
  bewertungen_heute: number;
  ampel: string;
  trend: string;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_durchschnitt: number;
  alert_count: number;
}

const ZIEL  = 4.5;
const ALERT = 3.5;

function calcAmpel(avg: number): string {
  if (avg >= ZIEL)  return 'gruen';
  if (avg >= ALERT) return 'gelb';
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
    { fahrer_id: 'f5', fahrer_name: 'Jana F.',  bewertung_avg: 3.1, bewertungen_heute:  5, ampel: 'rot',   trend: 'fallend'  },
    { fahrer_id: 'f3', fahrer_name: 'Lena S.',  bewertung_avg: 3.8, bewertungen_heute:  6, ampel: 'gelb',  trend: 'fallend'  },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  bewertung_avg: 4.1, bewertungen_heute:  7, ampel: 'gelb',  trend: 'stabil'   },
    { fahrer_id: 'f4', fahrer_name: 'Tom B.',   bewertung_avg: 4.6, bewertungen_heute:  9, ampel: 'gruen', trend: 'stabil'   },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   bewertung_avg: 4.9, bewertungen_heute: 12, ampel: 'gruen', trend: 'steigend' },
  ],
  team_durchschnitt: 4.1,
  alert_count: 1,
};

export function KitchenPhase2820KundenbewertungTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-kundenbewertung?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched = data.fahrer.map(f => ({ ...f, ampel: f.ampel || calcAmpel(f.bewertung_avg) }));
  // Aufsteigend (niedrigste Bewertung oben = schlechteste zuerst)
  const sorted   = [...enriched].sort((a, b) => a.bewertung_avg - b.bewertung_avg);
  const alerts   = enriched.filter(f => f.bewertung_avg < ALERT);
  const hasAlert = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_durchschnitt);

  return (
    <div className={`rounded-xl border p-3 mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Star size={14} className="text-yellow-500" />
          <span className="font-semibold text-xs text-gray-800">Kundenbewertung Fahrer</span>
          {hasAlert && <AlertTriangle size={12} className="text-red-500" />}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${dotCls(teamAmpel)} text-white`}>
            Ø ★ {data.team_durchschnitt}
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
              <span>— Niedrige Kundenbewertung! (★ {f.bewertung_avg})</span>
            </div>
          ))}

          {/* Fahrerliste kompakt */}
          {sorted.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
              <span className={`w-2 h-2 flex-shrink-0 rounded-full ${dotCls(f.ampel)}`} />
              <span className="text-xs text-gray-800 flex-1 truncate">{f.fahrer_name}</span>
              <span className="text-[10px] text-gray-400">{f.bewertungen_heute} Bew.</span>
              <TrendIcon trend={f.trend} />
              <span className={`text-xs font-semibold ${textCls(f.ampel)}`}>★ {f.bewertung_avg}</span>
            </div>
          ))}

          {/* Ziel */}
          <div className="text-[10px] text-gray-400 text-center pt-1">
            Ziel ≥{ZIEL} ★ — {data.alert_count === 0 ? 'Alle im Zielbereich ✓' : `${data.alert_count} Fahrer unter ${ALERT} ★`}
          </div>
        </div>
      )}
    </div>
  );
}
