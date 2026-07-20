'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, RotateCcw, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  rate: number;
  puenktlich: number;
  gesamt: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  alert: string | null;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_rate: number;
}

const ZIEL = 90;
const WARN = 70;

function calcAmpel(rate: number): 'gruen' | 'gelb' | 'rot' {
  if (rate >= ZIEL) return 'gruen';
  if (rate >= WARN) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(rate: number, alert: string | null): string {
  if (alert) return `Deine Rückkehr-Zuverlässigkeit ist zu niedrig (${rate}%). Versuche, deine Schichten pünktlich zu beenden.`;
  if (rate >= ZIEL) return `Ausgezeichnet — ${rate}% Pünktlichkeit! Du beendest deine Schichten zuverlässig. Weiter so!`;
  return `${rate}% Pünktlichkeitsrate. Ziel ist ≥${ZIEL}% — achte darauf, deine Schicht rechtzeitig zu beenden.`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK_ID = 'mock-me';
const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: MOCK_ID, fahrer_name: 'Ich',     rate: 75, puenktlich: 15, gesamt: 20, trend: 'stabil',   alert: null,                      rang: 3 },
    { fahrer_id: 'f1',    fahrer_name: 'Max M.',   rate: 95, puenktlich: 19, gesamt: 20, trend: 'steigend', alert: null,                      rang: 1 },
    { fahrer_id: 'f4',    fahrer_name: 'Julia F.', rate: 60, puenktlich: 12, gesamt: 20, trend: 'fallend',  alert: 'Rückkehr unzuverlässig!', rang: 4 },
  ],
  team_avg_rate: 77.5,
};

export function FahrerPhase2733MeineRueckkehrZuverlaessigkeit({
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
      fetch(`/api/delivery/admin/fahrer-rueckkehr-zuverlaessigkeit?location_id=${locationId}`)
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

  const ampel   = calcAmpel(me.rate);
  const cls     = ampelCls(ampel);
  const fill    = Math.min(100, me.rate);
  const zielPct = ZIEL;

  return (
    <div className={`rounded-xl border ${cls.bg} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <RotateCcw size={16} className={cls.text} />
          <span className="font-semibold text-sm text-gray-800">Meine Rückkehr-Zuverlässigkeit</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="text-center">
            <div className={`text-4xl font-black ${cls.big}`}>{me.rate}%</div>
            <div className="text-xs text-gray-500 mt-0.5">Pünktliche Schichtenden</div>
          </div>

          <div className="relative h-4 rounded-full bg-gray-200">
            <div
              className="absolute top-0 h-full w-0.5 bg-green-600 z-10"
              style={{ left: `${zielPct}%` }}
              title={`Ziel: ≥${ZIEL}%`}
            />
            <div
              className={`absolute top-0 left-0 h-full rounded-full ${cls.bar}`}
              style={{ width: `${fill}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>0%</span>
            <span className="text-green-600 font-medium">Ziel ≥{ZIEL}%</span>
            <span>100%</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              {
                label: 'Trend',
                value: me.trend === 'steigend' ? '↑ Besser' : me.trend === 'fallend' ? '↓ Schlechter' : '→ Stabil',
                c: me.trend === 'steigend' ? 'text-green-600' : me.trend === 'fallend' ? 'text-red-500' : 'text-gray-500',
              },
              { label: 'Ziel',   value: `≥${ZIEL}%`,                              c: 'text-gray-600' },
              { label: 'Ampel',  value: ampel === 'gruen' ? 'Grün ✓' : ampel === 'gelb' ? 'Gelb ⚠' : 'Rot ✗', c: cls.text },
              { label: 'Team-Ø', value: `${data.team_avg_rate.toFixed(1)}%`,       c: 'text-gray-600' },
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
              <span>{coaching(me.rate, me.alert)}</span>
            </div>
          </div>

          <div className="text-center text-[10px] text-gray-400">
            Rang {me.rang}/{data.fahrer.length} · {me.puenktlich}/{me.gesamt} Schichten pünktlich (letzte 7 Tage)
          </div>
        </div>
      )}
    </div>
  );
}
