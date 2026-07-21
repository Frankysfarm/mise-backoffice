'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

interface FahrerSingle {
  id: string;
  name: string;
  rate_pct: number;
  rate_pct_vw: number;
  touren: number;
  trend: 'up' | 'down' | 'neutral';
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer_single?: FahrerSingle;
  fahrer?: FahrerSingle[];
  team_avg_pct: number;
}

const ZIEL_MIN = 60;
const ZIEL_MAX = 85;

function calcAmpel(pct: number): 'gruen' | 'gelb' | 'rot' {
  if (pct >= ZIEL_MIN && pct <= ZIEL_MAX) return 'gruen';
  if (pct >= 40 && pct < ZIEL_MIN) return 'gelb';
  if (pct > ZIEL_MAX && pct <= 90) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(pct: number): string {
  if (pct >= ZIEL_MIN && pct <= ZIEL_MAX) return `${pct}% Auslastung — Perfekt! Du bist optimal ausgelastet. Weiter so!`;
  if (pct > ZIEL_MAX) return `${pct}% Auslastung — Achtung Überlastung! Pausen einplanen, sonst leidet die Qualität.`;
  if (pct >= 40) return `${pct}% Auslastung — Noch Luft nach oben. Mehr Touren annehmen um Ziel (${ZIEL_MIN}%) zu erreichen.`;
  return `${pct}% Auslastung — Niedrige Auslastung! Bitte Verfügbarkeit prüfen (Ziel: ${ZIEL_MIN}–${ZIEL_MAX}%).`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up')   return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'down') return <TrendingDown size={14} className="text-red-500"   />;
  return                       <Minus        size={14} className="text-gray-400"  />;
}

const MOCK_ME: FahrerSingle = {
  id: 'mock-me', name: 'Ich', rate_pct: 65, rate_pct_vw: 58,
  touren: 11, trend: 'up', ampel: 'gruen',
};
const MOCK: ApiData = { fahrer_single: MOCK_ME, team_avg_pct: 64 };

export function FahrerPhase2873MeineAuslastung({
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
      fetch(`/api/delivery/admin/fahrer-auslastung?${params}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [isOnline, locationId, driverId]);

  if (!data) return null;

  const me = data.fahrer_single ?? (data.fahrer?.find(f => f.id === driverId) ?? data.fahrer?.[0]);
  if (!me) return null;

  const pct       = me.rate_pct;
  const delta     = pct - me.rate_pct_vw;
  const ampel     = calcAmpel(pct);
  const cls       = ampelCls(ampel);
  const tip       = coaching(pct);
  const headerBg  = ampel === 'rot' ? 'border-red-300 bg-red-50' : ampel === 'gelb' ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50';

  return (
    <div className={`rounded-xl border p-4 mb-4 ${headerBg}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800">Meine Auslastung</span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="text-center">
            <div className={`text-4xl font-bold ${cls.big}`}>{pct}%</div>
            <div className="text-xs text-gray-500 mt-1">{me.touren} Touren heute</div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendIcon trend={me.trend} />
              <span className="text-xs text-gray-500">
                {delta >= 0 ? '+' : ''}{delta}% vs. letzte Woche
              </span>
            </div>
          </div>

          <div>
            <div className="relative h-3 bg-gray-200 rounded-full overflow-visible">
              <div className={`h-full rounded-full ${cls.bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-indigo-400" style={{ left: `${ZIEL_MIN}%` }} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-indigo-300" style={{ left: `${ZIEL_MAX}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>0%</span>
              <span className="text-indigo-500">Ziel {ZIEL_MIN}–{ZIEL_MAX}%</span>
              <span>100%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Trend',  val: me.trend === 'up' ? '↑ Mehr Touren' : me.trend === 'down' ? '↓ Weniger Touren' : '→ Stabil' },
              { label: 'Ziel',   val: `${ZIEL_MIN}–${ZIEL_MAX}%` },
              { label: 'Ampel',  val: ampel === 'gruen' ? '🟢 Im Ziel' : ampel === 'gelb' ? '🟡 Knapp' : '🔴 Außerhalb' },
              { label: 'Touren', val: `${me.touren}` },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-lg p-2 text-center border border-gray-100">
                <div className="text-[10px] text-gray-500">{k.label}</div>
                <div className="text-xs font-semibold text-gray-800">{k.val}</div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
            <div className="text-[10px] text-gray-500">Team-Ø Auslastung</div>
            <div className="text-xs font-bold text-gray-800">{data.team_avg_pct}%</div>
          </div>

          <div className={`rounded-lg p-2 text-xs ${cls.bg} ${cls.text}`}>{tip}</div>
        </div>
      )}
    </div>
  );
}
