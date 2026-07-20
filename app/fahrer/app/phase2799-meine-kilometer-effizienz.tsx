'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Navigation } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_km_lieferung: number;
  total_km: number;
  lieferungen: number;
  ampel: string;
  trend: string;
  trend_delta: number;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_km: number;
}

const ZIEL_KM = 4;
const WARN_KM = 6;
const MAX_KM  = 10;

function calcAmpel(km: number): string {
  if (km <= ZIEL_KM) return 'gruen';
  if (km <= WARN_KM) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(km: number): string {
  if (km <= ZIEL_KM) return `${km} km/Lieferung — sehr effizient! Du fährst kurze Wege und sparst Zeit & Sprit.`;
  if (km <= WARN_KM) return `${km} km/Lieferung — okay. Versuche, unter 4 km/Lieferung zu kommen!`;
  return `${km} km/Lieferung — zu hoch. Bitte prüfe deine Routen — kürzere Wege sparen Zeit und Kosten.`;
}

function TrendIcon({ trend, invert }: { trend: string; invert?: boolean }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className={invert ? 'text-red-500'   : 'text-green-600'} />;
  if (trend === 'fallend')  return <TrendingDown size={14} className={invert ? 'text-green-600' : 'text-red-500'  } />;
  return                           <Minus        size={14} className="text-gray-400" />;
}

const MOCK_ID = 'mock-me';
const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: MOCK_ID, fahrer_name: 'Ich',    avg_km_lieferung: 3.2, total_km: 35.2, lieferungen: 11, ampel: 'gruen', trend: 'fallend',  trend_delta: -0.3, rang: 2 },
    { fahrer_id: 'f2',   fahrer_name: 'Sara K.', avg_km_lieferung: 5.1, total_km: 40.8, lieferungen:  8, ampel: 'gelb',  trend: 'steigend', trend_delta:  0.3, rang: 3 },
    { fahrer_id: 'f3',   fahrer_name: 'Tim W.',  avg_km_lieferung: 7.3, total_km: 58.4, lieferungen:  8, ampel: 'rot',   trend: 'steigend', trend_delta:  0.4, rang: 4 },
  ],
  team_avg_km: 4.6,
};

export function FahrerPhase2799MeineKilometerEffizienz({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!isOnline || !locationId) { setData(MOCK); return; }
    const load = () => {
      const url = driverId
        ? `/api/delivery/admin/fahrer-kilometer-effizienz?location_id=${locationId}&driver_id=${driverId}`
        : `/api/delivery/admin/fahrer-kilometer-effizienz?location_id=${locationId}`;
      fetch(url)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    };
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [isOnline, locationId, driverId]);

  if (!data) return null;

  const me = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const ampel  = me.ampel || calcAmpel(me.avg_km_lieferung);
  const cls    = ampelCls(ampel);
  const km     = me.avg_km_lieferung;
  const barPct = Math.min((km / MAX_KM) * 100, 100);
  const zielPct = (ZIEL_KM / MAX_KM) * 100;
  const tip    = coaching(km);
  const headerBg = ampel === 'rot' ? 'border-red-300 bg-red-50' : ampel === 'gelb' ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50';

  return (
    <div className={`rounded-xl border p-4 mb-4 ${headerBg}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Navigation size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800">Meine Kilometer-Effizienz</span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Hauptwert */}
          <div className="text-center">
            <div className={`text-4xl font-bold ${cls.big}`}>{km} km</div>
            <div className="text-xs text-gray-500 mt-1">Ø pro Lieferung · {me.lieferungen} Lief. · {me.total_km} km gesamt</div>
            <div className="flex items-center justify-center gap-1 mt-1">
              {/* steigend = schlechter → invertiert */}
              <TrendIcon trend={me.trend} invert />
              <span className="text-xs text-gray-500">
                {me.trend_delta > 0 ? '+' : ''}{me.trend_delta} km vs. gestern
              </span>
            </div>
          </div>

          {/* Balken 0–10 km mit Ziel-Linie 4 km */}
          <div>
            <div className="relative h-3 bg-gray-200 rounded-full overflow-visible">
              <div className={`h-full rounded-full ${cls.bar}`} style={{ width: `${barPct}%` }} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-blue-400" style={{ left: `${zielPct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>0 km</span>
              <span className="text-blue-500">Ziel {ZIEL_KM} km</span>
              <span>{MAX_KM} km</span>
            </div>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Ziel',    val: `≤${ZIEL_KM} km` },
              { label: 'Team-Ø', val: `${data.team_avg_km} km` },
              { label: 'Ampel',  val: ampel === 'gruen' ? '🟢 Effizient' : ampel === 'gelb' ? '🟡 OK' : '🔴 Zu hoch' },
              { label: 'Touren', val: `${me.lieferungen} Lief.` },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-lg p-2 text-center border border-gray-100">
                <div className="text-[10px] text-gray-500">{k.label}</div>
                <div className="text-xs font-semibold text-gray-800">{k.val}</div>
              </div>
            ))}
          </div>

          {/* Rang */}
          <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
            <span className="text-xs text-gray-500">Rang </span>
            <span className="text-sm font-bold text-gray-800">#{me.rang}</span>
            <span className="text-xs text-gray-500"> von {data.fahrer.length} Fahrern</span>
          </div>

          {/* Coaching-Tipp */}
          <div className={`rounded-lg p-2 text-xs ${cls.bg} ${cls.text}`}>
            {tip}
          </div>
        </div>
      )}
    </div>
  );
}
