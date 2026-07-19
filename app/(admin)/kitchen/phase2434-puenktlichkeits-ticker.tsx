'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Clock } from 'lucide-react';

interface FahrerP {
  fahrer_id: string;
  fahrer_name: string;
  quote_pct: number;
  gesamt_stopps: number;
  puenktlich: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerP[];
  team_durchschnitt: number;
}

function ampelDot(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-red-500';
}

export function KitchenPhase2434PuenktlichkeitsTicker({ locationId }: { locationId?: string | null }) {
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

  const alerts = data?.fahrer.filter(f => f.quote_pct < 75) ?? [];
  const hasAlert = alerts.length > 0;

  return (
    <div className={`rounded-xl border mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className={hasAlert ? 'text-red-600' : 'text-blue-600'} />
          <span className={`font-semibold text-sm ${hasAlert ? 'text-red-800' : 'text-blue-800'}`}>
            Pünktlichkeit
            {data ? ` — Team-Ø ${data.team_durchschnitt.toFixed(1)}%` : ''}
          </span>
          {hasAlert && (
            <span className="text-xs bg-red-200 text-red-800 rounded-full px-2 py-0.5">
              {alerts.length} unter 75%
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
                <div className="flex items-start gap-2 bg-red-100 border border-red-200 rounded-lg p-2">
                  <AlertTriangle size={13} className="text-red-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-800">
                    Unter 75%: {alerts.map(f => f.fahrer_name).join(', ')} — Koordination prüfen!
                  </p>
                </div>
              )}
              <div className="space-y-1">
                {data.fahrer.map(f => (
                  <div key={f.fahrer_id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${ampelDot(f.ampel)}`} />
                      <span className="text-gray-700">{f.fahrer_name}</span>
                      {f.quote_pct < 75 && <AlertTriangle size={10} className="text-red-500" />}
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <span>{f.puenktlich}/{f.gesamt_stopps} pünktl.</span>
                      <span className="font-semibold">{f.quote_pct.toFixed(1)}%</span>
                    </div>
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
