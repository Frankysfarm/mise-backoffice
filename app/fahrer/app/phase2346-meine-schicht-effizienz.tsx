'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

interface FahrerEffizienz {
  fahrer_id: string;
  name: string;
  score: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  touren_pro_stunde: number;
  wartezeit_min: number;
}

interface ApiData {
  fahrer: FahrerEffizienz[];
  team_durchschnitt: number;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={14} className="text-green-500" />;
  if (trend === 'fallend') return <TrendingDown size={14} className="text-red-500" />;
  return <Minus size={14} className="text-gray-400" />;
}

function coachingTipp(score: number): string {
  if (score >= 75) return '🌟 Top-Leistung! Weiter so — du bist heute unter den Besten.';
  if (score >= 50) return '💪 Solide Schicht. Reduziere Wartezeiten für mehr Punkte.';
  return '⚠️ Score unter 50 — bitte Tempo anpassen und Wartezeiten minimieren.';
}

export function FahrerPhase2346MeineSchichtEffizienz({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId || !isOnline) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-schicht-effizienz?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId, isOnline]);

  if (!isOnline || !data) return null;
  const me = data.fahrer.find((f) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const scoreColor = me.ampel === 'gruen' ? 'text-green-600' : me.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-600';
  const bgColor = me.ampel === 'gruen' ? 'bg-green-50' : me.ampel === 'gelb' ? 'bg-yellow-50' : 'bg-red-50';

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-semibold text-gray-800 text-sm flex items-center gap-1">
          <Zap size={14} /> Meine Schicht-Effizienz
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          {/* Score */}
          <div className={`rounded-xl ${bgColor} flex flex-col items-center py-4 mb-3`}>
            <p className="text-xs text-gray-500 mb-1">Mein Effizienz-Score</p>
            <div className="flex items-center gap-2">
              <span className={`text-4xl font-black ${scoreColor}`}>{me.score}</span>
              <TrendIcon trend={me.trend} />
            </div>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-gray-500">Touren/h</p>
              <p className="font-bold text-gray-800">{me.touren_pro_stunde}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-gray-500">Wartezeit</p>
              <p className="font-bold text-gray-800">{me.wartezeit_min} min</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-gray-500">Team-Ø</p>
              <p className="font-bold text-gray-800">{data.team_durchschnitt}</p>
            </div>
          </div>

          {/* Coaching-Tipp */}
          <p className="text-xs text-gray-600 bg-blue-50 rounded-lg px-3 py-2">{coachingTipp(me.score)}</p>
          <p className="text-xs text-gray-400 mt-2 text-right">30-Min-Polling</p>
        </div>
      )}
    </div>
  );
}
