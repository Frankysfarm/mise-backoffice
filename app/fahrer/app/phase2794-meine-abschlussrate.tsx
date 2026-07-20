'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, CheckCircle2 } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  rate_pct: number;
  abgeschlossen: number;
  gesamt: number;
  ampel: string;
  trend: string;
  trend_delta: number;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_pct: number;
}

const ZIEL_PCT = 95;
const WARN_PCT = 80;

function calcAmpel(p: number): string {
  if (p >= ZIEL_PCT) return 'gruen';
  if (p >= WARN_PCT) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(p: number): string {
  if (p >= ZIEL_PCT) return `Abschlussrate ${p}% — ausgezeichnet! Du schließt fast alle Touren erfolgreich ab.`;
  if (p >= WARN_PCT) return `${p}% Abschlussrate — du bist auf Kurs. Versuche, über 95% zu kommen!`;
  return `Abschlussrate ${p}% — zu niedrig. Bitte kläre offene Touren und reduziere Stornierungen!`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK_ID = 'mock-me';
const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: MOCK_ID, fahrer_name: 'Ich',    rate_pct: 97, abgeschlossen: 11, gesamt: 11, ampel: 'gruen', trend: 'steigend', trend_delta:  2, rang: 1 },
    { fahrer_id: 'f2',   fahrer_name: 'Sara K.', rate_pct: 88, abgeschlossen:  7, gesamt:  8, ampel: 'gelb',  trend: 'stabil',   trend_delta:  0, rang: 2 },
    { fahrer_id: 'f3',   fahrer_name: 'Tim W.',  rate_pct: 75, abgeschlossen:  6, gesamt:  8, ampel: 'rot',   trend: 'fallend',  trend_delta: -5, rang: 3 },
  ],
  team_avg_pct: 86.7,
};

export function FahrerPhase2794MeineAbschlussrate({
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
        ? `/api/delivery/admin/fahrer-tour-abschlussrate?location_id=${locationId}&driver_id=${driverId}`
        : `/api/delivery/admin/fahrer-tour-abschlussrate?location_id=${locationId}`;
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

  const ampel  = me.ampel || calcAmpel(me.rate_pct);
  const cls    = ampelCls(ampel);
  const pct    = me.rate_pct;
  const tip    = coaching(me.rate_pct);
  const headerBg = ampel === 'rot' ? 'border-red-300 bg-red-50' : ampel === 'gelb' ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50';

  return (
    <div className={`rounded-xl border p-4 mb-4 ${headerBg}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-500" />
          <span className="font-semibold text-sm text-gray-800">Meine Abschlussrate</span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Hauptwert */}
          <div className="text-center">
            <div className={`text-4xl font-bold ${cls.big}`}>{me.rate_pct}%</div>
            <div className="text-xs text-gray-500 mt-1">{me.abgeschlossen} von {me.gesamt} Touren abgeschlossen</div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendIcon trend={me.trend} />
              <span className="text-xs text-gray-500">{me.trend_delta > 0 ? '+' : ''}{me.trend_delta}% vs. gestern</span>
            </div>
          </div>

          {/* Balken 0–100% mit Ziel-Linie 95% */}
          <div>
            <div className="relative h-3 bg-gray-200 rounded-full overflow-visible">
              <div className={`h-full rounded-full ${cls.bar}`} style={{ width: `${pct}%` }} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-blue-400" style={{ left: `${ZIEL_PCT}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>0%</span>
              <span className="text-blue-500">Ziel {ZIEL_PCT}%</span>
              <span>100%</span>
            </div>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Ziel',    val: `≥${ZIEL_PCT}%` },
              { label: 'Team-Ø', val: `${data.team_avg_pct}%` },
              { label: 'Ampel',  val: ampel === 'gruen' ? '🟢 Gut' : ampel === 'gelb' ? '🟡 OK' : '🔴 Zu niedrig' },
              { label: 'Touren', val: `${me.abgeschlossen}/${me.gesamt}` },
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
