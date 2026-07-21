'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  bewertung_avg: number;
  bewertungen_heute: number;
  ampel: string;
  trend: string;
  trend_delta: number;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_durchschnitt: number;
}

const ZIEL  = 4.5;
const ALERT = 3.5;

function calcAmpel(avg: number): string {
  if (avg >= ZIEL)  return 'gruen';
  if (avg >= ALERT) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(avg: number): string {
  if (avg >= ZIEL)  return `★ ${avg} — Exzellent! Deine Kunden sind sehr zufrieden. Weiter so!`;
  if (avg >= ALERT) return `★ ${avg} — Okay. Ziel ist ≥${ZIEL} ★. Freundlichkeit und Pünktlichkeit verbessern!`;
  return `★ ${avg} — Handlungsbedarf! Kundenbewertung zu niedrig. Bitte kommuniziere aktiv und sei pünktlich.`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

function StarDisplay({ avg }: { avg: number }) {
  return (
    <div className="flex justify-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={18}
          className={avg >= i ? 'text-yellow-400 fill-yellow-400' : avg >= i - 0.5 ? 'text-yellow-300 fill-yellow-300' : 'text-gray-300'}
        />
      ))}
    </div>
  );
}

const MOCK_ID = 'mock-me';
const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: MOCK_ID, fahrer_name: 'Ich',     bewertung_avg: 4.7, bewertungen_heute: 12, ampel: 'gruen', trend: 'steigend', trend_delta:  0.2, rang: 1 },
    { fahrer_id: 'f2',    fahrer_name: 'Sara K.',  bewertung_avg: 4.1, bewertungen_heute:  7, ampel: 'gelb',  trend: 'fallend',  trend_delta: -0.3, rang: 3 },
    { fahrer_id: 'f3',    fahrer_name: 'Lena S.',  bewertung_avg: 3.1, bewertungen_heute:  5, ampel: 'rot',   trend: 'fallend',  trend_delta: -0.6, rang: 5 },
  ],
  team_durchschnitt: 4.1,
};

export function FahrerPhase2818MeineKundenbewertung({
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
      fetch(`/api/delivery/admin/fahrer-kundenbewertung?location_id=${locationId}`)
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

  const ampel  = me.ampel || calcAmpel(me.bewertung_avg);
  const cls    = ampelCls(ampel);
  const avg    = me.bewertung_avg;
  const barPct = Math.min((avg / 5) * 100, 100);
  const zielPct = (ZIEL / 5) * 100;
  const tip    = coaching(avg);
  const headerBg = ampel === 'rot' ? 'border-red-300 bg-red-50' : ampel === 'gelb' ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50';
  const rang = [...data.fahrer].sort((a, b) => b.bewertung_avg - a.bewertung_avg).findIndex(f => f.fahrer_id === me.fahrer_id) + 1;

  return (
    <div className={`rounded-xl border p-4 mb-4 ${headerBg}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Star size={16} className="text-yellow-500" />
          <span className="font-semibold text-sm text-gray-800">Meine Kundenbewertung</span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Hauptwert */}
          <div className="text-center">
            <div className={`text-4xl font-bold ${cls.big}`}>{avg}</div>
            <StarDisplay avg={avg} />
            <div className="text-xs text-gray-500 mt-1">{me.bewertungen_heute} Bewertungen heute</div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendIcon trend={me.trend} />
              <span className="text-xs text-gray-500">
                {me.trend_delta > 0 ? '+' : ''}{me.trend_delta} vs. gestern
              </span>
            </div>
          </div>

          {/* Balken 0–5 mit Ziel-Linie 4.5 */}
          <div>
            <div className="relative h-3 bg-gray-200 rounded-full overflow-visible">
              <div className={`h-full rounded-full ${cls.bar}`} style={{ width: `${barPct}%` }} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-blue-400" style={{ left: `${zielPct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>0</span>
              <span className="text-blue-500">Ziel ≥{ZIEL} ★</span>
              <span>5</span>
            </div>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Trend',    val: me.trend === 'steigend' ? '↑ Steigend' : me.trend === 'fallend' ? '↓ Fallend' : '→ Stabil' },
              { label: 'Ziel',     val: `≥ ${ZIEL} ★` },
              { label: 'Ampel',    val: ampel === 'gruen' ? '🟢 Gut' : ampel === 'gelb' ? '🟡 OK' : '🔴 Zu niedrig' },
              { label: 'Bew. heute', val: `${me.bewertungen_heute}` },
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
              <div className="text-xs font-bold text-gray-800">★ {data.team_durchschnitt}</div>
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
