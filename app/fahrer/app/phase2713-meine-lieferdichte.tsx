'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  dichte: number;
  stopps_heute: number;
  km_heute: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  alert: string | null;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_dichte: number;
}

const ZIEL = 0.3;
const MAX  = 0.6;

function calcAmpel(d: number): 'gruen' | 'gelb' | 'rot' {
  if (d >= ZIEL)  return 'gruen';
  if (d >= 0.15) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(d: number, alert: string | null): string {
  if (alert) return 'Deine Lieferdichte ist zu gering. Plane kürzere Routen mit mehr Stopps in einem engen Gebiet.';
  if (d >= ZIEL) return `Super — ${d.toFixed(2)} Stopps/km! Du nutzt deine Route sehr effizient.`;
  return `${d.toFixed(2)} Stopps/km. Ziel ist ≥${ZIEL} — versuche Stopps geografisch enger zu bündeln.`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK_ID = 'mock-me';
const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: MOCK_ID, fahrer_name: 'Ich',     dichte: 0.24, stopps_heute:  7, km_heute: 29.2, trend: 'steigend', alert: null },
    { fahrer_id: 'f2',   fahrer_name: 'Max M.',   dichte: 0.42, stopps_heute: 13, km_heute: 31.0, trend: 'steigend', alert: null },
  ],
  team_avg_dichte: 0.28,
};

export function FahrerPhase2713MeineLieferdichte({
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
      fetch(`/api/delivery/admin/fahrer-lieferdichte?location_id=${locationId}`)
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

  const ampel   = calcAmpel(me.dichte);
  const cls     = ampelCls(ampel);
  const fill    = Math.min(100, (me.dichte / MAX) * 100);
  const zielPct = (ZIEL / MAX) * 100;
  const rang    = [...data.fahrer].sort((a, b) => b.dichte - a.dichte).findIndex((f: FahrerEntry) => f.fahrer_id === me.fahrer_id) + 1;

  return (
    <div className={`rounded-xl border ${cls.bg} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <MapPin size={16} className={cls.text} />
          <span className="font-semibold text-sm text-gray-800">Meine Lieferdichte</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="text-center">
            <div className={`text-4xl font-black ${cls.big}`}>{me.dichte.toFixed(2)}</div>
            <div className="text-xs text-gray-500 mt-0.5">Stopps / km</div>
          </div>

          <div className="relative h-4 rounded-full bg-gray-200">
            <div
              className="absolute top-0 h-full w-0.5 bg-green-600 z-10"
              style={{ left: `${zielPct}%` }}
              title={`Ziel: ≥${ZIEL} Stopps/km`}
            />
            <div
              className={`absolute top-0 left-0 h-full rounded-full ${cls.bar}`}
              style={{ width: `${fill}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>0</span>
            <span className="text-green-600 font-medium">Ziel {ZIEL}/km</span>
            <span>{MAX}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Trend',   value: me.trend === 'steigend' ? '↑ Steigend' : me.trend === 'fallend' ? '↓ Fallend' : '→ Stabil', c: me.trend === 'steigend' ? 'text-green-600' : me.trend === 'fallend' ? 'text-red-500' : 'text-gray-500' },
              { label: 'Ziel',    value: `≥${ZIEL}/km`,               c: 'text-gray-600' },
              { label: 'Ampel',   value: ampel === 'gruen' ? 'Grün ✓' : ampel === 'gelb' ? 'Gelb ⚠' : 'Rot ✗', c: cls.text },
              { label: 'Team-Ø', value: `${data.team_avg_dichte.toFixed(2)}/km`, c: 'text-gray-600' },
            ].map(({ label, value, c }) => (
              <div key={label} className="rounded-lg bg-white/60 border border-gray-100 p-2 text-center">
                <div className="text-[10px] text-gray-400">{label}</div>
                <div className={`text-xs font-bold ${c}`}>{value}</div>
              </div>
            ))}
          </div>

          <div className={`rounded-lg px-3 py-2 text-xs ${cls.text} bg-white/50 border ${cls.bg.split(' ')[1]}`}>
            <div className="flex items-start gap-1.5">
              <TrendIcon trend={me.trend} />
              <span>{coaching(me.dichte, me.alert)}</span>
            </div>
          </div>

          <div className="text-center text-[10px] text-gray-400">
            Rang {rang}/{data.fahrer.length} · {me.stopps_heute} Stopps · {me.km_heute.toFixed(1)} km
          </div>
        </div>
      )}
    </div>
  );
}
