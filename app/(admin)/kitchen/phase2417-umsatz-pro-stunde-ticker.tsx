'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Euro } from 'lucide-react';

interface FahrerUPH {
  fahrer_id: string;
  fahrer_name: string;
  umsatz_pro_stunde: number;
  einnahmen: number;
  schichtdauer_h: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_ineffizient: boolean;
}

interface ApiData {
  fahrer: FahrerUPH[];
  team_avg_uph: number;
  alert_count: number;
}

function ampelDot(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-red-500';
}

export function KitchenPhase2417UmsatzProStundeTicker({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-umsatz-pro-stunde?location_id=${locationId}`);
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
    <div className={`rounded-xl border mb-3 ${hasAlert ? 'border-orange-300 bg-orange-50' : 'border-violet-200 bg-violet-50'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Euro size={16} className={hasAlert ? 'text-orange-600' : 'text-violet-600'} />
          <span className={`font-semibold text-sm ${hasAlert ? 'text-orange-800' : 'text-violet-800'}`}>
            Umsatz/h
            {data ? ` — Team-Ø ${data.team_avg_uph.toFixed(1)} €/h` : ''}
          </span>
          {hasAlert && (
            <span className="text-xs bg-orange-200 text-orange-800 rounded-full px-2 py-0.5">
              {data!.alert_count} unter 8 €/h
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
                    Unter 8 €/h: {data.fahrer.filter(f => f.alert_ineffizient).map(f => f.fahrer_name).join(', ')} — Effizienz prüfen!
                  </p>
                </div>
              )}
              <div className="space-y-1">
                {data.fahrer.map(f => (
                  <div key={f.fahrer_id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${ampelDot(f.ampel)}`} />
                      <span className="text-gray-700">{f.fahrer_name}</span>
                      {f.alert_ineffizient && <AlertTriangle size={10} className="text-orange-500" />}
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <span>{f.schichtdauer_h.toFixed(1)} h</span>
                      <span className="font-semibold">{f.umsatz_pro_stunde.toFixed(1)} €/h</span>
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
