'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerPuenktlichkeit {
  fahrer_id: string;
  fahrer_name: string;
  quote_pct: number;
  gesamt_stopps: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
}

interface ApiData {
  fahrer: FahrerPuenktlichkeit[];
  team_durchschnitt: number;
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-600 bg-green-50 border-green-200';
  if (a === 'gelb') return 'text-yellow-700 bg-yellow-50 border-yellow-200';
  return 'text-red-600 bg-red-50 border-red-200';
}

function ampelDot(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={12} className="text-green-600" />;
  if (trend === 'fallend') return <TrendingDown size={12} className="text-red-500" />;
  return <Minus size={12} className="text-gray-400" />;
}

export function DispatchPhase2359PuenktlichkeitsBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-puenktlichkeit?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return null;

  const alertFahrer = data.fahrer.filter((f) => f.ampel === 'rot');
  const top3 = data.fahrer.slice(0, 3);
  const rest = data.fahrer.slice(3);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-semibold text-gray-800 text-sm">
          <Clock size={14} className="inline mr-1 text-blue-500" />
          Pünktlichkeits-Board
          {alertFahrer.length > 0 && (
            <span className="ml-2 text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5">
              {alertFahrer.length} Alert
            </span>
          )}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          {alertFahrer.length > 0 && (
            <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{alertFahrer.length} Fahrer unter 65% Pünktlichkeit — Coaching empfohlen</span>
            </div>
          )}

          <div className="mb-3 flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
            <Clock size={18} className="text-blue-500 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Team-Ø Pünktlichkeit</p>
              <p className="font-bold text-lg text-gray-800">{data.team_durchschnitt.toFixed(1)}%</p>
            </div>
          </div>

          {top3.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {top3.map((f, i) => (
                <div key={f.fahrer_id} className={`rounded-lg border px-2 py-2 text-center ${ampelColor(f.ampel)}`}>
                  <p className="text-lg font-bold">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</p>
                  <p className="text-xs font-semibold truncate">{f.fahrer_name}</p>
                  <p className="text-sm font-bold">{f.quote_pct.toFixed(1)}%</p>
                </div>
              ))}
            </div>
          )}

          {rest.length > 0 && (
            <div className="space-y-1.5">
              {rest.map((f) => (
                <div key={f.fahrer_id} className="flex items-center gap-2 py-1">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${ampelDot(f.ampel)}`} />
                  <span className="text-xs text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
                  <span className="text-xs font-semibold text-gray-800">{f.quote_pct.toFixed(1)}%</span>
                  <TrendIcon trend={f.trend} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
