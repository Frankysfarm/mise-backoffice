'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Route } from 'lucide-react';

interface FahrerKilometer {
  id: string;
  name: string;
  km_gesamt: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerKilometer[];
  team_km_gesamt: number;
  alert_count: number;
}

function ampelDot(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-orange-500';
}

function fmtKm(km: number) {
  return `${km.toFixed(1)} km`;
}

export function KitchenPhase2392KilometerTicker({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-kilometer?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  const hasAlert = (data?.alert_count ?? 0) > 0;

  return (
    <div className={`rounded-xl border mb-3 ${hasAlert ? 'border-orange-300 bg-orange-50' : 'border-blue-200 bg-blue-50'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Route size={16} className={hasAlert ? 'text-orange-600' : 'text-blue-600'} />
          <span className={`font-semibold text-sm ${hasAlert ? 'text-orange-800' : 'text-blue-800'}`}>
            Kilometer {data ? `— Ø ${fmtKm(data.team_km_gesamt)}` : ''}
          </span>
          {hasAlert && (
            <span className="text-xs bg-orange-200 text-orange-800 rounded-full px-2 py-0.5">
              {data!.alert_count} Alert{data!.alert_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {!data ? (
            <p className="text-xs text-gray-500">Lade…</p>
          ) : (
            <>
              {hasAlert && (
                <div className="flex items-start gap-2 bg-orange-100 border border-orange-200 rounded-lg p-2">
                  <AlertTriangle size={13} className="text-orange-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-orange-800">
                    {data.fahrer.filter(f => f.alert).map(f => f.name).join(', ')} — über 150 km. Entlastung empfohlen.
                  </p>
                </div>
              )}
              <div className="space-y-1">
                {data.fahrer.map(f => (
                  <div key={f.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${ampelDot(f.ampel)}`} />
                      <span className="text-gray-700">{f.name}</span>
                    </div>
                    <span className="font-semibold text-gray-800">{fmtKm(f.km_gesamt)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
