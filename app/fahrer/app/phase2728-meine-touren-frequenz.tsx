'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  frequenz: number;
  touren_heute: number;
  schicht_stunden: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  alert: string | null;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_frequenz: number;
}

const ZIEL = 1.5;
const WARN = 1.0;
const MAX  = 3.0;

function calcAmpel(freq: number): 'gruen' | 'gelb' | 'rot' {
  if (freq >= ZIEL) return 'gruen';
  if (freq >= WARN) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(freq: number, alert: string | null): string {
  if (alert) return `Deine Touren-Frequenz ist zu niedrig (${freq.toFixed(1)}/h). Versuche, Touren schneller abzuschließen und dich direkt für die nächste zu melden.`;
  if (freq >= ZIEL) return `Starke Frequenz — ${freq.toFixed(1)}/h! Du arbeitest sehr effizient. Weiter so!`;
  return `${freq.toFixed(1)}/h Touren-Frequenz. Ziel ist ≥${ZIEL}/h — versuche, zwischen den Touren weniger Leerlauf zu haben.`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK_ID = 'mock-me';
const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: MOCK_ID, fahrer_name: 'Ich',     frequenz: 1.2, touren_heute: 4, schicht_stunden: 3.3, trend: 'stabil',  alert: null,                   rang: 3 },
    { fahrer_id: 'f1',    fahrer_name: 'Max M.',   frequenz: 2.1, touren_heute: 7, schicht_stunden: 3.3, trend: 'steigend', alert: null,                  rang: 1 },
    { fahrer_id: 'f4',    fahrer_name: 'Julia F.', frequenz: 0.8, touren_heute: 3, schicht_stunden: 3.8, trend: 'fallend', alert: 'Frequenz zu niedrig!', rang: 4 },
  ],
  team_avg_frequenz: 1.4,
};

export function FahrerPhase2728MeineTourenFrequenz({
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
      fetch(`/api/delivery/admin/fahrer-touren-frequenz?location_id=${locationId}`)
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

  const ampel   = calcAmpel(me.frequenz);
  const cls     = ampelCls(ampel);
  const fill    = Math.min(100, (me.frequenz / MAX) * 100);
  const zielPct = (ZIEL / MAX) * 100;

  return (
    <div className={`rounded-xl border ${cls.bg} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Zap size={16} className={cls.text} />
          <span className="font-semibold text-sm text-gray-800">Meine Touren-Frequenz</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="text-center">
            <div className={`text-4xl font-black ${cls.big}`}>{me.frequenz.toFixed(1)}/h</div>
            <div className="text-xs text-gray-500 mt-0.5">Touren pro Stunde</div>
          </div>

          <div className="relative h-4 rounded-full bg-gray-200">
            <div
              className="absolute top-0 h-full w-0.5 bg-green-600 z-10"
              style={{ left: `${zielPct}%` }}
              title={`Ziel: ≥${ZIEL}/h`}
            />
            <div
              className={`absolute top-0 left-0 h-full rounded-full ${cls.bar}`}
              style={{ width: `${fill}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>0</span>
            <span className="text-green-600 font-medium">Ziel ≥{ZIEL}/h</span>
            <span>{MAX}/h</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              {
                label: 'Trend',
                value: me.trend === 'steigend' ? '↑ Besser' : me.trend === 'fallend' ? '↓ Schlechter' : '→ Stabil',
                c: me.trend === 'steigend' ? 'text-green-600' : me.trend === 'fallend' ? 'text-red-500' : 'text-gray-500',
              },
              { label: 'Ziel',   value: `≥${ZIEL}/h`,                           c: 'text-gray-600' },
              { label: 'Ampel',  value: ampel === 'gruen' ? 'Grün ✓' : ampel === 'gelb' ? 'Gelb ⚠' : 'Rot ✗', c: cls.text },
              { label: 'Team-Ø', value: `${data.team_avg_frequenz.toFixed(1)}/h`, c: 'text-gray-600' },
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
              <span>{coaching(me.frequenz, me.alert)}</span>
            </div>
          </div>

          <div className="text-center text-[10px] text-gray-400">
            Rang {me.rang}/{data.fahrer.length} · {me.touren_heute} Touren · {me.schicht_stunden.toFixed(1)}h Schicht
          </div>
        </div>
      )}
    </div>
  );
}
