'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Navigation2, MapPin, Clock, CheckCircle2, Package,
  Phone, ChevronRight, AlertTriangle, Zap, Route, ArrowRight,
} from 'lucide-react';

// Phase 5207 — Mein Smart-Navigation-Hub (Fahrer-App)
// Aktueller-Stopp-Card mit Adresse + ETA + Kunden-Kontakt;
// Nächster-Stopp-Vorschau;
// Tour-Fortschritts-Dots + km-Rest;
// Navigation-App-Auswahl (Google Maps / Waze);
// Übergabe-Bestätigung CTA;
// 30-Sek-Polling; Mock-Fallback

interface TourStop {
  id: string;
  sequence: number;
  status: 'fertig' | 'unterwegs' | 'ausstehend' | 'problem';
  adresse: string;
  eta_min?: number | null;
  km?: number | null;
  betrag?: number | null;
  kunden_name?: string | null;
  kunden_telefon?: string | null;
  notiz?: string | null;
}

interface TourData {
  tour_id: string | null;
  stopps: TourStop[];
  gesamt_km: number;
  verbleibend_km: number;
  verbleibend_stopps: number;
  aktiver_stopp: TourStop | null;
  naechster_stopp: TourStop | null;
}

const MOCK: TourData = {
  tour_id: 'T-1234',
  gesamt_km: 18.4,
  verbleibend_km: 7.2,
  verbleibend_stopps: 2,
  stopps: [
    { id:'s1', sequence:1, status:'fertig',     adresse:'Hauptstr. 12, 52062 Aachen', eta_min:null, km:2.1, betrag:28.50, kunden_name:'Max M.', kunden_telefon:'+49 170 123456', notiz:null },
    { id:'s2', sequence:2, status:'fertig',     adresse:'Kirchweg 5, 52062 Aachen',   eta_min:null, km:1.8, betrag:34.00, kunden_name:'Gabi L.', kunden_telefon:null, notiz:null },
    { id:'s3', sequence:3, status:'unterwegs',  adresse:'Marktplatz 3, 52064 Aachen', eta_min:6,    km:2.3, betrag:22.00, kunden_name:'Jonas K.', kunden_telefon:'+49 160 987654', notiz:'Bitte klingeln bei Wohnung 4a' },
    { id:'s4', sequence:4, status:'ausstehend', adresse:'Ringstr. 9, 52066 Aachen',   eta_min:18,   km:1.0, betrag:38.00, kunden_name:'Sarah B.', kunden_telefon:null, notiz:null },
  ],
  aktiver_stopp: { id:'s3', sequence:3, status:'unterwegs', adresse:'Marktplatz 3, 52064 Aachen', eta_min:6, km:2.3, betrag:22.00, kunden_name:'Jonas K.', kunden_telefon:'+49 160 987654', notiz:'Bitte klingeln bei Wohnung 4a' },
  naechster_stopp: { id:'s4', sequence:4, status:'ausstehend', adresse:'Ringstr. 9, 52066 Aachen', eta_min:18, km:1.0, betrag:38.00, kunden_name:'Sarah B.', kunden_telefon:null, notiz:null },
};

function openNavi(adresse: string, app: 'google' | 'waze') {
  const enc = encodeURIComponent(adresse);
  if (app === 'google') window.open(`https://maps.google.com/?q=${enc}`, '_blank');
  else window.open(`https://www.waze.com/ul?q=${enc}`, '_blank');
}

export function FahrerPhase5207MeinSmartNavigationHub({
  driverId,
  isOnline,
}: {
  driverId: string;
  isOnline: boolean;
}) {
  const [data, setData] = useState<TourData | null>(null);
  const [useMock, setUseMock] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function load() {
    if (!isOnline) return;
    try {
      const res = await fetch(`/api/delivery/fahrer/aktuelle-tour?driver_id=${driverId}`);
      if (!res.ok) { setUseMock(true); setData(MOCK); return; }
      const d = await res.json();
      setData(d);
      setUseMock(false);
    } catch { setUseMock(true); setData(MOCK); }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, isOnline]);

  if (!isOnline) return null;
  const d = data ?? MOCK;
  if (!d.aktiver_stopp && !d.naechster_stopp) return null;

  const aktiv = d.aktiver_stopp;
  const naechst = d.naechster_stopp;
  const fertig = d.stopps.filter(s => s.status === 'fertig').length;
  const total = d.stopps.length;
  const progressPct = Math.round((fertig / total) * 100);

  async function handleUebergabe() {
    if (!aktiv) return;
    setConfirming(true);
    try {
      await fetch('/api/delivery/fahrer/stopp-bestaetigen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId, stopp_id: aktiv.id }),
      });
      await load();
    } catch { /* ignore */ }
    setConfirming(false);
  }

  return (
    <div className="space-y-3 mb-4">
      {/* Tour Progress */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-slate-200">Tour {d.tour_id ?? '–'}</span>
          </div>
          <span className="text-xs text-gray-500">{fertig}/{total} Stopps</span>
        </div>
        <div className="flex items-center gap-1.5 mb-2">
          {d.stopps.map(s => (
            <div key={s.id} className={cn('flex-1 h-2 rounded-full', s.status === 'fertig' ? 'bg-emerald-500' : s.status === 'unterwegs' ? 'bg-blue-500 animate-pulse' : s.status === 'problem' ? 'bg-red-500' : 'bg-slate-700')} />
          ))}
        </div>
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span>{progressPct}% erledigt</span>
          <span>{d.verbleibend_km.toFixed(1)} km verbleibend</span>
        </div>
      </div>

      {/* Aktiver Stopp */}
      {aktiv && (
        <div className="rounded-xl border border-blue-700/50 bg-blue-950/30 overflow-hidden">
          <div className="px-4 py-2 bg-blue-900/30 flex items-center gap-2 border-b border-blue-700/30">
            <Zap className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-semibold text-blue-200">Aktueller Stopp #{aktiv.sequence}</span>
            {aktiv.eta_min != null && (
              <span className="ml-auto flex items-center gap-1 text-xs text-blue-300">
                <Clock className="w-3 h-3" />{aktiv.eta_min} Min
              </span>
            )}
          </div>
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-white">{aktiv.adresse}</div>
                {aktiv.kunden_name && <div className="text-xs text-gray-400">{aktiv.kunden_name}</div>}
              </div>
              {aktiv.betrag != null && (
                <div className="ml-auto text-sm font-bold text-emerald-300 shrink-0">{aktiv.betrag.toFixed(2)}€</div>
              )}
            </div>
            {aktiv.notiz && (
              <div className="flex items-start gap-1.5 text-xs text-amber-300 bg-amber-900/20 rounded-lg px-2.5 py-1.5 border border-amber-700/30">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                {aktiv.notiz}
              </div>
            )}
            {/* Navigation Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => openNavi(aktiv.adresse, 'google')}
                className="flex-1 flex items-center justify-center gap-1.5 bg-blue-700/80 hover:bg-blue-600 text-white text-xs font-medium rounded-lg py-2 transition-colors"
              >
                <Navigation2 className="w-3.5 h-3.5" />Google Maps
              </button>
              <button
                onClick={() => openNavi(aktiv.adresse, 'waze')}
                className="flex-1 flex items-center justify-center gap-1.5 bg-sky-700/80 hover:bg-sky-600 text-white text-xs font-medium rounded-lg py-2 transition-colors"
              >
                <Navigation2 className="w-3.5 h-3.5" />Waze
              </button>
              {aktiv.kunden_telefon && (
                <a
                  href={`tel:${aktiv.kunden_telefon}`}
                  className="flex items-center justify-center gap-1 bg-slate-700/80 hover:bg-slate-600 text-white rounded-lg px-3 py-2 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
            {/* Übergabe CTA */}
            <button
              onClick={handleUebergabe}
              disabled={confirming}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl py-2.5 transition-colors"
            >
              {confirming ? (
                <span className="flex items-center gap-1.5"><Package className="w-4 h-4 animate-bounce" />Bestätige…</span>
              ) : (
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />Übergabe bestätigen</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Nächster Stopp Vorschau */}
      {naechst && (
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 px-4 py-3 flex items-center gap-3">
          <ArrowRight className="w-4 h-4 text-gray-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-gray-500 mb-0.5">Nächster Stopp #{naechst.sequence}</div>
            <div className="text-xs font-medium text-gray-300 truncate">{naechst.adresse}</div>
            {naechst.kunden_name && <div className="text-[10px] text-gray-500">{naechst.kunden_name}</div>}
          </div>
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            {naechst.eta_min != null && <span className="text-xs text-gray-400">{naechst.eta_min} Min</span>}
            {naechst.betrag != null && <span className="text-xs text-emerald-400">{naechst.betrag.toFixed(2)}€</span>}
            <ChevronRight className="w-3 h-3 text-gray-600" />
          </div>
        </div>
      )}

      {!d.verbleibend_stopps && (
        <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/10 px-4 py-3 flex items-center gap-2 text-sm text-emerald-300">
          <CheckCircle2 className="w-4 h-4" />
          <span>Tour abgeschlossen! Gut gemacht.</span>
        </div>
      )}

      {useMock && <div className="text-[10px] text-gray-600 text-right">Mock-Daten — API nicht verfügbar</div>}
    </div>
  );
}
