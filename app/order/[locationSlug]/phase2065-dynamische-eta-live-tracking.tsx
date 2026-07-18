'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Clock, MapPin, Bike, ChefHat, CheckCircle2, Package } from 'lucide-react';

type Phase = 'bestellung' | 'kueche' | 'abholung' | 'unterwegs' | 'geliefert';

interface EtaData {
  phase: Phase;
  etaMin: number | null;
  etaUpdatedAt: string | null;
  fahrerName: string | null;
  fahrerDistanzM: number | null;
  kuecheAuslastung: number | null; // 0-100
  bestellungId: string;
}

const PHASE_ORDER: Phase[] = ['bestellung', 'kueche', 'abholung', 'unterwegs', 'geliefert'];

const PHASE_LABELS: Record<Phase, string> = {
  bestellung: 'Bestätigt',
  kueche: 'In Zubereitung',
  abholung: 'Abholung',
  unterwegs: 'Unterwegs',
  geliefert: 'Geliefert',
};

const PHASE_ICONS: Record<Phase, React.ComponentType<{ className?: string }>> = {
  bestellung: CheckCircle2,
  kueche: ChefHat,
  abholung: Package,
  unterwegs: Bike,
  geliefert: MapPin,
};

function PhaseStep({ phase, active, done }: { phase: Phase; active: boolean; done: boolean }) {
  const Icon = PHASE_ICONS[phase];
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
        done ? 'bg-emerald-500 text-white' :
        active ? 'bg-matcha-600 text-white ring-2 ring-matcha-300 ring-offset-1' :
        'bg-stone-100 text-stone-400'
      }`}>
        <Icon className="w-4 h-4" />
      </div>
      <span className={`text-[9px] text-center leading-tight font-medium ${
        active ? 'text-matcha-700' : done ? 'text-emerald-600' : 'text-stone-400'
      }`}>
        {PHASE_LABELS[phase]}
      </span>
    </div>
  );
}

export function StorefrontPhase2065DynamischeEtaLiveTracking({ orderId }: { orderId?: string }) {
  const [eta, setEta] = useState<EtaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const supabase = createClient();

  const refresh = useCallback(async () => {
    if (!orderId) {
      // Show demo data
      setEta({
        phase: 'unterwegs',
        etaMin: 12,
        etaUpdatedAt: new Date().toISOString(),
        fahrerName: 'Ahmed K.',
        fahrerDistanzM: 800,
        kuecheAuslastung: 72,
        bestellungId: orderId ?? 'DEMO-001',
      });
      setLoading(false);
      setLastUpdate(new Date());
      return;
    }
    try {
      const { data } = await supabase
        .from('orders')
        .select('id,delivery_phase,eta_min,eta_updated_at,driver_name,driver_distance_m,kitchen_load')
        .eq('id', orderId)
        .single();
      if (data) {
        setEta({
          phase: (data.delivery_phase as Phase) ?? 'bestellung',
          etaMin: data.eta_min,
          etaUpdatedAt: data.eta_updated_at,
          fahrerName: data.driver_name,
          fahrerDistanzM: data.driver_distance_m,
          kuecheAuslastung: data.kitchen_load,
          bestellungId: data.id,
        });
      }
    } catch {
      // keep current
    }
    setLoading(false);
    setLastUpdate(new Date());
  }, [supabase, orderId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 animate-pulse">
        <div className="h-4 bg-stone-100 rounded w-1/3 mb-4" />
        <div className="h-2 bg-stone-100 rounded w-full" />
      </div>
    );
  }

  if (!eta) return null;

  const currentPhaseIdx = PHASE_ORDER.indexOf(eta.phase);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      {/* ETA Hero */}
      <div className={`p-4 ${eta.phase === 'geliefert' ? 'bg-emerald-600' : 'bg-matcha-600'} text-white`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs opacity-80 mb-0.5">
              {eta.phase === 'geliefert' ? 'Ihre Bestellung ist angekommen!' : 'Voraussichtliche Lieferzeit'}
            </p>
            {eta.etaMin != null && eta.phase !== 'geliefert' ? (
              <div className="flex items-end gap-1">
                <span className="text-4xl font-black tabular-nums">{eta.etaMin}</span>
                <span className="text-lg opacity-80 mb-1">Min</span>
              </div>
            ) : (
              <p className="text-2xl font-black">
                {eta.phase === 'geliefert' ? '✓ Geliefert' : 'Wird berechnet…'}
              </p>
            )}
          </div>
          {eta.fahrerName && eta.phase === 'unterwegs' && (
            <div className="text-right">
              <p className="text-xs opacity-80">Ihr Fahrer</p>
              <p className="font-bold">{eta.fahrerName}</p>
              {eta.fahrerDistanzM != null && (
                <p className="text-xs opacity-70">{(eta.fahrerDistanzM / 1000).toFixed(1)} km entfernt</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Phase Timeline */}
      <div className="px-4 py-5">
        <div className="relative flex items-start justify-between">
          {/* Connecting line */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-stone-200 -z-0">
            <div
              className="h-full bg-matcha-500 transition-all duration-700"
              style={{ width: `${Math.max(0, (currentPhaseIdx / (PHASE_ORDER.length - 1)) * 100)}%` }}
            />
          </div>
          {PHASE_ORDER.map((phase, idx) => (
            <PhaseStep
              key={phase}
              phase={phase}
              active={phase === eta.phase}
              done={idx < currentPhaseIdx}
            />
          ))}
        </div>
      </div>

      {/* Kitchen load indicator */}
      {eta.kuecheAuslastung != null && eta.phase === 'kueche' && (
        <div className="px-4 pb-3">
          <div className="bg-stone-50 rounded-lg p-2.5 flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-stone-500 shrink-0" />
            <div className="flex-1">
              <p className="text-[10px] text-stone-500 mb-0.5">Küchenauslastung</p>
              <div className="w-full h-1.5 rounded-full bg-stone-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    eta.kuecheAuslastung >= 85 ? 'bg-red-400' :
                    eta.kuecheAuslastung >= 65 ? 'bg-amber-400' : 'bg-matcha-500'
                  }`}
                  style={{ width: `${eta.kuecheAuslastung}%` }}
                />
              </div>
            </div>
            <span className={`text-xs font-bold ${
              eta.kuecheAuslastung >= 85 ? 'text-red-600' :
              eta.kuecheAuslastung >= 65 ? 'text-amber-600' : 'text-matcha-600'
            }`}>
              {eta.kuecheAuslastung}%
            </span>
          </div>
        </div>
      )}

      <div className="px-4 pb-3 flex items-center gap-1 text-[10px] text-stone-400">
        <Clock className="w-3 h-3" />
        Aktualisiert {lastUpdate.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        · 30s Live-Tracking
      </div>
    </div>
  );
}
