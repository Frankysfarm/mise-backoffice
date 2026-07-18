'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Briefcase } from 'lucide-react';

interface FahrerBilanz {
  fahrer_id: string;
  fahrer_name: string;
  touren: number;
  touren_vw: number;
  gesamt_km: number;
  einnahmen: number;
  einnahmen_vw: number;
  bewertung: number;
  schichtdauer_h: number;
  trend_einnahmen: 'steigend' | 'fallend' | 'stabil';
  trend_delta_einnahmen: number;
  ampel: 'gruen' | 'rot';
  alert_schicht: boolean;
}

interface ApiData {
  fahrer: FahrerBilanz[];
  team_touren: number;
  team_einnahmen: number;
  alert_count: number;
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-700 bg-green-50 border-green-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function ampelDot(a: string) {
  return a === 'gruen' ? 'bg-green-500' : 'bg-red-500';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={12} className="text-green-600" />;
  if (trend === 'fallend') return <TrendingDown size={12} className="text-red-500" />;
  return <Minus size={12} className="text-gray-400" />;
}

export function DispatchPhase2409SchichtBilanzBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-schicht-bilanz?location_id=${locationId}`);
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
    <div className={`rounded-xl border mb-3 ${hasAlert ? 'border-orange-300 bg-orange-50' : 'border-emerald-200 bg-emerald-50'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Briefcase size={16} className={hasAlert ? 'text-orange-600' : 'text-emerald-600'} />
          <span className={`font-semibold text-sm ${hasAlert ? 'text-orange-800' : 'text-emerald-800'}`}>
            Schicht-Bilanz-Board
            {data ? ` — ${data.team_touren} Touren · ${data.team_einnahmen.toFixed(0)} €` : ''}
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
        <div className="px-4 pb-4 space-y-3">
          {!data ? (
            <p className="text-xs text-gray-500">Lade…</p>
          ) : (
            <>
              {/* KPI Row */}
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-lg bg-white border border-emerald-100 p-2 text-center">
                  <div className="text-lg font-bold text-emerald-700">{data.team_touren}</div>
                  <div className="text-xs text-gray-500">Touren</div>
                </div>
                <div className="rounded-lg bg-white border border-emerald-100 p-2 text-center">
                  <div className="text-lg font-bold text-emerald-700">
                    {data.fahrer.reduce((s, f) => s + f.gesamt_km, 0).toFixed(0)} km
                  </div>
                  <div className="text-xs text-gray-500">Gesamt-km</div>
                </div>
                <div className="rounded-lg bg-white border border-emerald-100 p-2 text-center">
                  <div className="text-lg font-bold text-emerald-700">{data.team_einnahmen.toFixed(0)} €</div>
                  <div className="text-xs text-gray-500">Einnahmen</div>
                </div>
                <div className="rounded-lg bg-white border border-emerald-100 p-2 text-center">
                  <div className="text-lg font-bold text-emerald-700">
                    {data.fahrer.length > 0
                      ? (data.fahrer.reduce((s, f) => s + f.bewertung, 0) / data.fahrer.length).toFixed(1)
                      : '–'} ★
                  </div>
                  <div className="text-xs text-gray-500">Ø Bewertung</div>
                </div>
              </div>

              {/* Alert banner */}
              {hasAlert && (
                <div className="flex items-start gap-2 bg-orange-100 border border-orange-200 rounded-lg p-2">
                  <AlertTriangle size={14} className="text-orange-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-orange-800">
                    Schicht &gt;10h: {data.fahrer.filter(f => f.alert_schicht).map(f => `${f.fahrer_name} (${f.schichtdauer_h}h)`).join(', ')} — Bitte Pause prüfen!
                  </p>
                </div>
              )}

              {/* Driver list sorted by earnings */}
              <div className="space-y-1.5">
                {data.fahrer.map(f => (
                  <div key={f.fahrer_id} className={`rounded-lg border px-3 py-2 ${ampelColor(f.ampel)}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${ampelDot(f.ampel)}`} />
                        <span className="text-sm font-medium truncate">{f.fahrer_name}</span>
                        {f.alert_schicht && <AlertTriangle size={12} className="text-orange-600 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 text-xs shrink-0">
                        <TrendIcon trend={f.trend_einnahmen} />
                        <span className="font-bold">{f.einnahmen.toFixed(0)} €</span>
                        {f.trend_delta_einnahmen !== 0 && (
                          <span className={f.trend_delta_einnahmen > 0 ? 'text-green-600' : 'text-red-500'}>
                            ({f.trend_delta_einnahmen > 0 ? '+' : ''}{f.trend_delta_einnahmen.toFixed(0)})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 flex gap-3 text-xs opacity-70">
                      <span>{f.touren} Touren</span>
                      <span>{f.gesamt_km} km</span>
                      <span>{f.bewertung > 0 ? `${f.bewertung} ★` : '–'}</span>
                      <span>{f.schichtdauer_h}h Schicht</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Gute Bilanz</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Verbesserung nötig</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
