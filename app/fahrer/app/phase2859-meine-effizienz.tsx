'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Gauge } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  effizienz_score: number;
  effizienz_score_vw: number;
  touren_pro_stunde: number;
  puenktlichkeit_pct: number;
  bewertung_sterne: number;
  trend: string;
  trend_delta: number;
  ampel: string;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_score: number;
}

const ZIEL = 80;
const WARN = 60;

function calcAmpel(score: number): string {
  if (score >= ZIEL) return 'gruen';
  if (score >= WARN) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(score: number): string {
  if (score >= ZIEL) return `${score} Pkt — Top-Effizienz! Du bist ein Leistungsträger. Weiter so!`;
  if (score >= WARN) return `${score} Pkt — Im gelben Bereich. Noch ${ZIEL - score} Pkt bis zum Ziel. Verbessere Touren-Tempo oder Pünktlichkeit.`;
  return `${score} Pkt — Effizienz zu niedrig! Bitte aktiver werden und pünktlicher liefern (Ziel: ≥${ZIEL} Pkt).`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK_ME: FahrerEntry = {
  fahrer_id: 'mock-me', fahrer_name: 'Ich', effizienz_score: 71, effizienz_score_vw: 68,
  touren_pro_stunde: 3.1, puenktlichkeit_pct: 78, bewertung_sterne: 4.1,
  trend: 'steigend', trend_delta: 3, ampel: 'gelb', rang: 2,
};
const MOCK: ApiData = { fahrer: [MOCK_ME], team_avg_score: 74 };

export function FahrerPhase2859MeineEffizienz({
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
      fetch(`/api/delivery/admin/fahrer-effizienz-index?${params}`)
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

  const score    = me.effizienz_score;
  const ampel    = calcAmpel(score);
  const cls      = ampelCls(ampel);
  const delta    = me.trend_delta;
  const tip      = coaching(score);
  const barPct   = Math.min(score, 100);
  const zielPct  = ZIEL;
  const headerBg = ampel === 'rot' ? 'border-red-300 bg-red-50' : ampel === 'gelb' ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50';

  const allSorted = [...data.fahrer].sort((a, b) => b.effizienz_score - a.effizienz_score);
  const rang      = allSorted.findIndex(f => f.fahrer_id === me.fahrer_id) + 1;

  const subScores = [
    { label: 'Touren/h',  val: me.touren_pro_stunde, unit: '/h', pct: Math.min((me.touren_pro_stunde / 4) * 100, 100), desc: `${me.touren_pro_stunde} T/h (Ziel: 4/h)` },
    { label: 'Pünktlich', val: me.puenktlichkeit_pct, unit: '%',  pct: me.puenktlichkeit_pct,                           desc: `${me.puenktlichkeit_pct}% (Ziel: ≥90%)` },
    { label: 'Bewertung', val: me.bewertung_sterne,   unit: '★',  pct: (me.bewertung_sterne / 5) * 100,               desc: `${me.bewertung_sterne}★ (Ziel: ≥4.5)` },
  ];

  return (
    <div className={`rounded-xl border p-4 mb-4 ${headerBg}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Gauge size={16} className="text-indigo-500" />
          <span className="font-semibold text-sm text-gray-800">Meine Effizienz</span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="text-center">
            <div className={`text-4xl font-bold ${cls.big}`}>{score} Pkt</div>
            <div className="text-xs text-gray-500 mt-1">Effizienz-Index (0–100)</div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendIcon trend={me.trend} />
              <span className="text-xs text-gray-500">
                {delta >= 0 ? '+' : ''}{delta} Pkt vs. letzte Woche
              </span>
            </div>
          </div>

          <div className="relative h-2 bg-gray-200 rounded-full overflow-visible">
            <div
              className={`absolute left-0 top-0 h-full rounded-full ${cls.bar}`}
              style={{ width: `${barPct}%` }}
            />
            <div
              className="absolute top-[-3px] w-0.5 h-3.5 bg-gray-600 rounded-full"
              style={{ left: `${zielPct}%` }}
              title={`Ziel ${ZIEL} Pkt`}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>0</span>
            <span>Ziel {ZIEL} Pkt</span>
            <span>100</span>
          </div>

          {/* 3 Sub-Score-Kacheln */}
          <div className="grid grid-cols-3 gap-2">
            {subScores.map(s => (
              <div key={s.label} className="bg-white rounded-lg p-2 border border-gray-100">
                <div className="text-[10px] text-gray-500 mb-1">{s.label}</div>
                <div className="h-1 bg-gray-200 rounded-full overflow-hidden mb-1">
                  <div className={`h-full rounded-full ${cls.bar}`} style={{ width: `${s.pct}%` }} />
                </div>
                <div className="text-xs font-semibold text-gray-800">{s.val}{s.unit}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Team-Ø: <strong className={ampelCls(calcAmpel(data.team_avg_score)).text}>{data.team_avg_score} Pkt</strong></span>
            {rang > 0 && <span>Effizienzrang: <strong className="text-gray-800">#{rang}</strong></span>}
          </div>

          <div className={`rounded-lg p-2 text-xs ${cls.bg} border ${cls.text.replace('text-', 'border-').replace('-700', '-200').replace('-600', '-200')}`}>
            {tip}
          </div>
        </div>
      )}
    </div>
  );
}
