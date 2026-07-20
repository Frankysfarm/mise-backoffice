'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_min: number;
  batches_heute: number;
  ampel: string;
  trend: string;
  trend_delta: number;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_min: number;
}

const ZIEL_MIN = 2;
const WARN_MIN = 5;
const MAX_MIN  = 10;

function calcAmpel(m: number): string {
  if (m <= ZIEL_MIN) return 'gruen';
  if (m <= WARN_MIN) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(m: number): string {
  if (m <= ZIEL_MIN) return `Reaktionszeit ${m} Min — ausgezeichnet! Du reagierst sehr schnell auf neue Aufträge.`;
  if (m <= WARN_MIN) return `${m} Min Reaktionszeit — du bist auf Kurs. Versuche, unter 2 Min zu kommen!`;
  return `Reaktionszeit ${m} Min — zu langsam. Bitte reagiere schneller auf neue Aufträge!`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-green-600" />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK_ID = 'mock-me';
const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: MOCK_ID, fahrer_name: 'Ich',    avg_min: 1.8, batches_heute: 9, ampel: 'gruen', trend: 'fallend',  trend_delta: -0.3, rang: 1 },
    { fahrer_id: 'f2',   fahrer_name: 'Sara K.', avg_min: 3.2, batches_heute: 8, ampel: 'gelb',  trend: 'stabil',   trend_delta:  0.0, rang: 2 },
    { fahrer_id: 'f3',   fahrer_name: 'Tim W.',  avg_min: 6.5, batches_heute: 6, ampel: 'rot',   trend: 'steigend', trend_delta:  0.7, rang: 3 },
  ],
  team_avg_min: 3.8,
};

export function FahrerPhase2788MeineReaktionszeit({
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
        ? `/api/delivery/admin/fahrer-reaktionszeit-auf-zuweisung?location_id=${locationId}&driver_id=${driverId}`
        : `/api/delivery/admin/fahrer-reaktionszeit-auf-zuweisung?location_id=${locationId}`;
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

  const ampel  = me.ampel || calcAmpel(me.avg_min);
  const cls    = ampelCls(ampel);
  const pct    = Math.min(100, (me.avg_min / MAX_MIN) * 100);
  const zielPct = (ZIEL_MIN / MAX_MIN) * 100;
  const tip    = coaching(me.avg_min);
  const headerBg = ampel === 'rot' ? 'border-red-300 bg-red-50' : ampel === 'gelb' ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50';

  return (
    <div className={`rounded-xl border p-4 mb-4 ${headerBg}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800">Meine Reaktionszeit</span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Hauptwert */}
          <div className="text-center">
            <div className={`text-4xl font-bold ${cls.big}`}>{me.avg_min} Min</div>
            <div className="text-xs text-gray-500 mt-1">Ø Reaktionszeit heute</div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendIcon trend={me.trend} />
              <span className="text-xs text-gray-500">{me.trend_delta > 0 ? '+' : ''}{me.trend_delta} Min vs. gestern</span>
            </div>
          </div>

          {/* Balken 0–10 Min mit Ziel-Linie 2 Min */}
          <div>
            <div className="relative h-3 bg-gray-200 rounded-full overflow-visible">
              <div className={`h-full rounded-full ${cls.bar}`} style={{ width: `${pct}%` }} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-blue-400" style={{ left: `${zielPct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>0 Min</span>
              <span className="text-blue-500">Ziel {ZIEL_MIN} Min</span>
              <span>{MAX_MIN} Min</span>
            </div>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Ziel',    val: `≤${ZIEL_MIN} Min` },
              { label: 'Team-Ø', val: `${data.team_avg_min} Min` },
              { label: 'Ampel',  val: ampel === 'gruen' ? '🟢 Gut' : ampel === 'gelb' ? '🟡 OK' : '🔴 Zu langsam' },
              { label: 'Touren', val: String(me.batches_heute) },
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
