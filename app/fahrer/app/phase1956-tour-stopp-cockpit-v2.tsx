'use client';

import { useEffect, useState } from 'react';
import { MapPin, CheckCircle2, Navigation, Clock, Euro, AlertTriangle, ChevronRight, QrCode, Zap } from 'lucide-react';

// Phase 1956 — Tour-Stopp-Cockpit V2
// Neu: Ankunfts-Bestätigung (Tap-to-Confirm); Kunden-QR-Code-Anzeige;
// Bonus-Indikator je Stopp; Stopp-Kommentar; Fahrer-ETA-Live;
// 15s-Polling; Mock-Fallback

type StopStatus = 'anfahrt' | 'angekommen' | 'abgeliefert' | 'problem';
type BonusType = 'pünktlich' | 'strecke' | 'bewertung' | null;

interface TourStop {
  id: string;
  reihenfolge: number;
  adresse: string;
  name: string;
  status: StopStatus;
  eta_min: number | null;
  betrag: number | null;
  bonus: BonusType;
  bonus_betrag: number | null;
  kommentar: string | null;
  qr_code: string | null;
  klingel: string | null;
}

interface TourData {
  tour_id: string;
  stopps_gesamt: number;
  stopps_erledigt: number;
  naechster_stopp: TourStop | null;
  aktuelle_stopps: TourStop[];
  bonus_gesamt: number;
  score_live: number;
  timestamp: string;
}

const MOCK: TourData = {
  tour_id: 'T-2024-07',
  stopps_gesamt: 5,
  stopps_erledigt: 2,
  score_live: 93,
  bonus_gesamt: 1.50,
  timestamp: new Date().toISOString(),
  naechster_stopp: {
    id: 's3', reihenfolge: 3,
    adresse: 'Kapuzinerstr. 12, 52062 Aachen',
    name: 'Max Müller',
    status: 'anfahrt',
    eta_min: 4,
    betrag: 38.50,
    bonus: 'pünktlich',
    bonus_betrag: 0.50,
    kommentar: 'Klingelschild „Müller", 2. OG links',
    qr_code: 'QR-T2024-07-S3',
    klingel: 'Müller (2. OG)',
  },
  aktuelle_stopps: [
    { id: 's1', reihenfolge: 1, adresse: 'Theaterplatz 5', name: 'Julia K.',  status: 'abgeliefert', eta_min: null, betrag: 24.80, bonus: 'pünktlich', bonus_betrag: 0.50, kommentar: null, qr_code: null, klingel: null },
    { id: 's2', reihenfolge: 2, adresse: 'Büchel 7',       name: 'Tom S.',    status: 'abgeliefert', eta_min: null, betrag: 31.20, bonus: 'strecke',   bonus_betrag: 0.50, kommentar: null, qr_code: null, klingel: null },
    { id: 's3', reihenfolge: 3, adresse: 'Kapuzinerstr. 12', name: 'Max M.',  status: 'anfahrt',     eta_min: 4,   betrag: 38.50, bonus: 'pünktlich', bonus_betrag: 0.50, kommentar: 'Klingelschild „Müller"', qr_code: 'QR-S3', klingel: 'Müller (2. OG)' },
    { id: 's4', reihenfolge: 4, adresse: 'Pontstr. 44',    name: 'Sara L.',   status: 'anfahrt',     eta_min: 18,  betrag: 19.90, bonus: null,         bonus_betrag: null, kommentar: null, qr_code: null, klingel: null },
    { id: 's5', reihenfolge: 5, adresse: 'Nordfriedhof 2', name: 'Ahmed R.',  status: 'anfahrt',     eta_min: 31,  betrag: 44.00, bonus: 'bewertung',  bonus_betrag: 0.50, kommentar: 'Bitte klingeln', qr_code: 'QR-S5', klingel: null },
  ],
};

const STATUS_STYLES: Record<StopStatus, { bg: string; text: string; label: string; icon: string }> = {
  anfahrt:     { bg: 'bg-blue-950/40',   text: 'text-blue-300',   label: 'Anfahrt',     icon: '🚴' },
  angekommen:  { bg: 'bg-yellow-950/40', text: 'text-yellow-300', label: 'Angekommen',  icon: '📍' },
  abgeliefert: { bg: 'bg-green-950/30',  text: 'text-green-400',  label: 'Abgeliefert', icon: '✅' },
  problem:     { bg: 'bg-red-950/40',    text: 'text-red-300',    label: 'Problem',     icon: '⚠️' },
};

const BONUS_LABELS: Record<Exclude<BonusType, null>, string> = {
  pünktlich: '⚡ Pünktlichkeits-Bonus',
  strecke:   '🛣️ Strecken-Bonus',
  bewertung: '⭐ Bewertungs-Bonus',
};

export function FahrerPhase1956TourStoppCockpitV2() {
  const [data, setData] = useState<TourData>(MOCK);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [showQr, setShowQr] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/delivery/fahrer/tour');
        if (r.ok) setData(await r.json());
      } catch { /* mock */ }
    };
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, []);

  const fortschritt = Math.round((data.stopps_erledigt / data.stopps_gesamt) * 100);
  const ns = data.naechster_stopp;

  const handleAnkunft = (stoppId: string) => {
    setConfirmedId(stoppId);
    // In der echten App: POST /api/delivery/fahrer/stopp-ankunft
  };

  return (
    <div className="bg-gray-950 border border-blue-900/40 rounded-2xl p-4 space-y-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-white text-sm">Tour-Cockpit V2</span>
          <span className="text-xs text-gray-500">{data.tour_id}</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-bold text-yellow-300">{data.score_live}</span>
        </div>
      </div>

      {/* Fortschritts-Balken */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>{data.stopps_erledigt}/{data.stopps_gesamt} Stopps</span>
          <span className="text-green-400 font-medium">+€{data.bonus_gesamt.toFixed(2)} Bonus</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-green-500 rounded-full transition-all duration-700"
            style={{ width: `${fortschritt}%` }}
          />
        </div>
      </div>

      {/* Nächster Stopp — Fokus-Card */}
      {ns && (
        <div className="bg-blue-950/30 border border-blue-700/50 rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-blue-400 font-medium mb-0.5">Nächster Stopp #{ns.reihenfolge}</div>
              <div className="font-bold text-white">{ns.name}</div>
              <div className="text-sm text-gray-300">{ns.adresse}</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-blue-300">{ns.eta_min} Min</div>
              <div className="text-xs text-gray-500">ETA</div>
            </div>
          </div>

          {/* Klingel-Info */}
          {ns.klingel && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{ns.klingel}</span>
            </div>
          )}

          {/* Kommentar */}
          {ns.kommentar && (
            <div className="bg-gray-900/60 rounded-lg px-3 py-2 text-xs text-gray-300">
              💬 {ns.kommentar}
            </div>
          )}

          {/* Bonus-Indikator */}
          {ns.bonus && ns.bonus_betrag && (
            <div className="flex items-center gap-2 bg-yellow-950/30 border border-yellow-700/40 rounded-lg px-3 py-1.5">
              <span className="text-xs text-yellow-300">{BONUS_LABELS[ns.bonus]}</span>
              <span className="ml-auto text-xs font-bold text-yellow-300">+€{ns.bonus_betrag.toFixed(2)}</span>
            </div>
          )}

          {/* Betrag + QR + Ankunft */}
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-900/60 rounded-lg px-3 py-2 text-center">
              <div className="text-base font-bold text-green-300">€{ns.betrag?.toFixed(2)}</div>
              <div className="text-xs text-gray-500">Betrag</div>
            </div>

            {ns.qr_code && (
              <button
                onClick={() => setShowQr(showQr === ns.id ? null : ns.id)}
                className="bg-gray-900/60 rounded-lg p-2.5 flex items-center gap-1.5 text-xs text-gray-300 hover:bg-gray-800 transition-colors"
              >
                <QrCode className="w-4 h-4" />
                QR
              </button>
            )}

            {confirmedId !== ns.id ? (
              <button
                onClick={() => handleAnkunft(ns.id)}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <MapPin className="w-4 h-4" />
                Angekommen
              </button>
            ) : (
              <div className="flex-1 bg-green-800/40 border border-green-700/50 rounded-lg py-2.5 text-sm font-semibold text-green-300 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Bestätigt
              </div>
            )}
          </div>

          {/* QR-Code-Anzeige */}
          {showQr === ns.id && ns.qr_code && (
            <div className="bg-white rounded-lg p-4 flex items-center justify-center">
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">{ns.qr_code}</div>
                <div className="w-24 h-24 bg-gray-100 border-2 border-gray-300 rounded-lg flex items-center justify-center">
                  <QrCode className="w-16 h-16 text-gray-800" />
                </div>
                <div className="text-xs text-gray-500 mt-1">Scan für Bestätigung</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stopp-Übersicht */}
      <div className="space-y-2">
        <div className="text-xs text-gray-500 font-medium">Alle Stopps</div>
        {data.aktuelle_stopps.map(s => {
          const st = STATUS_STYLES[s.status];
          return (
            <div key={s.id} className={`${st.bg} border border-gray-800/50 rounded-lg p-2.5 flex items-center gap-3`}>
              <span className="text-xs text-gray-500 w-5">{s.reihenfolge}.</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{s.name}</span>
                  {s.bonus && <span className="text-xs text-yellow-400">+€{s.bonus_betrag?.toFixed(2)}</span>}
                </div>
                <div className="text-xs text-gray-400 truncate">{s.adresse}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className={`text-xs font-medium ${st.text}`}>{st.label}</div>
                {s.eta_min !== null && <div className="text-xs text-gray-500">{s.eta_min} Min</div>}
                {s.betrag && <div className="text-xs text-gray-400">€{s.betrag.toFixed(2)}</div>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-xs text-gray-600 text-right">
        {new Date(data.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}
