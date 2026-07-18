'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Moon } from 'lucide-react';

interface FahrerNacht {
  fahrer_id: string;
  fahrer_name: string;
  nacht_h: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_erschoepfung: boolean;
}

interface ApiData {
  fahrer: FahrerNacht[];
  team_avg_nacht_h: number;
  alert_count: number;
}

function ampelDot(a: string) {
  if (a === 'gruen') return 'bg-indigo-400';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-red-500';
}

function fmtH(h: number) {
  return `${h.toFixed(1)}h`;
}

export function KitchenPhase2440NachtschichtTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) return;
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-nachtschicht?location_id=${locationId}`)
        .then(r => r.json())
        .then(setData)
        .catch(console.error);
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!locationId || !data) return null;

  const hasAlerts = (data.alert_count ?? 0) > 0;
  const headerColor = hasAlerts ? 'bg-orange-50 border-orange-200' : 'bg-indigo-50 border-indigo-200';
  const headerText = hasAlerts ? 'text-orange-700' : 'text-indigo-700';

  return (
    <div className={`border rounded-xl mb-3 overflow-hidden ${headerColor}`}>
      <button
        className={`w-full flex items-center justify-between px-4 py-2 font-semibold text-sm ${headerText}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2">
          <Moon size={14} />
          Nachtschicht-Ticker
          {hasAlerts && (
            <span className="ml-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              {data.alert_count}
            </span>
          )}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="bg-white px-4 pb-3 pt-2 space-y-2">
          {/* Header KPI */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 text-xs">Team-Ø Nachtschicht</span>
            <span className={`font-bold text-base ${data.team_avg_nacht_h > 4 ? 'text-red-600' : data.team_avg_nacht_h > 0 ? 'text-amber-600' : 'text-indigo-600'}`}>
              {fmtH(data.team_avg_nacht_h)}
            </span>
          </div>

          {/* Alert Banner */}
          {hasAlerts && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>
                <strong>Erschöpfungsrisiko:</strong>{' '}
                {data.fahrer.filter(f => f.alert_erschoepfung).map(f => f.fahrer_name).join(', ')}
              </span>
            </div>
          )}

          {/* Fahrerliste kompakt */}
          <div className="space-y-1">
            {data.fahrer.map(f => (
              <div key={f.fahrer_id} className="flex items-center gap-2 text-xs py-0.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${ampelDot(f.ampel)}`} />
                <span className="flex-1 text-gray-700 truncate">{f.fahrer_name}</span>
                <span className={`font-semibold ${f.alert_erschoepfung ? 'text-red-600' : f.nacht_h > 0 ? 'text-amber-600' : 'text-indigo-500'}`}>
                  {fmtH(f.nacht_h)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
