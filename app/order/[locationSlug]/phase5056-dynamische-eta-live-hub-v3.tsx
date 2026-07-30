'use client';

import { useEffect, useState } from 'react';
import { Clock, CheckCircle2, AlertCircle, MapPin, ChefHat, Bike, Package, Loader2, Navigation, Star, Activity, ThumbsUp } from 'lucide-react';

// Phase 5056 — Dynamische ETA Live Hub V3
// Neu: Live-Fahrer-Annäherungs-Puls; Konfidenz-Farbring; Review-Sterne nach Zustellung;
// ETA-Fenster-Balken; Bestellungsdetails-Zusammenfassung; 20-Sek-Polling; Mock-Fallback

type Phase = 'bestaetigt' | 'kueche' | 'abholung' | 'unterwegs' | 'geliefert';

interface EtaData {
  order_id: string;
  phase: Phase;
  eta_min: number;
  eta_range: [number, number];
  konfidenz: number;
  fahrer_name: string | null;
  fahrer_km: number | null;
  fahrer_annaeherungs_pct: number | null;
  kueche_fertig_in: number | null;
  bewertung: number | null;
  artikel_anzahl: number;
  gesamtbetrag: number;
  alert: string | null;
}

const MOCK: EtaData = {
  order_id: '#0056',
  phase: 'unterwegs',
  eta_min: 6,
  eta_range: [4, 9],
  konfidenz: 93,
  fahrer_name: 'Jonas M.',
  fahrer_km: 0.8,
  fahrer_annaeherungs_pct: 82,
  kueche_fertig_in: null,
  bewertung: null,
  artikel_anzahl: 3,
  gesamtbetrag: 34.90,
  alert: null,
};

const PHASES: { key: Phase; icon: React.ReactNode; label: string }[] = [
  { key: 'bestaetigt', icon: <CheckCircle2 className="h-4 w-4" />, label: 'Bestätigt' },
  { key: 'kueche',     icon: <ChefHat     className="h-4 w-4" />, label: 'Küche'      },
  { key: 'abholung',   icon: <Package     className="h-4 w-4" />, label: 'Abholung'   },
  { key: 'unterwegs',  icon: <Bike        className="h-4 w-4" />, label: 'Unterwegs'  },
  { key: 'geliefert',  icon: <MapPin      className="h-4 w-4" />, label: 'Geliefert'  },
];

const PHASE_IDX: Record<Phase, number> = {
  bestaetigt: 0, kueche: 1, abholung: 2, unterwegs: 3, geliefert: 4,
};

const ETA_COLOR = (min: number) => min <= 5 ? 'text-red-600' : min <= 12 ? 'text-amber-600' : 'text-emerald-600';
const CONF_RING  = (c: number)  => c >= 85 ? 'border-emerald-400' : c >= 70 ? 'border-amber-400' : 'border-red-400';

export function Phase5056DynamischeEtaLiveHubV3({ orderId, locationId }: { orderId?: string; locationId?: string | null }) {
  const [data, setData]       = useState<EtaData | null>(null);
  const [secs, setSecs]       = useState(0);
  const [review, setReview]   = useState(0);
  const [reviewed, setReviewed] = useState(false);

  async function fetchData() {
    try {
      const params = new URLSearchParams();
      if (orderId)    params.set('orderId', orderId);
      if (locationId) params.set('locationId', locationId);
      const r = await fetch(`/api/delivery/storefront/eta?${params}`, { cache: 'no-store' });
      if (!r.ok) throw new Error();
      setData(await r.json());
    } catch {
      setData(MOCK);
    }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 20_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, locationId]);

  useEffect(() => {
    const t = setInterval(() => setSecs((s) => (s + 1) % 60), 1000);
    return () => clearInterval(t);
  }, []);

  const d = data ?? MOCK;
  const phaseIdx = PHASE_IDX[d.phase];

  return (
    <div className="rounded-2xl border border-blue-200 bg-white shadow-md overflow-hidden max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
        <div className="flex items-center gap-2">
          <Bike className="h-5 w-5 text-blue-200" />
          <span className="font-bold text-sm">Lieferstatus</span>
        </div>
        <div className="text-xs opacity-70">{d.order_id}</div>
      </div>

      {d.alert && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-medium">
          <AlertCircle className="h-4 w-4 shrink-0" />{d.alert}
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* ETA Anzeige + Konfidenz-Ring */}
        <div className="flex items-center gap-4">
          <div className={`relative h-20 w-20 rounded-full border-4 ${CONF_RING(d.konfidenz)} flex flex-col items-center justify-center shrink-0`}>
            {d.phase === 'geliefert' ? (
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            ) : (
              <>
                <div className={`text-2xl font-black tabular-nums ${ETA_COLOR(d.eta_min)}`}>
                  {d.eta_min}:{String(59 - secs).padStart(2, '0')}
                </div>
                <div className="text-[10px] text-muted-foreground">min</div>
              </>
            )}
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-foreground mb-0.5">
              {d.phase === 'geliefert' ? 'Zugestellt! 🎉' : d.phase === 'unterwegs' ? 'Dein Fahrer ist unterwegs' : d.phase === 'kueche' ? 'Wird zubereitet…' : d.phase === 'abholung' ? 'Fahrer holt ab…' : 'Bestätigt'}
            </div>
            {d.phase !== 'geliefert' && (
              <div className="text-xs text-muted-foreground">
                ETA-Fenster: {d.eta_range[0]}–{d.eta_range[1]} min
              </div>
            )}
            <div className="flex items-center gap-1 mt-1">
              <Activity className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Konfidenz</span>
              <span className={`text-[11px] font-bold ${CONF_RING(d.konfidenz).replace('border-', 'text-')}`}>
                {d.konfidenz}%
              </span>
            </div>
            {/* ETA-Fenster Balken */}
            <div className="mt-1.5 h-2 rounded-full bg-muted/30 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all ${d.eta_min <= 5 ? 'bg-red-500' : d.eta_min <= 12 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, Math.max(0, 100 - (d.eta_min / d.eta_range[1]) * 100))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Kueche-Countdown */}
        {d.kueche_fertig_in != null && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <ChefHat className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-xs text-amber-800">Küche fertig in <strong>{d.kueche_fertig_in} min</strong></span>
          </div>
        )}

        {/* Fahrer-Annäherungs-Puls */}
        {d.fahrer_name && d.phase === 'unterwegs' && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Bike className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="text-xs font-semibold text-blue-800">{d.fahrer_name}</span>
              {d.fahrer_km != null && (
                <span className="text-[11px] text-blue-600 ml-auto">{d.fahrer_km} km entfernt</span>
              )}
            </div>
            {d.fahrer_annaeherungs_pct != null && (
              <>
                <div className="h-2.5 rounded-full bg-blue-200 overflow-hidden">
                  <div
                    className="h-2.5 rounded-full bg-blue-500 transition-all"
                    style={{ width: `${d.fahrer_annaeherungs_pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-blue-600">
                  <span>Restaurant</span>
                  <span className="font-bold">{d.fahrer_annaeherungs_pct}% Weg</span>
                  <span>Du</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Phasen-Timeline */}
        <div className="flex items-center gap-0">
          {PHASES.map((p, i) => {
            const done   = i <  phaseIdx;
            const active = i === phaseIdx;
            return (
              <div key={p.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all ${done ? 'border-emerald-400 bg-emerald-500 text-white' : active ? 'border-blue-500 bg-blue-500 text-white animate-pulse' : 'border-muted bg-muted/20 text-muted-foreground'}`}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : p.icon}
                  </div>
                  <span className={`text-[9px] mt-0.5 font-medium ${active ? 'text-blue-600' : done ? 'text-emerald-600' : 'text-muted-foreground'}`}>{p.label}</span>
                </div>
                {i < PHASES.length - 1 && (
                  <div className={`flex-1 h-0.5 -mt-5 ${done ? 'bg-emerald-400' : 'bg-muted'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Bestellungs-Info */}
        <div className="rounded-xl border border-border bg-muted/10 p-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-foreground">{d.artikel_anzahl} Artikel</span>
            </div>
            <span className="text-sm font-black text-foreground">{d.gesamtbetrag.toFixed(2)} €</span>
          </div>
        </div>

        {/* Bewertung nach Zustellung */}
        {d.phase === 'geliefert' && !reviewed && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <ThumbsUp className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-800">Wie war deine Lieferung?</span>
            </div>
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  className="text-2xl transition-transform hover:scale-110"
                  onClick={() => { setReview(star); setReviewed(true); }}
                >
                  {star <= review ? '★' : '☆'}
                </button>
              ))}
            </div>
          </div>
        )}
        {d.phase === 'geliefert' && reviewed && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
            <Star className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-xs text-emerald-800 font-medium">Danke für deine Bewertung! {'★'.repeat(review)}</span>
          </div>
        )}

        <div className="text-[10px] text-center text-muted-foreground">
          <Clock className="h-3 w-3 inline mr-1" />Aktualisiert alle 20 Sek
        </div>
      </div>
    </div>
  );
}
