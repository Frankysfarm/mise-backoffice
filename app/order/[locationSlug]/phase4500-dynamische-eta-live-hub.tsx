'use client';

import { useEffect, useState } from 'react';
import { Clock, CheckCircle2, AlertCircle, MapPin, ChefHat, Bike, Package, Loader2 } from 'lucide-react';

// Phase 4500 — Dynamische ETA Live Hub
// Bestell-Status-Timeline; Live-ETA-Countdown; Fahrer-Annäherungs-Indikator;
// Phasensymbol Küche→Abholung→Unterwegs→Geliefert; Konfidenz-Balken;
// 20-Sek-Polling; Mock-Fallback

type Phase = 'bestaetigt' | 'kueche' | 'abholung' | 'unterwegs' | 'geliefert';

interface EtaData {
  order_id: string;
  phase: Phase;
  eta_min: number;
  eta_range: [number, number];
  konfidenz: number;
  fahrer_name: string | null;
  fahrer_km: number | null;
  kueche_fertig_in: number | null;
  alert: string | null;
}

const MOCK: EtaData = {
  order_id: '#0042',
  phase: 'unterwegs',
  eta_min: 8,
  eta_range: [6, 11],
  konfidenz: 87,
  fahrer_name: 'Jonas M.',
  fahrer_km: 1.4,
  kueche_fertig_in: null,
  alert: null,
};

const PHASES: { key: Phase; icon: React.ReactNode; label: string }[] = [
  { key: 'bestaetigt', icon: <CheckCircle2 className="h-4 w-4" />, label: 'Bestätigt'  },
  { key: 'kueche',     icon: <ChefHat     className="h-4 w-4" />, label: 'Küche'       },
  { key: 'abholung',   icon: <Package     className="h-4 w-4" />, label: 'Abholung'    },
  { key: 'unterwegs',  icon: <Bike        className="h-4 w-4" />, label: 'Unterwegs'   },
  { key: 'geliefert',  icon: <MapPin      className="h-4 w-4" />, label: 'Geliefert'   },
];

const PHASE_IDX: Record<Phase, number> = {
  bestaetigt: 0, kueche: 1, abholung: 2, unterwegs: 3, geliefert: 4,
};

const ETA_COLOR = (min: number) => {
  if (min <= 5)  return 'text-red-600';
  if (min <= 12) return 'text-amber-600';
  return 'text-emerald-600';
};

const CONF_BAR = (pct: number) => {
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 60) return 'bg-amber-500';
  return 'bg-red-500';
};

export function Phase4500DynamischeEtaLiveHub({ orderId, locationId }: { orderId?: string | null; locationId?: string | null }) {
  const [data, setData]    = useState<EtaData | null>(null);
  const [loading, setLoad] = useState(true);

  async function fetchData() {
    try {
      const params = new URLSearchParams();
      if (orderId)    params.set('orderId',    orderId);
      if (locationId) params.set('locationId', locationId);
      const r = await fetch(`/api/delivery/eta?${params}`, { cache: 'no-store' });
      if (!r.ok) throw new Error();
      setData(await r.json());
    } catch {
      setData(MOCK);
    } finally {
      setLoad(false);
    }
  }

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 20_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, locationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border bg-white py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const d = data ?? MOCK;
  const currentIdx = PHASE_IDX[d.phase];

  return (
    <div className="rounded-2xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-700 text-white">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-indigo-300" />
          <span className="font-bold text-sm">Live Tracking {d.order_id}</span>
        </div>
        {d.phase !== 'geliefert' && (
          <div className={`text-2xl font-black ${ETA_COLOR(d.eta_min)}`}>
            {d.eta_min} min
          </div>
        )}
      </div>

      {d.alert && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-medium">
          <AlertCircle className="h-4 w-4 shrink-0" />{d.alert}
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* ETA Hero */}
        {d.phase !== 'geliefert' ? (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-center">
            <div className={`text-4xl font-black tabular-nums ${ETA_COLOR(d.eta_min)}`}>
              {d.eta_min} min
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Erwartete Lieferzeit (ca. {d.eta_range[0]}–{d.eta_range[1]} min)
            </div>
            {/* Konfidenz */}
            <div className="mt-2">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <span>ETA-Genauigkeit</span>
                <span className="font-bold">{d.konfidenz}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div className={`h-1.5 rounded-full ${CONF_BAR(d.konfidenz)}`} style={{ width: `${d.konfidenz}%` }} />
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
            <div className="font-bold text-emerald-700 text-lg">Geliefert!</div>
            <div className="text-sm text-muted-foreground">Guten Appetit 🍽️</div>
          </div>
        )}

        {/* Phasen-Timeline */}
        <div className="flex items-center">
          {PHASES.map((ph, i) => {
            const done    = i <= currentIdx;
            const current = i === currentIdx;
            return (
              <div key={ph.key} className="flex-1 flex flex-col items-center">
                <div className="relative flex items-center w-full">
                  {i > 0 && (
                    <div className={`absolute left-0 right-1/2 h-0.5 ${i <= currentIdx ? 'bg-indigo-500' : 'bg-muted'}`} />
                  )}
                  {i < PHASES.length - 1 && (
                    <div className={`absolute left-1/2 right-0 h-0.5 ${i < currentIdx ? 'bg-indigo-500' : 'bg-muted'}`} />
                  )}
                  <div className={`relative z-10 mx-auto rounded-full h-8 w-8 flex items-center justify-center border-2 transition-all
                    ${done && !current ? 'bg-indigo-500 border-indigo-500 text-white' :
                      current ? 'bg-indigo-700 border-indigo-700 text-white scale-110 shadow-lg' :
                      'bg-white border-muted text-muted-foreground'}`}
                  >
                    {ph.icon}
                  </div>
                </div>
                <div className={`text-[9px] mt-1.5 font-semibold text-center ${current ? 'text-indigo-700' : done ? 'text-indigo-500' : 'text-muted-foreground'}`}>
                  {ph.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Fahrer-Info */}
        {d.fahrer_name && d.phase === 'unterwegs' && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 flex items-center gap-3 px-3 py-2.5">
            <div className="rounded-full bg-blue-600 h-8 w-8 flex items-center justify-center shrink-0">
              <Bike className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{d.fahrer_name}</div>
              <div className="text-[10px] text-muted-foreground">
                {d.fahrer_km != null ? `Noch ca. ${d.fahrer_km} km entfernt` : 'Ist unterwegs zu dir'}
              </div>
            </div>
            <div className={`text-lg font-black ${ETA_COLOR(d.eta_min)}`}>
              {d.eta_min} min
            </div>
          </div>
        )}

        {/* Küche-Info */}
        {d.kueche_fertig_in != null && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 flex items-center gap-3 px-3 py-2.5">
            <ChefHat className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="flex-1 text-sm text-amber-800">
              Deine Bestellung ist in ca. <span className="font-bold">{d.kueche_fertig_in} min</span> fertig
            </div>
          </div>
        )}

        <div className="text-[10px] text-muted-foreground text-center">Live-Update alle 20 Sekunden</div>
      </div>
    </div>
  );
}
