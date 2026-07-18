'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Clock } from 'lucide-react';

interface FahrerPuenktlichkeit {
  fahrer_id: string;
  fahrer_name: string;
  quote_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerPuenktlichkeit[];
  team_durchschnitt: number;
}

function ampelDot(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

export function KitchenPhase2362PuenktlichkeitsTicker({ locationId }: { locationId?: string | null }) {
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

  const schlechtester = data.fahrer.slice().sort((a, b) => a.quote_pct - b.quote_pct)[0];
  const alertFahrer = data.fahrer.filter((f) => f.ampel === 'rot');

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-semibold text-gray-800 text-sm">
          <Clock size={14} className="inline mr-1 text-blue-500" />
          Pünktlichkeits-Ticker
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
          <div className="mb-3 px-3 py-2 bg-gray-50 rounded-lg flex items-center gap-2">
            <Clock size={16} className="text-blue-500 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Team-Ø Pünktlichkeit</p>
              <p className="font-bold text-base text-gray-800">{data.team_durchschnitt.toFixed(1)}%</p>
            </div>
          </div>

          {alertFahrer.length > 0 && schlechtester && (
            <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                {schlechtester.fahrer_name} nur {schlechtester.quote_pct.toFixed(1)}% pünktlich — Routing prüfen
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            {data.fahrer.map((f) => (
              <div key={f.fahrer_id} className="flex items-center gap-2 py-0.5">
                <div className={`w-2 h-2 rounded-full shrink-0 ${ampelDot(f.ampel)}`} />
                <span className="text-xs text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
                <span className="text-xs font-semibold text-gray-800">{f.quote_pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
