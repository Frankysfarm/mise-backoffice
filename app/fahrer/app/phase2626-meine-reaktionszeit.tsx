'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_min: number;
  touren_heute: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_durchschnitt: number;
}

function ampelVon(min: number): 'gruen' | 'gelb' | 'rot' {
  if (min <= 2) return 'gruen';
  if (min <= 5) return 'gelb';
  return 'rot';
}

function ampelStyle(ampel: string) {
  if (ampel === 'rot')  return { text: 'text-red-600',   bg: 'bg-red-50 border-red-200',    bar: 'bg-red-500'   };
  if (ampel === 'gelb') return { text: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', bar: 'bg-amber-400' };
  return                       { text: 'text-green-600', bg: 'bg-green-50 border-green-200', bar: 'bg-green-500' };
}

function coachingTipp(ampel: string, min: number): string {
  if (ampel === 'rot')  return `Deine Reaktionszeit beträgt ${min.toFixed(1)} Min — bitte Aufträge schneller annehmen! Ziel: ≤2 Min.`;
  if (ampel === 'gelb') return `Reaktionszeit ${min.toFixed(1)} Min. Etwas schneller annehmen und du erreichst das Ziel von ≤2 Min!`;
  return `Top! Deine Reaktionszeit von ${min.toFixed(1)} Min ist im grünen Bereich. Weiter so!`;
}

function TrendIcon({ trend }: { trend: 'steigend' | 'fallend' | 'stabil' }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-green-600" />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

function ZeitBalken({ min, barClass }: { min: number; barClass: string }) {
  const MAX     = 10;
  const ZIEL    = 2;
  const fill    = Math.min(100, (min  / MAX) * 100);
  const goalPct = Math.min(100, (ZIEL / MAX) * 100);
  return (
    <div className="relative h-3 rounded-full bg-gray-200">
      <div className={`absolute top-0 left-0 h-full rounded-full ${barClass}`} style={{ width: `${fill}%` }} />
      <div
        className="absolute top-0 h-full border-l-2 border-dashed border-green-500"
        style={{ left: `${goalPct}%` }}
        title="Ziel ≤2 Min"
      />
    </div>
  );
}

const MOCK_ME: FahrerEntry = {
  fahrer_id: 'me', fahrer_name: 'Ich',
  avg_min: 3.4, touren_heute: 9, trend: 'fallend', trend_delta: -0.6, rang: 2,
};

export function FahrerPhase2626MeineReaktionszeit({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen]       = useState(true);
  const [me, setMe]           = useState<FahrerEntry | null>(null);
  const [teamAvg, setTeamAvg] = useState<number>(0);

  useEffect(() => {
    if (!isOnline) return;
    if (!locationId) { setMe(MOCK_ME); setTeamAvg(4.5); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-reaktionszeit?location_id=${locationId}`)
        .then(r => r.json())
        .then((res: ApiData) => {
          setTeamAvg(res.team_durchschnitt ?? 0);
          const found = driverId ? res.fahrer.find((f: FahrerEntry) => f.fahrer_id === driverId) : null;
          setMe(found ?? (res.fahrer.length > 0 ? res.fahrer[0] : MOCK_ME));
        })
        .catch(() => { setMe(MOCK_ME); setTeamAvg(4.5); });
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !me) return null;

  const ampel = ampelVon(me.avg_min);
  const st    = ampelStyle(ampel);

  return (
    <div className={`rounded-xl border ${st.bg} shadow-sm mb-3`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-yellow-500" />
          <span className="font-semibold text-sm text-gray-800">Meine Reaktionszeit</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${st.text}`}>{me.avg_min.toFixed(1)} Min</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Hauptwert */}
          <div className="text-center py-2">
            <div className={`text-4xl font-black ${st.text}`}>{me.avg_min.toFixed(1)}</div>
            <div className="text-sm text-gray-500 font-medium mt-0.5">Minuten Ø Reaktionszeit</div>
            <div className="text-xs text-gray-400 mt-0.5">Ziel: ≤2 Min</div>
          </div>

          {/* Balken */}
          <ZeitBalken min={me.avg_min} barClass={st.bar} />
          <div className="flex justify-between text-xs text-gray-400">
            <span>0 Min</span>
            <span className="text-green-600">Ziel 2 Min</span>
            <span>10 Min</span>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <TrendIcon trend={me.trend} />
                <span className="text-base font-bold text-gray-700">
                  {me.trend_delta > 0 ? '+' : ''}{me.trend_delta.toFixed(1)} Min
                </span>
              </div>
              <div className="text-xs text-gray-400">Trend vs. gestern</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-green-600">≤2 Min</div>
              <div className="text-xs text-gray-400">Ziel</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-gray-700">#{me.rang}</div>
              <div className="text-xs text-gray-400">Rang heute</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-base font-bold text-gray-700">{teamAvg.toFixed(1)} Min</div>
              <div className="text-xs text-gray-400">Team Ø</div>
            </div>
          </div>

          {/* Coaching-Tipp */}
          <div className={`rounded-lg p-2.5 text-xs ${
            ampel === 'rot'  ? 'bg-red-100 text-red-800' :
            ampel === 'gelb' ? 'bg-amber-50 text-amber-800' :
            'bg-green-50 text-green-800'
          }`}>
            {coachingTipp(ampel, me.avg_min)}
          </div>
        </div>
      )}
    </div>
  );
}
