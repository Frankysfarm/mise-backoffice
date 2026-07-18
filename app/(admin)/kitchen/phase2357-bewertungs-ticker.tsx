'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Star } from 'lucide-react';

interface FahrerBewertungInfo {
  fahrer_id: string;
  fahrer_name: string;
  avg_bewertung: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerBewertungInfo[];
  team_avg: number;
  alert_count: number;
}

function ampelDot(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

export function KitchenPhase2357BewertungsTicker({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-kundenzufriedenheit?location_id=${locationId}`);
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

  const schlechtester = data.fahrer.slice().sort((a, b) => a.avg_bewertung - b.avg_bewertung)[0];

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-semibold text-gray-800 text-sm">
          <Star size={14} className="inline mr-1 text-yellow-500" />
          Bewertungs-Ticker
          {data.alert_count > 0 && (
            <span className="ml-2 text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5">
              {data.alert_count} Alert
            </span>
          )}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          {/* Team-Ø */}
          <div className="mb-3 px-3 py-2 bg-gray-50 rounded-lg flex items-center gap-2">
            <Star size={16} className="text-yellow-500 fill-yellow-400 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Team-Ø</p>
              <p className="font-bold text-base text-gray-800">{data.team_avg.toFixed(1)} / 5.0</p>
            </div>
          </div>

          {/* Alert */}
          {data.alert_count > 0 && schlechtester && (
            <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                {schlechtester.fahrer_name} hat nur {schlechtester.avg_bewertung.toFixed(1)}★ — Coaching empfohlen
              </span>
            </div>
          )}

          {/* Fahrerliste kompakt */}
          <div className="space-y-1.5">
            {data.fahrer.map((f) => (
              <div key={f.fahrer_id} className="flex items-center gap-2 py-0.5">
                <div className={`w-2 h-2 rounded-full shrink-0 ${ampelDot(f.ampel)}`} />
                <span className="text-xs text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
                <span className="text-xs font-semibold text-gray-800">{f.avg_bewertung.toFixed(1)}★</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
