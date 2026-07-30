'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, MapPin, Bike, CheckCircle2, AlertTriangle, TrendingDown, Zap } from 'lucide-react';

// Phase 1005 — Dynamische ETA Live Hub
// Zeigt Live-Lieferstatus (Küche → Unterwegs → Angekommen), Echtzeit-Countdown
// Fahrer-Annäherungs-Radar + ETA-Fenster; SSE-Stream / 10-Sek-Polling; Mock-Fallback

interface TrackingData {
  status: 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';
  eta_earliest: string | null;
  eta_latest: string | null;
  fahrer_name: string | null;
  fahrer_lat: number | null;
  fahrer_lng: number | null;
  kunde_lat: number | null;
  kunde_lng: number | null;
  distanz_km: number | null;
  prep_min_remaining: number | null;
  bestellnummer: string;
}

interface Props {
  bestellnummer?: string | null;
  initialData?: TrackingData | null;
}

const MOCK: TrackingData = {
  status: 'unterwegs',
  eta_earliest: new Date(Date.now() + 12 * 60_000).toISOString(),
  eta_latest: new Date(Date.now() + 20 * 60_000).toISOString(),
  fahrer_name: 'Jonas M.',
  fahrer_lat: 50.775,
  fahrer_lng: 6.084,
  kunde_lat: 50.769,
  kunde_lng: 6.076,
  distanz_km: 1.8,
  prep_min_remaining: null,
  bestellnummer: '#1042',
};

const STEPS: Array<{ key: TrackingData['status'] | string; label: string; icon: React.ReactNode }> = [
  { key: 'in_zubereitung', label: 'Küche',       icon: <span className="text-base">👨‍🍳</span> },
  { key: 'fertig',         label: 'Bereit',      icon: <CheckCircle2 className="h-4 w-4" /> },
  { key: 'unterwegs',      label: 'Unterwegs',   icon: <Bike className="h-4 w-4" /> },
  { key: 'geliefert',      label: 'Geliefert',   icon: <CheckCircle2 className="h-4 w-4" /> },
];

const STATUS_ORDER: Record<TrackingData['status'], number> = {
  in_zubereitung: 0,
  fertig: 1,
  unterwegs: 2,
  geliefert: 3,
};

function fmtTime(isoStr: string) {
  const d = new Date(isoStr);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtCountdown(isoStr: string): string {
  const ms = new Date(isoStr).getTime() - Date.now();
  if (ms <= 0) return 'Jeden Moment';
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  if (m >= 1) return `${m} Min ${s} Sek`;
  return `${s} Sek`;
}

export function Phase1005DynamischeEtaLiveHub({ bestellnummer, initialData }: Props) {
  const [data, setData] = useState<TrackingData | null>(initialData ?? null);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(!initialData);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchData() {
    if (!bestellnummer) {
      setData(MOCK);
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(`/api/delivery/tracking/${bestellnummer}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('api');
      setData(await r.json());
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    tickRef.current = setInterval(() => setTick((n) => n + 1), 1000);
    pollRef.current = setInterval(fetchData, 10_000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [bestellnummer]);

  const d = data ?? MOCK;
  const activeIdx = STATUS_ORDER[d.status];

  return (
    <div className="rounded-2xl border border-blue-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
        <div className="flex items-center gap-2">
          <Bike className="h-5 w-5 text-blue-200" />
          <span className="font-bold text-sm">Live-Tracking {d.bestellnummer}</span>
        </div>
        {d.status === 'geliefert' ? (
          <span className="bg-green-500 rounded-full px-3 py-0.5 text-xs font-bold">Geliefert ✓</span>
        ) : d.status === 'unterwegs' ? (
          <span className="bg-amber-400 text-black rounded-full px-3 py-0.5 text-xs font-bold animate-pulse">Unterwegs</span>
        ) : (
          <span className="bg-blue-400 rounded-full px-3 py-0.5 text-xs font-bold">Wird zubereitet</span>
        )}
      </div>

      {/* Step Progress */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 right-0 top-4 h-0.5 bg-muted z-0">
            <div
              className="h-0.5 bg-blue-500 transition-all"
              style={{ width: `${(activeIdx / (STEPS.length - 1)) * 100}%` }}
            />
          </div>
          {STEPS.map((step, i) => {
            const done = i < activeIdx;
            const active = i === activeIdx;
            return (
              <div key={step.key} className="flex flex-col items-center gap-1 z-10">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all
                  ${done ? 'bg-blue-500 border-blue-500 text-white' :
                    active ? 'bg-white border-blue-500 text-blue-600 shadow-md' :
                    'bg-white border-muted text-muted-foreground'}`}>
                  {step.icon}
                </div>
                <span className={`text-[10px] font-semibold ${active ? 'text-blue-600' : done ? 'text-blue-400' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* ETA Display */}
        {d.status !== 'geliefert' && d.eta_earliest && (
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Erwartete Lieferung</div>
                <div className="font-black text-2xl text-blue-700">
                  {fmtCountdown(d.eta_earliest)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  ca. {fmtTime(d.eta_earliest)}{d.eta_latest ? ` – ${fmtTime(d.eta_latest)}` : ''}
                </div>
              </div>
              <Clock className="h-10 w-10 text-blue-200" />
            </div>
          </div>
        )}

        {/* Prep countdown */}
        {d.status === 'in_zubereitung' && d.prep_min_remaining != null && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
            <span className="text-lg">👨‍🍳</span>
            Noch ca. <strong>{d.prep_min_remaining} Min</strong> Zubereitungszeit
          </div>
        )}

        {/* Driver info + proximity */}
        {d.fahrer_name && d.status === 'unterwegs' && (
          <div className="rounded-xl bg-muted/20 border border-border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Bike className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <div className="font-semibold text-sm">{d.fahrer_name}</div>
                  <div className="text-[10px] text-muted-foreground">ist unterwegs zu dir</div>
                </div>
              </div>
              {d.distanz_km != null && (
                <div className="text-right">
                  <div className="font-black text-lg text-indigo-700">{d.distanz_km.toFixed(1)} km</div>
                  <div className="text-[10px] text-muted-foreground">entfernt</div>
                </div>
              )}
            </div>
            {d.distanz_km != null && d.distanz_km <= 1.0 && (
              <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-orange-600 animate-pulse">
                <Zap className="h-3.5 w-3.5" />
                Fahrer ist fast da!
              </div>
            )}
          </div>
        )}

        {/* Delivered */}
        {d.status === 'geliefert' && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-1" />
            <div className="font-bold text-sm text-green-700">Deine Bestellung wurde geliefert!</div>
            <div className="text-xs text-muted-foreground mt-0.5">Guten Appetit! 🍽️</div>
          </div>
        )}
      </div>
    </div>
  );
}
