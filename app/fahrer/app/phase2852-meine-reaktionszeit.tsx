'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_min: number;
  touren_heute: number;
  ampel: string;
  trend: string;
  trend_delta: number;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_durchschnitt: number;
}

const ZIEL_MIN = 3;
const WARN_MIN = 7;
const MAX_BAR  = 10;

function calcAmpel(min: number): string {
  if (min < ZIEL_MIN) return 'gruen';
  if (min <= WARN_MIN) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(min: number): string {
  if (min < ZIEL_MIN) return `${min.toFixed(1)} Min — Blitzschnell! Du reagierst sofort. Weiter so!`;
  if (min <= WARN_MIN) return `${min.toFixed(1)} Min — Im gelben Bereich. Noch ${(min - ZIEL_MIN).toFixed(1)} Min über Ziel. Nimm Touren schneller an.`;
  return `${min.toFixed(1)} Min — Langsame Reaktion! Bitte Aufträge schneller annehmen (Ziel: <${ZIEL_MIN} Min).`;
}

function TrendIcon({ trend }: { trend: string }) {
  // Invertiert: fallend=grün (weniger Min=besser), steigend=rot
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-green-600" />;
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK_ME: FahrerEntry = {
  fahrer_id: 'mock-me', fahrer_name: 'Ich', avg_min: 4.5, touren_heute: 9,
  ampel: 'gelb', trend: 'steigend', trend_delta: 0.5, rang: 2,
};
const MOCK: ApiData = { fahrer: [MOCK_ME], team_durchschnitt: 4.5 };

export function FahrerPhase2852MeineReaktionszeit({
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
    const params = new URLSearchParams({ location_id: locationId });
    if (driverId) params.set('driver_id', driverId);
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-reaktionszeit?${params}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [isOnline, locationId, driverId]);

  if (!data) return null;

  const me = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const avg_min   = me.avg_min;
  const ampel     = calcAmpel(avg_min);
  const cls       = ampelCls(ampel);
  const delta     = me.trend_delta;
  const tip       = coaching(avg_min);
  const barPct    = Math.min((avg_min / MAX_BAR) * 100, 100);
  const zielPct   = (ZIEL_MIN / MAX_BAR) * 100;
  const headerBg  = ampel === 'rot' ? 'border-red-300 bg-red-50' : ampel === 'gelb' ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50';

  return (
    <div className={`rounded-xl border p-4 mb-4 ${headerBg}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-yellow-500" />
          <span className="font-semibold text-sm text-gray-800">Meine Reaktionszeit</span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="text-center">
            <div className={`text-4xl font-bold ${cls.big}`}>{avg_min.toFixed(1)} Min</div>
            <div className="text-xs text-gray-500 mt-1">{me.touren_heute} Touren heute</div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendIcon trend={me.trend} />
              <span className="text-xs text-gray-500">
                {delta >= 0 ? '+' : ''}{delta.toFixed(1)} Min vs. letzte Woche
              </span>
            </div>
          </div>

          <div>
            <div className="relative h-3 bg-gray-200 rounded-full overflow-visible">
              <div className={`h-full rounded-full ${cls.bar}`} style={{ width: `${barPct}%` }} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-indigo-400" style={{ left: `${zielPct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>0</span>
              <span className="text-indigo-500">Ziel {ZIEL_MIN} Min</span>
              <span>{MAX_BAR} Min</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Trend',  val: me.trend === 'fallend' ? '↓ Schneller' : me.trend === 'steigend' ? '↑ Langsamer' : '→ Stabil' },
              { label: 'Ziel',   val: `<${ZIEL_MIN} Min` },
              { label: 'Ampel',  val: ampel === 'gruen' ? '🟢 Im Ziel' : ampel === 'gelb' ? '🟡 Knapp' : '🔴 Zu langsam' },
              { label: 'Touren', val: `${me.touren_heute}` },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-lg p-2 text-center border border-gray-100">
                <div className="text-[10px] text-gray-500">{k.label}</div>
                <div className="text-xs font-semibold text-gray-800">{k.val}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-[10px] text-gray-500">Team-Ø heute</div>
              <div className="text-xs font-bold text-gray-800">{data.team_durchschnitt.toFixed(1)} Min</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-[10px] text-gray-500">Rang (Reaktionszeit)</div>
              <div className="text-xs font-bold text-gray-800">#{me.rang}</div>
            </div>
          </div>

          <div className={`rounded-lg p-2 text-xs ${cls.bg} ${cls.text}`}>{tip}</div>
        </div>
      )}
    </div>
  );
}
