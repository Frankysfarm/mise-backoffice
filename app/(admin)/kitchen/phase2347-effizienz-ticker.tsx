'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Zap } from 'lucide-react';

interface FahrerEffizienz {
  fahrer_id: string;
  name: string;
  score: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerEffizienz[];
  team_durchschnitt: number;
}

function dot(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

export function KitchenPhase2347EffizienzTicker({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-schicht-effizienz?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const alerts = data.fahrer.filter((f) => f.ampel === 'rot');
  const teamColor = data.team_durchschnitt >= 75 ? 'text-green-600' : data.team_durchschnitt >= 50 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-semibold text-gray-800 text-sm flex items-center gap-1">
          <Zap size={14} /> Effizienz-Ticker
          {alerts.length > 0 && (
            <span className="ml-2 text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5">{alerts.length} !</span>
          )}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">Team-Ø Effizienz</span>
            <span className={`text-xl font-black ${teamColor}`}>{data.team_durchschnitt}</span>
          </div>

          {alerts.length > 0 && (
            <div className="mb-2 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span><strong>{alerts.map((f) => f.name).join(', ')}</strong> — Effizienz kritisch (&lt;50)</span>
            </div>
          )}

          <div className="space-y-1">
            {data.fahrer.map((f) => (
              <div key={f.fahrer_id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${dot(f.ampel)}`} />
                  <span className="text-gray-700">{f.name}</span>
                </div>
                <span className="font-semibold text-gray-800">{f.score}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2 text-right">30-Min-Polling</p>
        </div>
      )}
    </div>
  );
}
