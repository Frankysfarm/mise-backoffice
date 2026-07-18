'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Briefcase } from 'lucide-react';

interface FahrerBilanz {
  fahrer_id: string;
  fahrer_name: string;
  touren: number;
  touren_vw: number;
  gesamt_km: number;
  gesamt_km_vw: number;
  einnahmen: number;
  einnahmen_vw: number;
  bewertung: number;
  bewertung_vw: number;
  schichtdauer_h: number;
  schichtdauer_h_vw: number;
  trend_einnahmen: 'steigend' | 'fallend' | 'stabil';
  trend_delta_einnahmen: number;
  ampel: 'gruen' | 'rot';
  alert_schicht: boolean;
}

interface ApiData {
  fahrer_single: FahrerBilanz;
  team_touren: number;
  team_einnahmen: number;
}

function ampelBg(a: string) {
  if (a === 'gruen') return 'bg-green-50 border-green-200 text-green-800';
  return 'bg-red-50 border-red-200 text-red-800';
}

function ampelText(a: string) {
  return a === 'gruen' ? 'text-green-600' : 'text-red-600';
}

function coachingTipp(f: FahrerBilanz): string {
  if (f.alert_schicht) return `Schicht dauert bereits ${f.schichtdauer_h}h — bitte eine Pause einlegen und mit dem Dispatcher sprechen!`;
  if (f.ampel === 'gruen') return 'Super Schicht! Touren, Einnahmen und Bewertung sind alle im grünen Bereich. Weiter so!';
  const hinweise: string[] = [];
  if (f.einnahmen < 80) hinweise.push('Einnahmen steigern (Ziel ≥80 €)');
  if (f.bewertung < 4.0) hinweise.push('Kundenbewertung verbessern (Ziel ≥4,0)');
  if (f.touren < 5) hinweise.push('Mehr Touren annehmen (Ziel ≥5)');
  return hinweise.length ? `Verbesserungspotenzial: ${hinweise[0]}.` : 'Schicht läuft ok — weiter so!';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={14} className="text-green-600" />;
  if (trend === 'fallend') return <TrendingDown size={14} className="text-red-500" />;
  return <Minus size={14} className="text-gray-400" />;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2410MeineSchichtBilanz({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!driverId || !locationId || !isOnline) return;
    try {
      const r = await fetch(
        `/api/delivery/admin/fahrer-schicht-bilanz?location_id=${locationId}&driver_id=${driverId}`,
      );
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline) return null;

  const f = data?.fahrer_single;

  return (
    <div className={`rounded-xl border mb-3 ${f ? ampelBg(f.ampel) : 'bg-emerald-50 border-emerald-200'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Briefcase size={16} className={f ? ampelText(f.ampel) : 'text-emerald-600'} />
          <span className={`font-semibold text-sm ${f ? ampelText(f.ampel) : 'text-emerald-800'}`}>
            Meine Schicht-Bilanz
            {f ? ` — ${f.einnahmen.toFixed(0)} €` : ''}
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!f ? (
            <p className="text-xs text-gray-500">Lade…</p>
          ) : (
            <>
              {/* Hero: Einnahmen */}
              <div className="text-center py-2">
                <div className={`text-5xl font-bold ${ampelText(f.ampel)}`}>{f.einnahmen.toFixed(0)} €</div>
                <div className="text-xs text-gray-500 mt-1">Heutige Einnahmen</div>
              </div>

              {/* 4-KPI Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white/60 border border-white p-2 text-center">
                  <div className="text-lg font-bold text-gray-800">{f.touren}</div>
                  <div className="text-xs text-gray-500">Touren (VW: {f.touren_vw})</div>
                </div>
                <div className="rounded-lg bg-white/60 border border-white p-2 text-center">
                  <div className="text-lg font-bold text-gray-800">{f.gesamt_km} km</div>
                  <div className="text-xs text-gray-500">Gesamt-km (VW: {f.gesamt_km_vw})</div>
                </div>
                <div className="rounded-lg bg-white/60 border border-white p-2 text-center">
                  <div className="text-lg font-bold text-gray-800">
                    {f.bewertung > 0 ? `${f.bewertung} ★` : '–'}
                  </div>
                  <div className="text-xs text-gray-500">Ø Bewertung (VW: {f.bewertung_vw > 0 ? f.bewertung_vw : '–'})</div>
                </div>
                <div className={`rounded-lg bg-white/60 border p-2 text-center ${f.alert_schicht ? 'border-orange-300 bg-orange-50' : 'border-white'}`}>
                  <div className={`text-lg font-bold ${f.alert_schicht ? 'text-orange-700' : 'text-gray-800'}`}>{f.schichtdauer_h}h</div>
                  <div className="text-xs text-gray-500">Schichtdauer {f.alert_schicht ? '⚠️' : ''}</div>
                </div>
              </div>

              {/* Trend vs VW */}
              <div className="rounded-lg bg-white/50 border border-white p-2 flex items-center justify-between">
                <span className="text-xs text-gray-600">Trend Einnahmen vs. Vorwoche</span>
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <TrendIcon trend={f.trend_einnahmen} />
                  <span className={f.trend_delta_einnahmen > 0 ? 'text-green-700' : f.trend_delta_einnahmen < 0 ? 'text-red-600' : 'text-gray-600'}>
                    {f.trend_delta_einnahmen > 0 ? '+' : ''}{f.trend_delta_einnahmen.toFixed(0)} € (VW: {f.einnahmen_vw.toFixed(0)} €)
                  </span>
                </div>
              </div>

              {/* Coaching tip */}
              <div className="rounded-lg bg-white/50 border border-white p-3 text-xs text-gray-700">
                💡 {coachingTipp(f)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
