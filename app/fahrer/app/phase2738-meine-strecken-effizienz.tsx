'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Route, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  km_pro_tour: number;
  touren: number;
  gesamt_km: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  alert: string | null;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_km_pro_tour: number;
}

const ZIEL = 5;
const WARN = 8;

function calcAmpel(km: number): 'gruen' | 'gelb' | 'rot' {
  if (km <= ZIEL) return 'gruen';
  if (km <= WARN) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(km: number, alert: string | null): string {
  if (alert) return `Deine km-Rate ist zu hoch (${km} km/Tour). Versuche, Touren mit kürzeren Wegen zu bündeln.`;
  if (km <= ZIEL) return `Top — nur ${km} km/Tour! Deine Routen sind sehr effizient. Weiter so!`;
  return `${km} km/Tour. Ziel ist ≤${ZIEL} km — achte auf eine kompaktere Routenplanung.`;
}

function TrendIcon({ trend }: { trend: string }) {
  // steigend = schlechter (mehr km), daher rot; fallend = besser, daher grün
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-green-600" />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK_ID = 'mock-me';
const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: MOCK_ID, fahrer_name: 'Ich',     km_pro_tour: 5.5, touren: 8,  gesamt_km: 44,   trend: 'steigend', alert: null,                       rang: 2 },
    { fahrer_id: 'f1',    fahrer_name: 'Max M.',   km_pro_tour: 3.8, touren: 10, gesamt_km: 38,   trend: 'fallend',  alert: null,                       rang: 1 },
    { fahrer_id: 'f4',    fahrer_name: 'Julia F.', km_pro_tour: 9.4, touren:  5, gesamt_km: 47,   trend: 'steigend', alert: 'Hohe Kilometer pro Tour!', rang: 4 },
  ],
  team_avg_km_pro_tour: 6.5,
};

export function FahrerPhase2738MeineStreckenEffizienz({
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
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-strecken-effizienz?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const me = driverId
    ? (data.fahrer.find((f: FahrerEntry) => f.fahrer_id === driverId) ?? data.fahrer[0])
    : data.fahrer[0];
  if (!me) return null;

  const ampel   = calcAmpel(me.km_pro_tour);
  const cls     = ampelCls(ampel);
  const MAX     = 12;
  const fill    = Math.min(100, (me.km_pro_tour / MAX) * 100);
  const zielPct = (ZIEL / MAX) * 100;

  return (
    <div className={`rounded-xl border ${cls.bg} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Route size={16} className={cls.text} />
          <span className="font-semibold text-sm text-gray-800">Meine Strecken-Effizienz</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Hauptwert */}
          <div className="text-center">
            <div className={`text-4xl font-black ${cls.big}`}>{me.km_pro_tour} km</div>
            <div className="text-xs text-gray-500 mt-0.5">pro Tour heute</div>
          </div>

          {/* Balken */}
          <div className="relative h-4 rounded-full bg-gray-200">
            <div
              className="absolute top-0 h-full w-0.5 bg-green-600 z-10"
              style={{ left: `${zielPct}%` }}
              title={`Ziel: ≤${ZIEL} km/Tour`}
            />
            <div
              className={`absolute top-0 left-0 h-full rounded-full ${cls.bar}`}
              style={{ width: `${fill}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>0 km</span>
            <span>Ziel ≤{ZIEL} km</span>
            <span>{MAX} km</span>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="rounded-lg bg-white border border-gray-200 px-1 py-2">
              <div className="text-[9px] text-gray-400 mb-0.5">Trend</div>
              <div className="flex justify-center"><TrendIcon trend={me.trend} /></div>
            </div>
            <div className="rounded-lg bg-white border border-gray-200 px-1 py-2">
              <div className="text-[9px] text-gray-400 mb-0.5">Ziel</div>
              <div className="text-xs font-bold text-gray-700">≤{ZIEL} km</div>
            </div>
            <div className="rounded-lg bg-white border border-gray-200 px-1 py-2">
              <div className="text-[9px] text-gray-400 mb-0.5">Ampel</div>
              <div className={`text-xs font-bold ${cls.text}`}>{ampel === 'gruen' ? '●' : ampel === 'gelb' ? '●' : '●'}</div>
            </div>
            <div className="rounded-lg bg-white border border-gray-200 px-1 py-2">
              <div className="text-[9px] text-gray-400 mb-0.5">Team-Ø</div>
              <div className="text-xs font-bold text-gray-700">{data.team_avg_km_pro_tour} km</div>
            </div>
          </div>

          {/* Coaching-Tipp */}
          <div className={`rounded-lg px-3 py-2 text-xs ${cls.text} bg-white border ${cls.bg.includes('red') ? 'border-red-200' : cls.bg.includes('amber') ? 'border-amber-200' : 'border-green-200'}`}>
            {coaching(me.km_pro_tour, me.alert)}
          </div>

          {/* Rang */}
          <div className="text-center text-[10px] text-gray-400">
            Rang <span className="font-bold text-gray-600">#{me.rang}</span> · {me.touren} Touren · {me.gesamt_km} km gesamt
          </div>
        </div>
      )}
    </div>
  );
}
