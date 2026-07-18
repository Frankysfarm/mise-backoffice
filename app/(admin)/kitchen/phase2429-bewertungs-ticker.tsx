'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Star } from 'lucide-react';

interface FahrerBw {
  fahrer_id: string;
  fahrer_name: string;
  avg_sterne: number;
  anzahl_bewertungen: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiData {
  fahrer: FahrerBw[];
  team_avg_sterne: number;
  alert_count: number;
}

function ampelDot(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-red-500';
}

export function KitchenPhase2429BewertungsTicker({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-bewertung?location_id=${locationId}`);
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
    <div className={`rounded-xl border mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-yellow-200 bg-yellow-50'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Star size={16} className={hasAlert ? 'text-red-600' : 'text-yellow-600'} />
          <span className={`font-semibold text-sm ${hasAlert ? 'text-red-800' : 'text-yellow-800'}`}>
            Bewertungen
            {data ? ` — Team-Ø ${data.team_avg_sterne.toFixed(1)} ★` : ''}
          </span>
          {hasAlert && (
            <span className="text-xs bg-red-200 text-red-800 rounded-full px-2 py-0.5">
              {data!.alert_count} unter 3,5 ★
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
                    Kritisch &lt;3,5 ★: {data.fahrer.filter(f => f.alert_niedrig).map(f => f.fahrer_name).join(', ')} — Kundenfeedback prüfen!
                  </p>
                </div>
              )}
              <div className="space-y-1">
                {data.fahrer.map(f => (
                  <div key={f.fahrer_id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${ampelDot(f.ampel)}`} />
                      <span className="text-gray-700">{f.fahrer_name}</span>
                      {f.alert_niedrig && <AlertTriangle size={10} className="text-red-500" />}
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <span>{f.anzahl_bewertungen} Bew.</span>
                      <span className="font-semibold">{f.avg_sterne.toFixed(1)} ★</span>
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
