'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, XCircle } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  storno_rate_pct: number;
  angebotene_touren: number;
  stornierte_touren: number;
  ampel: string;
  trend: string;
  trend_delta: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  fahrer_single?: FahrerEntry;
  team_avg_storno_rate_pct: number;
}

const ZIEL_PCT = 5;
const WARN_PCT = 15;
const MAX_PCT  = 30;

function calcAmpel(pct: number): string {
  if (pct > WARN_PCT) return 'rot';
  if (pct > ZIEL_PCT) return 'gelb';
  return 'gruen';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(pct: number): string {
  if (pct <= ZIEL_PCT) return `${pct}% Storno-Rate — sehr gut! Deine Aufträge werden zuverlässig abgeschlossen.`;
  if (pct <= WARN_PCT) return `${pct}% Storno-Rate — okay. Versuche, unter 5% zu kommen. Stornogründe prüfen!`;
  return `${pct}% Storno-Rate — zu hoch! Bitte prüfe, warum so viele Aufträge storniert werden.`;
}

function TrendIcon({ trend }: { trend: string }) {
  // steigend = schlechter (rot), fallend = besser (grün) — invertiert
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-green-600" />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK_ID = 'mock-me';
const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: MOCK_ID, fahrer_name: 'Ich',     storno_rate_pct:  3.2, angebotene_touren: 31, stornierte_touren: 1, ampel: 'gruen', trend: 'fallend',  trend_delta: -0.8 },
    { fahrer_id: 'f2',    fahrer_name: 'Sarah K.', storno_rate_pct: 18.5, angebotene_touren: 27, stornierte_touren: 5, ampel: 'rot',   trend: 'steigend', trend_delta:  6.5 },
    { fahrer_id: 'f3',    fahrer_name: 'Lena S.',  storno_rate_pct:  8.7, angebotene_touren: 23, stornierte_touren: 2, ampel: 'gelb',  trend: 'steigend', trend_delta:  1.2 },
  ],
  team_avg_storno_rate_pct: 10.1,
};

export function FahrerPhase2809MeineStornoRate({
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
        ? `/api/delivery/admin/fahrer-storno-rate?location_id=${locationId}&driver_id=${driverId}`
        : `/api/delivery/admin/fahrer-storno-rate?location_id=${locationId}`;
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

  const me = data.fahrer_single
    ?? data.fahrer.find(f => f.fahrer_id === driverId)
    ?? data.fahrer[0];
  if (!me) return null;

  const ampel   = me.ampel || calcAmpel(me.storno_rate_pct);
  const cls     = ampelCls(ampel);
  const pct     = me.storno_rate_pct;
  const barPct  = Math.min((pct / MAX_PCT) * 100, 100);
  const zielPct = (ZIEL_PCT / MAX_PCT) * 100;
  const tip     = coaching(pct);
  const headerBg = ampel === 'rot' ? 'border-red-300 bg-red-50' : ampel === 'gelb' ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50';
  const rang = [...data.fahrer].sort((a, b) => a.storno_rate_pct - b.storno_rate_pct).findIndex(f => f.fahrer_id === me.fahrer_id) + 1;

  return (
    <div className={`rounded-xl border p-4 mb-4 ${headerBg}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <XCircle size={16} className="text-orange-500" />
          <span className="font-semibold text-sm text-gray-800">Meine Storno-Rate</span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Hauptwert */}
          <div className="text-center">
            <div className={`text-4xl font-bold ${cls.big}`}>{pct}%</div>
            <div className="text-xs text-gray-500 mt-1">
              {me.stornierte_touren}/{me.angebotene_touren} Touren storniert
            </div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendIcon trend={me.trend} />
              <span className="text-xs text-gray-500">
                {me.trend_delta > 0 ? '+' : ''}{me.trend_delta}% vs. Vorwoche
              </span>
            </div>
          </div>

          {/* Balken 0–30% mit Ziel-Linie 5% */}
          <div>
            <div className="relative h-3 bg-gray-200 rounded-full overflow-visible">
              <div className={`h-full rounded-full ${cls.bar}`} style={{ width: `${barPct}%` }} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-blue-400" style={{ left: `${zielPct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>0%</span>
              <span className="text-blue-500">Ziel ≤{ZIEL_PCT}%</span>
              <span>{MAX_PCT}%</span>
            </div>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Ziel',    val: `≤${ZIEL_PCT}%` },
              { label: 'Team-Ø', val: `${data.team_avg_storno_rate_pct}%` },
              { label: 'Ampel',  val: ampel === 'gruen' ? '🟢 Gut' : ampel === 'gelb' ? '🟡 OK' : '🔴 Zu hoch' },
              { label: 'Touren', val: `${me.angebotene_touren} ges.` },
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
            <span className="text-sm font-bold text-gray-800">#{rang}</span>
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
