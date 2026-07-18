'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Star } from 'lucide-react';

interface FahrerFeiertag {
  fahrer_id: string;
  fahrer_name: string;
  feiertag_h: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_ueberlastung: boolean;
}

interface ApiData {
  fahrer: FahrerFeiertag[];
  team_avg_feiertag_h: number;
  alert_count: number;
}

function ampelDot(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-red-500';
}

function fmtH(h: number) {
  return `${h.toFixed(1)}h`;
}

export function KitchenPhase2450FeiertagsTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) return;
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-feiertagsschicht?location_id=${locationId}`)
        .then(r => r.json())
        .then(setData)
        .catch(console.error);
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!locationId || !data) return null;

  const hasAlerts = (data.alert_count ?? 0) > 0;
  const headerColor = hasAlerts ? 'bg-orange-50 border-orange-200' : 'bg-teal-50 border-teal-200';
  const headerText = hasAlerts ? 'text-orange-700' : 'text-teal-700';

  return (
    <div className={`border rounded-xl mb-3 overflow-hidden ${headerColor}`}>
      <button
        className={`w-full flex items-center justify-between px-4 py-2 font-semibold text-sm ${headerText}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2">
          <Star size={14} />
          Feiertags-Ticker
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
            <span className="text-gray-500 text-xs">Team-Ø Feiertagsschicht</span>
            <span className={`font-bold text-base ${data.team_avg_feiertag_h > 8 ? 'text-red-600' : data.team_avg_feiertag_h > 0 ? 'text-amber-600' : 'text-teal-600'}`}>
              {fmtH(data.team_avg_feiertag_h)}
            </span>
          </div>

          {/* Alert Banner */}
          {hasAlerts && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>
                <strong>Überlastung Feiertag:</strong>{' '}
                {data.fahrer.filter(f => f.alert_ueberlastung).map(f => f.fahrer_name).join(', ')} — &gt;8h Feiertagsschicht!
              </span>
            </div>
          )}

          {/* Fahrerliste kompakt */}
          <div className="space-y-1">
            {data.fahrer.map(f => (
              <div key={f.fahrer_id} className="flex items-center gap-2 text-xs py-0.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${ampelDot(f.ampel)}`} />
                <span className="flex-1 text-gray-700 truncate">{f.fahrer_name}</span>
                <span className={`font-semibold ${f.alert_ueberlastung ? 'text-red-600' : f.feiertag_h > 0 ? 'text-amber-600' : 'text-teal-600'}`}>
                  {fmtH(f.feiertag_h)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
