'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  punkte_heute: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  alert: string | null;
  rang: number;
  punkte_lieferungen: number;
  punkte_puenktlichkeit: number;
  punkte_auslastung: number;
  punkte_wartezeit: number;
  lieferungen_heute: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_punkte: number;
}

const ZIEL = 75;
const WARN = 50;
const MAX  = 100;

function calcAmpel(pts: number): 'gruen' | 'gelb' | 'rot' {
  if (pts >= ZIEL) return 'gruen';
  if (pts >= WARN) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(pts: number, alert: string | null): string {
  if (alert) return `Dein Schicht-Score ist zu niedrig (${pts} Pkt). Mehr Lieferungen, pünktliche Zustellung und kurze Wartezeiten bringen mehr Punkte!`;
  if (pts >= ZIEL) return `Stark! ${pts} Punkte heute — du bist im grünen Bereich. Weiter so!`;
  return `${pts} Punkte bisher. Ziel: ≥${ZIEL} Pkt. Fokus auf Pünktlichkeit und Wartezeiten für mehr Punkte.`;
}

function TrendIcon({ trend, delta }: { trend: string; delta: number }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-green-600" title={`+${delta} Pkt`} />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500"   title={`${delta} Pkt`} />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK_ID = 'mock-me';
const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: MOCK_ID, punkte_heute: 68, trend: 'fallend', trend_delta: -4, alert: null, rang: 2, punkte_lieferungen: 20, punkte_puenktlichkeit: 20, punkte_auslastung: 20, punkte_wartezeit: 8, lieferungen_heute: 7 },
    { fahrer_id: 'f1',    punkte_heute: 87, trend: 'steigend', trend_delta: 7, alert: null, rang: 1, punkte_lieferungen: 30, punkte_puenktlichkeit: 30, punkte_auslastung: 15, punkte_wartezeit: 12, lieferungen_heute: 11 },
    { fahrer_id: 'f4',    punkte_heute: 41, trend: 'fallend', trend_delta: -14, alert: 'Schicht-Score zu niedrig!', rang: 4, punkte_lieferungen: 10, punkte_puenktlichkeit: 20, punkte_auslastung: 5, punkte_wartezeit: 6, lieferungen_heute: 3 },
  ],
  team_avg_punkte: 62,
};

export function FahrerPhase2748MeineSchichtPunkte({
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
      fetch(`/api/delivery/admin/fahrer-schicht-punkte?location_id=${locationId}`)
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

  const ampel   = calcAmpel(me.punkte_heute);
  const cls     = ampelCls(ampel);
  const fill    = Math.min(100, (me.punkte_heute / MAX) * 100);
  const zielPct = (ZIEL / MAX) * 100;

  const teilscores = [
    { label: '📦 Lieferungen',  pts: me.punkte_lieferungen,  max: 30 },
    { label: '⏱ Pünktlichkeit', pts: me.punkte_puenktlichkeit, max: 30 },
    { label: '📊 Auslastung',   pts: me.punkte_auslastung,   max: 25 },
    { label: '🛑 Wartezeit',    pts: me.punkte_wartezeit,    max: 15 },
  ];

  return (
    <div className={`rounded-xl border ${cls.bg} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Star size={16} className={cls.text} />
          <span className="font-semibold text-sm text-gray-800">Meine Schicht-Punkte</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Hauptwert */}
          <div className="text-center">
            <div className={`text-4xl font-black ${cls.big}`}>{me.punkte_heute} <span className="text-lg font-semibold">Pkt</span></div>
            <div className="text-xs text-gray-500 mt-0.5">Schicht-Score heute</div>
          </div>

          {/* Balken */}
          <div className="relative h-4 rounded-full bg-gray-200">
            <div
              className="absolute top-0 h-full w-0.5 bg-green-600 z-10"
              style={{ left: `${zielPct}%` }}
              title={`Ziel: ≥${ZIEL} Pkt`}
            />
            <div
              className={`absolute top-0 left-0 h-full rounded-full ${cls.bar}`}
              style={{ width: `${fill}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>0 Pkt</span>
            <span>Ziel ≥{ZIEL} Pkt</span>
            <span>{MAX} Pkt</span>
          </div>

          {/* Teilscores */}
          <div className="space-y-1.5">
            {teilscores.map(ts => (
              <div key={ts.label} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 w-28">{ts.label}</span>
                <div className="flex-1 relative h-2 rounded-full bg-gray-200">
                  <div
                    className={`absolute top-0 left-0 h-full rounded-full ${cls.bar}`}
                    style={{ width: `${Math.min(100, (ts.pts / ts.max) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-gray-700 w-12 text-right">{ts.pts}/{ts.max}</span>
              </div>
            ))}
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="rounded-lg bg-white border border-gray-200 px-1 py-2">
              <div className="text-[9px] text-gray-400 mb-0.5">Trend</div>
              <div className="flex justify-center"><TrendIcon trend={me.trend} delta={me.trend_delta} /></div>
            </div>
            <div className="rounded-lg bg-white border border-gray-200 px-1 py-2">
              <div className="text-[9px] text-gray-400 mb-0.5">Ziel</div>
              <div className="text-xs font-bold text-gray-700">≥{ZIEL} Pkt</div>
            </div>
            <div className="rounded-lg bg-white border border-gray-200 px-1 py-2">
              <div className="text-[9px] text-gray-400 mb-0.5">Rang</div>
              <div className="text-xs font-bold text-gray-700">#{me.rang}</div>
            </div>
            <div className="rounded-lg bg-white border border-gray-200 px-1 py-2">
              <div className="text-[9px] text-gray-400 mb-0.5">Team-Ø</div>
              <div className="text-xs font-bold text-gray-700">{data.team_avg_punkte} Pkt</div>
            </div>
          </div>

          {/* Coaching-Tipp */}
          <div className={`rounded-lg px-3 py-2 text-xs ${cls.text} bg-white border ${ampel === 'rot' ? 'border-red-200' : ampel === 'gelb' ? 'border-amber-200' : 'border-green-200'}`}>
            {coaching(me.punkte_heute, me.alert)}
          </div>

          <div className="text-center text-[10px] text-gray-400">
            {me.lieferungen_heute} Lieferungen heute
          </div>
        </div>
      )}
    </div>
  );
}
