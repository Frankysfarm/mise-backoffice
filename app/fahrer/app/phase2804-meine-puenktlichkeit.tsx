'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  puenktlich_rate: number;
  puenktlich_anzahl: number;
  gesamt_lieferungen: number;
  ampel: string;
  trend: string;
  trend_delta: number;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_rate: number;
}

const ZIEL_RATE = 90;
const WARN_RATE = 70;

function calcAmpel(rate: number): string {
  if (rate >= ZIEL_RATE) return 'gruen';
  if (rate >= WARN_RATE) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(rate: number): string {
  if (rate >= ZIEL_RATE) return `${rate}% pünktlich — sehr gut! Deine Lieferungen kommen zuverlässig rechtzeitig an.`;
  if (rate >= WARN_RATE) return `${rate}% pünktlich — okay. Versuche, über 90% zu kommen! Kürzere Stops helfen.`;
  return `${rate}% pünktlich — zu niedrig. Bitte prüfe deine Routen und minimiere unnötige Wartezeiten.`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500" />;
  return                           <Minus        size={14} className="text-gray-400" />;
}

const MOCK_ID = 'mock-me';
const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: MOCK_ID, fahrer_name: 'Ich',     puenktlich_rate: 95.5, puenktlich_anzahl: 21, gesamt_lieferungen: 22, ampel: 'gruen', trend: 'steigend', trend_delta:  2.5, rang: 2 },
    { fahrer_id: 'f2',   fahrer_name: 'Sara K.',  puenktlich_rate: 81.3, puenktlich_anzahl: 13, gesamt_lieferungen: 16, ampel: 'gelb',  trend: 'fallend',  trend_delta: -2.2, rang: 3 },
    { fahrer_id: 'f3',   fahrer_name: 'Tim W.',   puenktlich_rate: 62.5, puenktlich_anzahl:  5, gesamt_lieferungen:  8, ampel: 'rot',   trend: 'fallend',  trend_delta: -5.5, rang: 4 },
  ],
  team_avg_rate: 84.8,
};

export function FahrerPhase2804MeinePuenktlichkeit({
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
        ? `/api/delivery/admin/fahrer-puenktlichkeitsrate?location_id=${locationId}&driver_id=${driverId}`
        : `/api/delivery/admin/fahrer-puenktlichkeitsrate?location_id=${locationId}`;
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

  const ampel   = me.ampel || calcAmpel(me.puenktlich_rate);
  const cls     = ampelCls(ampel);
  const rate    = me.puenktlich_rate;
  const barPct  = Math.min(rate, 100);
  const zielPct = ZIEL_RATE;
  const tip     = coaching(rate);
  const headerBg = ampel === 'rot' ? 'border-red-300 bg-red-50' : ampel === 'gelb' ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50';

  return (
    <div className={`rounded-xl border p-4 mb-4 ${headerBg}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-indigo-500" />
          <span className="font-semibold text-sm text-gray-800">Meine Pünktlichkeit</span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Hauptwert */}
          <div className="text-center">
            <div className={`text-4xl font-bold ${cls.big}`}>{rate}%</div>
            <div className="text-xs text-gray-500 mt-1">
              {me.puenktlich_anzahl}/{me.gesamt_lieferungen} Lieferungen pünktlich
            </div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendIcon trend={me.trend} />
              <span className="text-xs text-gray-500">
                {me.trend_delta > 0 ? '+' : ''}{me.trend_delta}% vs. gestern
              </span>
            </div>
          </div>

          {/* Balken 0–100% mit Ziel-Linie 90% */}
          <div>
            <div className="relative h-3 bg-gray-200 rounded-full overflow-visible">
              <div className={`h-full rounded-full ${cls.bar}`} style={{ width: `${barPct}%` }} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-blue-400" style={{ left: `${zielPct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>0%</span>
              <span className="text-blue-500">Ziel {ZIEL_RATE}%</span>
              <span>100%</span>
            </div>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Ziel',    val: `≥${ZIEL_RATE}%` },
              { label: 'Team-Ø', val: `${data.team_avg_rate}%` },
              { label: 'Ampel',  val: ampel === 'gruen' ? '🟢 Pünktlich' : ampel === 'gelb' ? '🟡 OK' : '🔴 Zu niedrig' },
              { label: 'Touren', val: `${me.gesamt_lieferungen} Lief.` },
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
