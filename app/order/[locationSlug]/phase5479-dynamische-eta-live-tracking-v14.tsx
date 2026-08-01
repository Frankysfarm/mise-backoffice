'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, CheckCircle2, ChefHat, Bike, Package, Star, MapPin, Thermometer, Wind } from 'lucide-react';

// Phase 5479 — Dynamische ETA Live-Tracking V14
// Neu: Animierter Fahrer-Annäherungs-Indikator (Distanz-Balken pulsierend);
// Küchen-Transparenz-Badge (Aktivitätsstatus Küche);
// Zonen-Lieferzeit-Vergleich (deine Zone vs. Ø);
// Social-Proof Geliefert-Zähler (X Bestellungen heute);
// Geliefert-Konfetti-State + Bewertungs-Aufforderung;
// 5-Phasen-Statuslinie (Eingang→Küche→Verpackt→Fahrer→Geliefert);
// Live-Countdown mit Sekunden-Präzision; 30-Sek-Polling; Mock-Fallback

type Phase5 = 'eingang' | 'kueche' | 'verpackt' | 'fahrer' | 'geliefert';
type EtaKonfidenz = 'hoch' | 'mittel' | 'niedrig';
type KuecheStatus = 'aktiv' | 'ruhig' | 'voll';

interface TrackingData {
  bestellnr: string;
  phase: Phase5;
  eta_min: number;
  eta_sek: number;
  konfidenz: EtaKonfidenz;
  fahrer_name: string | null;
  fahrer_dist_km: number | null;
  fahrer_dist_max_km: number;
  kueche_fertig_pct: number;
  kueche_status: KuecheStatus;
  pktl_versprechen: boolean;
  wetter_warnung: string | null;
  zone_avg_min: number;
  zone_label: string;
  geliefert_heute: number;
  bewertung_pending: boolean;
  phasen_zeiten: { eingang: number; kueche: number; verpackt: number; fahrer: number; geliefert: number };
}

const MOCK: TrackingData = {
  bestellnr: '#2842',
  phase: 'fahrer',
  eta_min: 7,
  eta_sek: 33,
  konfidenz: 'hoch',
  fahrer_name: 'Lena',
  fahrer_dist_km: 1.4,
  fahrer_dist_max_km: 3.8,
  kueche_fertig_pct: 100,
  kueche_status: 'aktiv',
  pktl_versprechen: true,
  wetter_warnung: null,
  zone_avg_min: 24,
  zone_label: 'Innenstadt',
  geliefert_heute: 1247,
  bewertung_pending: false,
  phasen_zeiten: { eingang: 2, kueche: 11, verpackt: 1, fahrer: 8, geliefert: 0 },
};

const KONFIDENZ_COLOR: Record<EtaKonfidenz, string> = {
  hoch:    'text-emerald-600 bg-emerald-50 border-emerald-200',
  mittel:  'text-amber-600 bg-amber-50 border-amber-200',
  niedrig: 'text-red-600 bg-red-50 border-red-200',
};
const KONFIDENZ_LABEL: Record<EtaKonfidenz, string> = {
  hoch:    'Hohe Genauigkeit',
  mittel:  'Mittlere Genauigkeit',
  niedrig: 'Geringe Genauigkeit',
};

const KUECHE_LABEL: Record<KuecheStatus, string>  = { aktiv: 'Küche sehr aktiv', ruhig: 'Küche läuft gut', voll: 'Küche voll ausgelastet' };
const KUECHE_COLOR: Record<KuecheStatus, string>  = { aktiv: 'text-amber-700 bg-amber-50', ruhig: 'text-emerald-700 bg-emerald-50', voll: 'text-red-700 bg-red-50' };

const PHASES5: { key: Phase5; label: string }[] = [
  { key: 'eingang',   label: 'Eingang'   },
  { key: 'kueche',    label: 'Küche'     },
  { key: 'verpackt',  label: 'Verpackt'  },
  { key: 'fahrer',    label: 'Fahrer'    },
  { key: 'geliefert', label: 'Geliefert' },
];
const PHASE5_ORDER: Phase5[] = ['eingang', 'kueche', 'verpackt', 'fahrer', 'geliefert'];
function phase5Idx(p: Phase5) { return PHASE5_ORDER.indexOf(p); }

function secToDisplay(min: number, sek: number): string {
  const total = Math.max(0, min * 60 + sek);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function BestellPhase5479DynamischeEtaLiveTrackingV14({
  orderId,
  locationSlug,
}: {
  orderId?: string;
  locationSlug?: string;
}) {
  const [data, setData]       = useState<TrackingData>(MOCK);
  const [secTick, setSecTick] = useState(0);
  const [rating, setRating]   = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    tickRef.current = setInterval(() => setSecTick(t => t + 1), 1000);
    const poll = async () => {
      if (!orderId) return;
      try {
        const url = `/api/delivery/storefront/eta?order_id=${orderId}&location=${locationSlug ?? ''}&view=live_v14`;
        const r = await fetch(url);
        if (r.ok) { const j = await r.json(); setData(j); setSecTick(0); }
      } catch { /* keep mock */ }
    };
    poll();
    pollRef.current = setInterval(poll, 30_000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, locationSlug]);

  const currentIdx = phase5Idx(data.phase);
  const isDelivered = data.phase === 'geliefert';
  const etaSek = Math.max(0, data.eta_min * 60 + data.eta_sek - secTick);
  const displayMin = Math.floor(etaSek / 60);
  const displaySek = etaSek % 60;

  const fahrerPct = data.fahrer_dist_km !== null
    ? Math.round((1 - data.fahrer_dist_km / data.fahrer_dist_max_km) * 100)
    : 0;

  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${isDelivered ? 'border-emerald-200 bg-emerald-50' : 'border-matcha-100 bg-white'}`}>
      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-between ${isDelivered ? 'bg-emerald-100' : 'bg-matcha-50'}`}>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-matcha-500" />
          <span className="text-sm font-semibold text-matcha-700">Lieferstatus</span>
          <span className="text-xs text-matcha-400">{data.bestellnr}</span>
        </div>
        {!isDelivered && (
          <div className={`text-[10px] border rounded-full px-2 py-0.5 font-medium ${KONFIDENZ_COLOR[data.konfidenz]}`}>
            {KONFIDENZ_LABEL[data.konfidenz]}
          </div>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* 5-Phasen-Timeline */}
        <div className="flex items-center">
          {PHASES5.map((ph, i) => {
            const done    = i < currentIdx;
            const current = i === currentIdx;
            return (
              <div key={ph.key} className="flex-1 flex flex-col items-center">
                <div className="relative flex items-center w-full">
                  {i > 0 && (
                    <div className={`absolute right-1/2 w-full h-0.5 ${done || current ? 'bg-matcha-400' : 'bg-matcha-100'}`} />
                  )}
                  <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold mx-auto transition-all
                    ${done ? 'bg-matcha-500' : current ? 'bg-matcha-400 ring-2 ring-matcha-200 ring-offset-1' : 'bg-matcha-100'}`}
                  >
                    {done ? '✓' : i + 1}
                  </div>
                </div>
                <span className={`text-[9px] mt-1 font-medium text-center leading-none ${current ? 'text-matcha-600' : done ? 'text-matcha-400' : 'text-matcha-200'}`}>
                  {ph.label}
                </span>
                {data.phasen_zeiten[ph.key] > 0 && (
                  <span className="text-[8px] text-matcha-300">{data.phasen_zeiten[ph.key]}m</span>
                )}
              </div>
            );
          })}
        </div>

        {/* ETA Countdown */}
        {!isDelivered ? (
          <div className="text-center space-y-1">
            <div className="text-4xl font-black text-matcha-800 tabular-nums">
              {displayMin}:{String(displaySek).padStart(2, '0')}
            </div>
            <div className="text-xs text-matcha-500">Minuten verbleibend</div>
            {data.pktl_versprechen && (
              <div className="inline-flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                <CheckCircle2 className="h-3 w-3" />
                Pünktlichkeits-Versprechen aktiv
              </div>
            )}
          </div>
        ) : (
          <div className="text-center space-y-2 py-2">
            <div className="text-3xl">🎉</div>
            <div className="text-xl font-bold text-emerald-700">Geliefert!</div>
            <div className="text-xs text-matcha-500">Guten Appetit!</div>
          </div>
        )}

        {/* Fahrer-Annäherungs-Indikator */}
        {data.fahrer_name && data.fahrer_dist_km !== null && !isDelivered && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Bike className="h-3.5 w-3.5 text-matcha-500" />
                <span className="text-xs font-medium text-matcha-700">{data.fahrer_name} ist unterwegs</span>
              </div>
              <span className="text-xs text-matcha-500">{data.fahrer_dist_km.toFixed(1)} km entfernt</span>
            </div>
            <div className="h-2.5 rounded-full bg-matcha-100 overflow-hidden">
              <div
                className="h-2.5 rounded-full bg-matcha-400 transition-all duration-700 relative"
                style={{ width: `${Math.min(fahrerPct, 100)}%` }}
              >
                <div className="absolute right-0 top-0 bottom-0 w-3 bg-white/40 animate-pulse rounded-full" />
              </div>
            </div>
            <div className="flex justify-between text-[9px] text-matcha-400">
              <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />Restaurant</span>
              <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />Dein Standort</span>
            </div>
          </div>
        )}

        {/* Küchen-Transparenz + Zonen-Vergleich */}
        <div className="grid grid-cols-2 gap-2">
          <div className={`rounded-lg px-2.5 py-2 ${KUECHE_COLOR[data.kueche_status]}`}>
            <div className="flex items-center gap-1.5">
              <ChefHat className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium">{KUECHE_LABEL[data.kueche_status]}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-white/60">
              <div className="h-1.5 rounded-full bg-current transition-all duration-500"
                style={{ width: `${data.kueche_fertig_pct}%` }} />
            </div>
          </div>

          <div className="rounded-lg bg-matcha-50 border border-matcha-100 px-2.5 py-2">
            <div className="text-[10px] text-matcha-500 font-medium">{data.zone_label}</div>
            <div className="text-xs font-bold text-matcha-700 mt-0.5">
              {data.eta_min}m vs. Ø {data.zone_avg_min}m
            </div>
            <div className={`text-[9px] mt-0.5 ${data.eta_min < data.zone_avg_min ? 'text-emerald-600' : 'text-amber-600'}`}>
              {data.eta_min < data.zone_avg_min ? `${data.zone_avg_min - data.eta_min}m schneller als Ø` : `Ø Lieferzeit`}
            </div>
          </div>
        </div>

        {/* Wetter-Warnung */}
        {data.wetter_warnung && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2">
            <Wind className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span className="text-[10px] text-amber-700">{data.wetter_warnung}</span>
          </div>
        )}

        {/* Social Proof */}
        <div className="flex items-center justify-center gap-1 text-[10px] text-matcha-400">
          <Package className="h-3 w-3" />
          <span>Heute bereits {data.geliefert_heute.toLocaleString('de-DE')} Bestellungen geliefert</span>
        </div>

        {/* Bewertungs-Aufforderung nach Lieferung */}
        {isDelivered && data.bewertung_pending && (
          <div className="rounded-xl bg-matcha-800 text-white p-4 text-center space-y-2">
            <div className="text-sm font-semibold">Wie war deine Bestellung?</div>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  className="transition-transform hover:scale-110"
                >
                  <Star className={`h-7 w-7 ${n <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-matcha-400'}`} />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <button className="text-xs bg-matcha-600 hover:bg-matcha-500 px-4 py-1.5 rounded-full transition-colors">
                Bewertung abschicken
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
