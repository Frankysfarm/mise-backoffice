'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, XCircle } from 'lucide-react';

interface FahrerSQ {
  fahrer_id: string;
  fahrer_name: string;
  quote_pct: number;
  gesamt_touren: number;
  stornierungen: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerSQ[];
  team_durchschnitt: number;
  alert_count: number;
}

function ampelDot(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-red-500';
}

export function KitchenPhase2444StornoQuoteTicker({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-storno-quote?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const alerts = data?.fahrer.filter(f => f.quote_pct > 10) ?? [];
  const hasAlert = alerts.length > 0;

  return (
    <div className={`rounded-xl border mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-indigo-200 bg-indigo-50'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <XCircle size={16} className={hasAlert ? 'text-red-600' : 'text-indigo-600'} />
          <span className={`font-semibold text-sm ${hasAlert ? 'text-red-800' : 'text-indigo-800'}`}>
            Storno-Quote
            {data ? ` — Team-Ø ${data.team_durchschnitt.toFixed(1)}%` : ''}
          </span>
          {hasAlert && (
            <span className="text-xs bg-red-200 text-red-800 rounded-full px-2 py-0.5">
              {alerts.length} über 10%
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
                    Storno-Quote &gt;10%: {alerts.map(f => f.fahrer_name).join(', ')} — Dispatcher informieren und Routen/Adressen prüfen!
                  </p>
                </div>
              )}
              <div className="space-y-1">
                {[...data.fahrer].sort((a, b) => a.quote_pct - b.quote_pct).map(f => (
                  <div key={f.fahrer_id} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${ampelDot(f.ampel)}`} />
                    <span className="text-xs flex-1 truncate">{f.fahrer_name}</span>
                    <span className="text-xs font-semibold w-10 text-right">{f.quote_pct.toFixed(1)}%</span>
                    <span className="text-xs text-gray-400 w-16 text-right">{f.stornierungen}/{f.gesamt_touren} Touren</span>
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
