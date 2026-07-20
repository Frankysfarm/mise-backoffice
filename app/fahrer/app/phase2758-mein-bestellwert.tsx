'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ShoppingBag, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_bestellwert_eur: number;
  touren: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  alert: string | null;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_bestellwert_eur: number;
}

const ZIEL = 25;
const WARN = 15;
const MAX  = 50;

function calcAmpel(eur: number): 'gruen' | 'gelb' | 'rot' {
  if (eur >= ZIEL) return 'gruen';
  if (eur >= WARN) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(eur: number, alert: string | null): string {
  if (alert) return `Dein Ø Bestellwert ist niedrig (${eur}€/Tour). Schau, ob du Gebiete mit höherem Bestellvolumen belieferst — das steigert deinen Wert.`;
  if (eur >= ZIEL) return `Super — ${eur}€ Ø Bestellwert! Du lieferst Aufträge mit hohem Wert. Weiter so!`;
  return `${eur}€ Ø Bestellwert. Ziel ist ≥${ZIEL}€ — versuche, auch größere Bestellungen anzunehmen.`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK_ID = 'mock-me';
const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: MOCK_ID, fahrer_name: 'Ich',     avg_bestellwert_eur: 21.8, touren:  8, trend: 'fallend',  alert: null,                   rang: 2 },
    { fahrer_id: 'f1',    fahrer_name: 'Max M.',   avg_bestellwert_eur: 32.5, touren: 10, trend: 'steigend', alert: null,                   rang: 1 },
    { fahrer_id: 'f4',    fahrer_name: 'Julia F.', avg_bestellwert_eur: 11.2, touren:  5, trend: 'fallend',  alert: 'Niedriger Bestellwert!', rang: 4 },
  ],
  team_avg_bestellwert_eur: 20.9,
};

export function FahrerPhase2758MeinBestellwert({
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
      fetch(`/api/delivery/admin/fahrer-bestellwert-tour?location_id=${locationId}`)
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

  const ampel   = calcAmpel(me.avg_bestellwert_eur);
  const cls     = ampelCls(ampel);
  const fill    = Math.min(100, (me.avg_bestellwert_eur / MAX) * 100);
  const zielPct = (ZIEL / MAX) * 100;

  return (
    <div className={`rounded-xl border ${cls.bg} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <ShoppingBag size={16} className={cls.text} />
          <span className="font-semibold text-sm text-gray-800">Mein Ø Bestellwert</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Hauptwert */}
          <div className="text-center">
            <div className={`text-4xl font-black ${cls.big}`}>{me.avg_bestellwert_eur}€</div>
            <div className="text-xs text-gray-500 mt-0.5">Ø Bestellwert je Tour heute</div>
          </div>

          {/* Balken */}
          <div className="relative h-4 rounded-full bg-gray-200">
            <div
              className="absolute top-0 h-full w-0.5 bg-green-600 z-10"
              style={{ left: `${zielPct}%` }}
              title={`Ziel: ≥${ZIEL}€`}
            />
            <div
              className={`absolute top-0 left-0 h-full rounded-full ${cls.bar}`}
              style={{ width: `${fill}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>0€</span>
            <span>Ziel ≥{ZIEL}€</span>
            <span>{MAX}€</span>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="rounded-lg bg-white border border-gray-200 px-1 py-2">
              <div className="text-[9px] text-gray-400 mb-0.5">Trend</div>
              <div className="flex justify-center"><TrendIcon trend={me.trend} /></div>
            </div>
            <div className="rounded-lg bg-white border border-gray-200 px-1 py-2">
              <div className="text-[9px] text-gray-400 mb-0.5">Ziel</div>
              <div className="text-xs font-bold text-gray-700">≥{ZIEL}€</div>
            </div>
            <div className="rounded-lg bg-white border border-gray-200 px-1 py-2">
              <div className="text-[9px] text-gray-400 mb-0.5">Ampel</div>
              <div className={`text-xs font-bold ${cls.text}`}>●</div>
            </div>
            <div className="rounded-lg bg-white border border-gray-200 px-1 py-2">
              <div className="text-[9px] text-gray-400 mb-0.5">Team-Ø</div>
              <div className="text-xs font-bold text-gray-700">{data.team_avg_bestellwert_eur}€</div>
            </div>
          </div>

          {/* Coaching-Tipp */}
          <div className={`rounded-lg px-3 py-2 text-xs ${cls.text} bg-white border ${ampel === 'rot' ? 'border-red-200' : ampel === 'gelb' ? 'border-amber-200' : 'border-green-200'}`}>
            {coaching(me.avg_bestellwert_eur, me.alert)}
          </div>

          {/* Rang */}
          <div className="text-center text-[10px] text-gray-400">
            Rang <span className="font-bold text-gray-600">#{me.rang}</span> · {me.touren} Touren heute
          </div>
        </div>
      )}
    </div>
  );
}
