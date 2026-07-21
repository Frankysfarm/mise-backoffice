'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Route } from 'lucide-react';

interface FahrerSingle {
  id: string;
  name: string;
  km_gesamt: number;
  km_gesamt_vw: number;
  km_pro_tour: number;
  touren: number;
  trend: 'up' | 'down' | 'neutral';
  ampel: string;
}

interface ApiData {
  fahrer_single?: FahrerSingle;
  fahrer?: FahrerSingle[];
  team_km_gesamt: number;
}

const ZIEL_KM  = 50;
const ALERT_KM = 20;
const MAX_KM   = 150;

function calcAmpel(km: number): string {
  if (km < ALERT_KM) return 'rot';
  if (km < ZIEL_KM)  return 'gelb';
  return 'gruen';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(km: number): string {
  if (km >= ZIEL_KM)  return `${km.toFixed(1)} km — Stark! Du hast dein Tagesziel erreicht. Weiter so!`;
  if (km >= ALERT_KM) return `${km.toFixed(1)} km — Im gelben Bereich. Noch ${(ZIEL_KM - km).toFixed(1)} km bis zum Tagesziel ${ZIEL_KM} km.`;
  return `${km.toFixed(1)} km — Wenig Kilometer! Mehr Touren helfen beim Erreichen des Ziels ${ZIEL_KM} km.`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up')   return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'down') return <TrendingDown size={14} className="text-red-500"   />;
  return                       <Minus        size={14} className="text-gray-400"  />;
}

const MOCK_ME: FahrerSingle = {
  id: 'mock-me', name: 'Ich', km_gesamt: 42.3, km_gesamt_vw: 38.5, km_pro_tour: 6.1, touren: 7,
  trend: 'up', ampel: 'gelb',
};
const MOCK: ApiData = { fahrer_single: MOCK_ME, team_km_gesamt: 55.4 };

export function FahrerPhase2837MeineKilometer({
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
      fetch(`/api/delivery/admin/fahrer-kilometer?${params}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [isOnline, locationId, driverId]);

  if (!data) return null;

  const me = data.fahrer_single ?? data.fahrer?.find(f => f.id === driverId) ?? data.fahrer?.[0];
  if (!me) return null;

  const km      = me.km_gesamt;
  const ampel   = calcAmpel(km);
  const cls     = ampelCls(ampel);
  const barPct  = Math.min((km / MAX_KM) * 100, 100);
  const zielPct = Math.min((ZIEL_KM / MAX_KM) * 100, 100);
  const tip     = coaching(km);
  const delta   = Math.round((km - me.km_gesamt_vw) * 10) / 10;
  const headerBg = ampel === 'rot' ? 'border-red-300 bg-red-50' : ampel === 'gelb' ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50';

  return (
    <div className={`rounded-xl border p-4 mb-4 ${headerBg}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Route size={16} className="text-indigo-600" />
          <span className="font-semibold text-sm text-gray-800">Meine Kilometer</span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Hauptwert */}
          <div className="text-center">
            <div className={`text-4xl font-bold ${cls.big}`}>{km.toFixed(1)} km</div>
            <div className="text-xs text-gray-500 mt-1">Gesamtstrecke heute · {me.touren} Touren</div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendIcon trend={me.trend} />
              <span className="text-xs text-gray-500">
                {delta >= 0 ? '+' : ''}{delta.toFixed(1)} km vs. Vorwoche
              </span>
            </div>
          </div>

          {/* Balken 0–150 km mit Ziel-Linie 50 km */}
          <div>
            <div className="relative h-3 bg-gray-200 rounded-full overflow-visible">
              <div className={`h-full rounded-full ${cls.bar}`} style={{ width: `${barPct}%` }} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-indigo-400" style={{ left: `${zielPct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>0</span>
              <span className="text-indigo-500">Ziel {ZIEL_KM} km</span>
              <span>{MAX_KM} km</span>
            </div>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Trend',   val: me.trend === 'up' ? '↑ Steigend' : me.trend === 'down' ? '↓ Fallend' : '→ Stabil' },
              { label: 'Ziel',    val: `≥${ZIEL_KM} km` },
              { label: 'Ampel',   val: ampel === 'gruen' ? '🟢 Im Ziel' : ampel === 'gelb' ? '🟡 Knapp' : '🔴 Wenig km' },
              { label: 'Touren',  val: `${me.touren}` },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-lg p-2 text-center border border-gray-100">
                <div className="text-[10px] text-gray-500">{k.label}</div>
                <div className="text-xs font-semibold text-gray-800">{k.val}</div>
              </div>
            ))}
          </div>

          {/* Team-Ø */}
          <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
            <div className="text-[10px] text-gray-500">Team-Ø heute</div>
            <div className="text-xs font-bold text-gray-800">{data.team_km_gesamt.toFixed(1)} km</div>
          </div>

          {/* Coaching-Tipp */}
          <div className={`rounded-lg p-2 text-xs ${cls.bg} ${cls.text}`}>{tip}</div>
        </div>
      )}
    </div>
  );
}
