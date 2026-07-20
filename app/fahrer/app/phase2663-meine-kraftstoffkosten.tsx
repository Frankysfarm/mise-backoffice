'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Fuel, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  kosten_heute: number;
  avg_kosten_tour: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  touren_heute: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_kosten: number;
}

function ampelVon(kosten: number): 'gruen' | 'gelb' | 'rot' {
  if (kosten <= 5)  return 'gruen';
  if (kosten <= 10) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(ampel: string): string {
  if (ampel === 'gruen') return 'Super! Deine Kraftstoffkosten sind im grünen Bereich — effiziente Routen zahlen sich aus!';
  if (ampel === 'gelb')  return 'Etwas erhöhte Kosten. Versuche Touren besser zu bündeln und unnötige Umwege zu vermeiden.';
  return 'Kraftstoffkosten zu hoch! Bitte Dispatch kontaktieren — Routenoptimierung dringend empfohlen.';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-green-600" />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK_DRIVER_ID = 'mock-me';
const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: MOCK_DRIVER_ID, fahrer_name: 'Ich', kosten_heute: 8.09, avg_kosten_tour: 1.01, trend: 'fallend', trend_delta: -0.62, touren_heute: 8 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.', kosten_heute: 11.42, avg_kosten_tour: 1.04, trend: 'steigend', trend_delta: 1.44, touren_heute: 11 },
  ],
  team_avg_kosten: 9.75,
};

export function FahrerPhase2663MeineKraftstoffkosten({
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
      fetch(`/api/delivery/admin/fahrer-kraftstoffkosten?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const me = driverId
    ? (data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0])
    : data.fahrer[0];

  if (!me) return null;

  const ampel   = ampelVon(me.kosten_heute);
  const cls     = ampelCls(ampel);
  const MAX     = 15;
  const ZIEL    = 5;
  const fill    = Math.min(100, (me.kosten_heute / MAX) * 100);
  const goalPct = Math.min(100, (ZIEL / MAX) * 100);

  return (
    <div className={`rounded-xl border ${cls.bg} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Fuel size={16} className="text-orange-500" />
          <span className="font-semibold text-sm text-gray-800">Meine Kraftstoffkosten</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${cls.text}`}>{me.kosten_heute.toFixed(2)} €</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className={`text-4xl font-black text-center py-2 ${cls.big}`}>
            {me.kosten_heute.toFixed(2)} <span className="text-xl font-semibold">€</span>
            <div className="text-xs font-normal text-gray-500 mt-1">Kraftstoff heute gesamt</div>
          </div>

          <div className="relative h-4 rounded-full bg-gray-200">
            <div className={`absolute top-0 left-0 h-full rounded-full ${cls.bar}`} style={{ width: `${fill}%` }} />
            <div
              className="absolute top-0 h-full border-l-2 border-dashed border-green-500"
              style={{ left: `${goalPct}%` }}
              title="Ziel ≤5€"
            />
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <TrendIcon trend={me.trend} />
                <span className="text-sm font-bold text-gray-700">
                  {me.trend_delta > 0 ? '+' : ''}{me.trend_delta.toFixed(2)}
                </span>
              </div>
              <div className="text-xs text-gray-500">Trend</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-sm font-bold text-green-600">≤5 €</div>
              <div className="text-xs text-gray-500">Ziel</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className={`text-sm font-bold ${cls.text}`}>
                {ampel === 'gruen' ? '🟢' : ampel === 'gelb' ? '🟡' : '🔴'}
              </div>
              <div className="text-xs text-gray-500">Ampel</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-sm font-bold text-gray-700">{data.team_avg_kosten.toFixed(2)}</div>
              <div className="text-xs text-gray-500">Team Ø</div>
            </div>
          </div>

          <div className={`rounded-lg px-3 py-2 text-xs border ${cls.bg} ${cls.text}`}>
            💡 {coaching(ampel)}
          </div>

          <div className="text-xs text-gray-400 text-right">alle 30 Min aktualisiert</div>
        </div>
      )}
    </div>
  );
}
