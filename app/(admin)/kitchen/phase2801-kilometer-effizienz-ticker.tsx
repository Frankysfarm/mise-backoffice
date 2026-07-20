'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Navigation } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_km_lieferung: number;
  lieferungen: number;
  ampel: string;
  trend: string;
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_km: number;
  alert_count: number;
}

const ZIEL_KM = 4;
const WARN_KM = 6;

function calcAmpel(km: number): string {
  if (km <= ZIEL_KM) return 'gruen';
  if (km <= WARN_KM) return 'gelb';
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

function TrendIcon({ trend, invert }: { trend: string; invert?: boolean }) {
  if (trend === 'steigend') return <TrendingUp   size={11} className={invert ? 'text-red-500'   : 'text-green-600'} />;
  if (trend === 'fallend')  return <TrendingDown size={11} className={invert ? 'text-green-600' : 'text-red-500'  } />;
  return                           <Minus        size={11} className="text-gray-400" />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f3', fahrer_name: 'Tim W.',  avg_km_lieferung: 7.3, lieferungen:  8, ampel: 'rot',   trend: 'steigend', alert: true  },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.', avg_km_lieferung: 5.1, lieferungen:  8, ampel: 'gelb',  trend: 'stabil',   alert: false },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',  avg_km_lieferung: 3.2, lieferungen: 11, ampel: 'gruen', trend: 'fallend',  alert: false },
    { fahrer_id: 'f4', fahrer_name: 'Anna B.', avg_km_lieferung: 2.8, lieferungen: 10, ampel: 'gruen', trend: 'fallend',  alert: false },
  ],
  team_avg_km: 4.6,
  alert_count: 1,
};

export function KitchenPhase2801KilometerEffizienzTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-kilometer-effizienz?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched = data.fahrer.map(f => ({ ...f, ampel: f.ampel || calcAmpel(f.avg_km_lieferung) }));
  // Absteigend (höchste km/Lieferung oben = schlechteste zuerst)
  const sorted   = [...enriched].sort((a, b) => b.avg_km_lieferung - a.avg_km_lieferung);
  const alerts   = enriched.filter(f => f.alert || f.avg_km_lieferung > WARN_KM);
  const hasAlert = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_avg_km);

  return (
    <div className={`rounded-xl border p-3 mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Navigation size={14} className="text-blue-500" />
          <span className="font-semibold text-xs text-gray-800">km-Effizienz Fahrer</span>
          {hasAlert && <AlertTriangle size={12} className="text-red-500" />}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${dotCls(teamAmpel)} text-white`}>
            Ø {data.team_avg_km} km
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
              <span>— Hohe Kilometerleistung! ({f.avg_km_lieferung} km)</span>
            </div>
          ))}

          {/* Fahrerliste kompakt */}
          {sorted.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
              <span className={`w-2 h-2 flex-shrink-0 rounded-full ${dotCls(f.ampel)}`} />
              <span className="text-xs text-gray-800 flex-1 truncate">{f.fahrer_name}</span>
              <span className="text-[10px] text-gray-400">{f.lieferungen} Lief.</span>
              {/* steigend = schlechter → invertiert */}
              <TrendIcon trend={f.trend} invert />
              <span className={`text-xs font-semibold ${textCls(f.ampel)}`}>{f.avg_km_lieferung} km</span>
            </div>
          ))}

          {/* Ziel */}
          <div className="text-[10px] text-gray-400 text-center pt-1">
            Ziel ≤{ZIEL_KM} km — {data.alert_count === 0 ? 'Alle im Zielbereich ✓' : `${data.alert_count} Fahrer über ${WARN_KM} km`}
          </div>
        </div>
      )}
    </div>
  );
}
