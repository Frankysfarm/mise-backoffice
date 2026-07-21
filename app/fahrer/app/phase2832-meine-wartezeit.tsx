'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_wartezeit_min: number;
  touren_anzahl: number;
  max_wartezeit_min: number;
  ampel: string;
  trend: string;
  trend_delta: number;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_wartezeit_min: number;
  alert_count: number;
}

const ZIEL_MIN  = 3;
const ALERT_MIN = 6;

function calcAmpel(min: number): string {
  if (min > ALERT_MIN) return 'rot';
  if (min > ZIEL_MIN)  return 'gelb';
  return 'gruen';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(min: number): string {
  if (min <= ZIEL_MIN)  return `${min.toFixed(1)} Min — Sehr gut! Kurze Wartezeit. Weiter so!`;
  if (min <= ALERT_MIN) return `${min.toFixed(1)} Min — Im gelben Bereich. Ziel: ≤${ZIEL_MIN} Min Wartezeit.`;
  return `${min.toFixed(1)} Min — Lange Wartezeit! Bitte frühzeitig beim Restaurant ankündigen. Ziel: ≤${ZIEL_MIN} Min.`;
}

// Invertiert: steigend=rot (länger=schlechter), fallend=grün
function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-green-600" />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK_ID = 'mock-me';
const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: MOCK_ID, fahrer_name: 'Ich',   avg_wartezeit_min: 2.8, touren_anzahl: 7, max_wartezeit_min: 5.0, ampel: 'gruen', trend: 'fallend',  trend_delta: -0.8, rang: 1 },
    { fahrer_id: 'f2',    fahrer_name: 'Sara K.', avg_wartezeit_min: 4.8, touren_anzahl: 7, max_wartezeit_min: 9.0, ampel: 'gelb',  trend: 'stabil',   trend_delta:  0.0, rang: 2 },
    { fahrer_id: 'f3',    fahrer_name: 'Tim B.',  avg_wartezeit_min: 8.5, touren_anzahl: 11, max_wartezeit_min: 14.0, ampel: 'rot', trend: 'steigend', trend_delta:  2.7, rang: 3 },
  ],
  team_avg_wartezeit_min: 4.7,
  alert_count: 1,
};

export function FahrerPhase2832MeineWartezeit({
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
      fetch(`/api/delivery/admin/fahrer-wartezeit?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [isOnline, locationId]);

  if (!data) return null;

  const me = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const min     = me.avg_wartezeit_min;
  const ampel   = calcAmpel(min);
  const cls     = ampelCls(ampel);
  const barPct  = Math.min((min / 15) * 100, 100);
  const zielPct = Math.min((ZIEL_MIN / 15) * 100, 100);
  const tip     = coaching(min);
  const headerBg = ampel === 'rot' ? 'border-red-300 bg-red-50' : ampel === 'gelb' ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50';
  const sortedByWait = [...data.fahrer].sort((a, b) => a.avg_wartezeit_min - b.avg_wartezeit_min);
  const rang = sortedByWait.findIndex(f => f.fahrer_id === me.fahrer_id) + 1;

  return (
    <div className={`rounded-xl border p-4 mb-4 ${headerBg}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-blue-600" />
          <span className="font-semibold text-sm text-gray-800">Meine Wartezeit</span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Hauptwert */}
          <div className="text-center">
            <div className={`text-4xl font-bold ${cls.big}`}>{min.toFixed(1)} Min</div>
            <div className="text-xs text-gray-500 mt-1">Ø Wartezeit heute · {me.touren_anzahl} Touren</div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendIcon trend={me.trend} />
              <span className="text-xs text-gray-500">
                {me.trend_delta > 0 ? '+' : ''}{me.trend_delta.toFixed(1)} Min vs. Vorwoche
              </span>
            </div>
          </div>

          {/* Balken 0–15 Min mit Ziel-Linie 3 Min */}
          <div>
            <div className="relative h-3 bg-gray-200 rounded-full overflow-visible">
              <div className={`h-full rounded-full ${cls.bar}`} style={{ width: `${barPct}%` }} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-blue-400" style={{ left: `${zielPct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>0</span>
              <span className="text-blue-500">Ziel {ZIEL_MIN} Min</span>
              <span>15 Min</span>
            </div>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Trend',   val: me.trend === 'steigend' ? '↑ Steigend' : me.trend === 'fallend' ? '↓ Fallend' : '→ Stabil' },
              { label: 'Ziel',    val: `≤${ZIEL_MIN} Min` },
              { label: 'Ampel',   val: ampel === 'gruen' ? '🟢 Im Ziel' : ampel === 'gelb' ? '🟡 Knapp' : '🔴 Zu lang' },
              { label: 'Touren',  val: `${me.touren_anzahl}` },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-lg p-2 text-center border border-gray-100">
                <div className="text-[10px] text-gray-500">{k.label}</div>
                <div className="text-xs font-semibold text-gray-800">{k.val}</div>
              </div>
            ))}
          </div>

          {/* Team-Ø + Rang */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-[10px] text-gray-500">Team-Ø</div>
              <div className="text-xs font-bold text-gray-800">{data.team_avg_wartezeit_min.toFixed(1)} Min</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-[10px] text-gray-500">Rang (Effizienz)</div>
              <div className="text-xs font-bold text-gray-800">#{rang} / {data.fahrer.length}</div>
            </div>
          </div>

          {/* Coaching-Tipp */}
          <div className={`rounded-lg p-2 text-xs ${cls.bg} ${cls.text}`}>{tip}</div>
        </div>
      )}
    </div>
  );
}
