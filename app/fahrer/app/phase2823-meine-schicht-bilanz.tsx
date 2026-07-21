'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Minus, TrendingDown, TrendingUp, BarChart2 } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  touren: number;
  gesamt_km: number;
  einnahmen: number;
  bewertung: number;
  schichtdauer_h: number;
  trend_einnahmen: string;
  trend_delta_einnahmen: number;
  ampel: string;
  alert_schicht: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_einnahmen: number;
}

const EINNAHMEN_ZIEL = 100;
const EINNAHMEN_MAX  = 200;

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(einnahmen: number, alert_schicht: boolean): string {
  if (alert_schicht)           return `⚠️ Schicht über 10 h — bitte Pause einlegen und Ruhezeiten beachten!`;
  if (einnahmen >= EINNAHMEN_ZIEL) return `${einnahmen} € — Top-Schicht! Du hast dein Tagesziel erreicht. Weiter so!`;
  const diff = EINNAHMEN_ZIEL - einnahmen;
  return `${einnahmen} € — Noch ${diff} € bis zum Ziel (${EINNAHMEN_ZIEL} €). Effizienz und Touren steigern!`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK_ID = 'mock-me';
const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: MOCK_ID, fahrer_name: 'Ich',    touren: 8, gesamt_km: 48, einnahmen: 120, bewertung: 4.7, schichtdauer_h: 7.5, trend_einnahmen: 'steigend', trend_delta_einnahmen:  15, ampel: 'gruen', alert_schicht: false },
    { fahrer_id: 'd2',    fahrer_name: 'Sara K.', touren: 7, gesamt_km: 42, einnahmen:  98, bewertung: 4.2, schichtdauer_h: 8.0, trend_einnahmen: 'stabil',   trend_delta_einnahmen:   3, ampel: 'gruen', alert_schicht: false },
    { fahrer_id: 'd3',    fahrer_name: 'Tim B.',  touren: 3, gesamt_km: 22, einnahmen:  45, bewertung: 3.5, schichtdauer_h:10.5, trend_einnahmen: 'fallend',  trend_delta_einnahmen: -25, ampel: 'rot',   alert_schicht: true  },
  ],
  team_einnahmen: 263,
};

export function FahrerPhase2823MeineSchichtBilanz({
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
      fetch(`/api/delivery/admin/fahrer-schicht-bilanz?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [isOnline, locationId]);

  if (!data) return null;

  const me     = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const ampel   = me.ampel ?? (me.einnahmen >= EINNAHMEN_ZIEL ? 'gruen' : 'rot');
  const cls     = ampelCls(ampel);
  const barPct  = Math.min((me.einnahmen / EINNAHMEN_MAX) * 100, 100);
  const zielPct = (EINNAHMEN_ZIEL / EINNAHMEN_MAX) * 100;
  const tip     = coaching(me.einnahmen, me.alert_schicht);
  const rang    = [...data.fahrer].sort((a, b) => b.einnahmen - a.einnahmen).findIndex(f => f.fahrer_id === me.fahrer_id) + 1;
  const headerBg = ampel === 'rot' ? 'border-red-300 bg-red-50' : 'border-green-200 bg-green-50';

  return (
    <div className={`rounded-xl border p-4 mb-4 ${headerBg}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <BarChart2 size={16} className="text-indigo-500" />
          <span className="font-semibold text-sm text-gray-800">Meine Schicht-Bilanz</span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Hauptwert: Einnahmen */}
          <div className="text-center">
            <div className={`text-4xl font-bold ${cls.big}`}>{me.einnahmen} €</div>
            <div className="text-xs text-gray-500 mt-1">Einnahmen heute</div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendIcon trend={me.trend_einnahmen} />
              <span className="text-xs text-gray-500">
                {me.trend_delta_einnahmen > 0 ? '+' : ''}{me.trend_delta_einnahmen} € vs. gestern
              </span>
            </div>
          </div>

          {/* Balken 0–200€ Ziel-Linie 100€ */}
          <div>
            <div className="relative h-3 bg-gray-200 rounded-full overflow-visible">
              <div className={`h-full rounded-full ${cls.bar}`} style={{ width: `${barPct}%` }} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-blue-400" style={{ left: `${zielPct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>0</span>
              <span className="text-blue-500">Ziel {EINNAHMEN_ZIEL} €</span>
              <span>{EINNAHMEN_MAX} €</span>
            </div>
          </div>

          {/* 6 KPI-Cards */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Touren',      val: `${me.touren}` },
              { label: 'km gesamt',   val: `${me.gesamt_km} km` },
              { label: '★ Bewertung', val: `${me.bewertung}` },
              { label: 'Schicht',     val: `${me.schichtdauer_h} h` },
              { label: 'Trend',       val: me.trend_einnahmen === 'steigend' ? '↑ Steigend' : me.trend_einnahmen === 'fallend' ? '↓ Fallend' : '→ Stabil' },
              { label: 'Ziel',        val: `${EINNAHMEN_ZIEL} €` },
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
              <div className="text-[10px] text-gray-500">Team-Einnahmen</div>
              <div className="text-xs font-bold text-gray-800">{data.team_einnahmen} €</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-[10px] text-gray-500">Rang</div>
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
