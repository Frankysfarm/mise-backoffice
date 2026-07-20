'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  quote: number;
  touren_heute: number;
  schicht_stunden: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  alert: string | null;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_quote: number;
}

const ZIEL = 3;
const MAX  = 6;

function calcAmpel(q: number): 'gruen' | 'gelb' | 'rot' {
  if (q >= ZIEL)  return 'gruen';
  if (q >= 1.5) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(q: number, alert: string | null): string {
  if (alert) return 'Deine Auftragsquote ist zu niedrig. Versuche schneller zu liefern oder wähle kürzere Routen.';
  if (q >= ZIEL) return `Super — ${q.toFixed(1)} Aufträge/h! Du liegst über dem Ziel von ${ZIEL}/h.`;
  return `${q.toFixed(1)} Aufträge/h. Ziel ist ≥${ZIEL}/h — noch ein bisschen mehr!`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK_ID = 'mock-me';
const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: MOCK_ID, fahrer_name: 'Ich',   quote: 2.8, touren_heute: 8,  schicht_stunden: 2.9, trend: 'steigend', alert: null },
    { fahrer_id: 'f2',   fahrer_name: 'Max M.', quote: 4.2, touren_heute: 13, schicht_stunden: 3.1, trend: 'steigend', alert: null },
  ],
  team_avg_quote: 3.0,
};

export function FahrerPhase2708MeineAuftragsquote({
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
      fetch(`/api/delivery/admin/fahrer-schicht-auftragsquote?location_id=${locationId}`)
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

  const ampel  = calcAmpel(me.quote);
  const cls    = ampelCls(ampel);
  const fill   = Math.min(100, (me.quote / MAX) * 100);
  const zielPct = (ZIEL / MAX) * 100;
  const rang   = [...data.fahrer].sort((a, b) => b.quote - a.quote).findIndex((f: FahrerEntry) => f.fahrer_id === me.fahrer_id) + 1;

  return (
    <div className={`rounded-xl border ${cls.bg} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Zap size={16} className={cls.text} />
          <span className="font-semibold text-sm text-gray-800">Meine Auftragsquote</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="text-center">
            <div className={`text-4xl font-black ${cls.big}`}>{me.quote.toFixed(1)}</div>
            <div className="text-xs text-gray-500 mt-0.5">Aufträge / Stunde</div>
          </div>

          <div className="relative h-4 rounded-full bg-gray-200">
            <div
              className="absolute top-0 h-full w-0.5 bg-green-600 z-10"
              style={{ left: `${zielPct}%` }}
              title={`Ziel: ≥${ZIEL}/h`}
            />
            <div
              className={`absolute top-0 left-0 h-full rounded-full ${cls.bar}`}
              style={{ width: `${fill}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>0</span>
            <span className="text-green-600 font-medium">Ziel {ZIEL}/h</span>
            <span>{MAX}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Trend',   value: me.trend === 'steigend' ? '↑ Steigend' : me.trend === 'fallend' ? '↓ Fallend' : '→ Stabil', c: me.trend === 'steigend' ? 'text-green-600' : me.trend === 'fallend' ? 'text-red-500' : 'text-gray-500' },
              { label: 'Ziel',    value: `≥${ZIEL}/h`,           c: 'text-gray-600' },
              { label: 'Ampel',   value: ampel === 'gruen' ? 'Grün ✓' : ampel === 'gelb' ? 'Gelb ⚠' : 'Rot ✗', c: cls.text },
              { label: 'Team-Ø', value: `${data.team_avg_quote.toFixed(1)}/h`, c: 'text-gray-600' },
            ].map(({ label, value, c }) => (
              <div key={label} className="rounded-lg bg-white/60 border border-gray-100 p-2 text-center">
                <div className="text-[10px] text-gray-400">{label}</div>
                <div className={`text-xs font-bold ${c}`}>{value}</div>
              </div>
            ))}
          </div>

          <div className={`rounded-lg px-3 py-2 text-xs ${cls.text} bg-white/50 border ${cls.bg.split(' ')[1]}`}>
            <div className="flex items-start gap-1.5">
              <TrendIcon trend={me.trend} />
              <span>{coaching(me.quote, me.alert)}</span>
            </div>
          </div>

          <div className="text-center text-[10px] text-gray-400">
            Rang {rang}/{data.fahrer.length} · {me.touren_heute} Touren · {me.schicht_stunden.toFixed(1)}h Schicht
          </div>
        </div>
      )}
    </div>
  );
}
