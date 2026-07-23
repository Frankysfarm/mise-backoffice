'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MapPin, CheckCircle2, Clock, Navigation, Phone, ChevronRight, AlertCircle } from 'lucide-react';

type StopRow = {
  id: string;
  reihenfolge: number | null;
  geliefert_am: string | null;
  angekommen_am: string | null;
  eta_min: number | null;
  order_id: string | null;
  order: {
    bestellnummer: string | null;
    kunde_name: string | null;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    kunde_telefon: string | null;
    gesamtbetrag: number | null;
    zahlungsart: string | null;
  } | null;
};

function buildMapsUrl(address: string, plz: string | null): string {
  const q = encodeURIComponent(`${address}${plz ? `, ${plz}` : ''}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
}

export function FahrerPhase3327TourStopsNaviFinalHub({
  batchId,
  driverId,
}: {
  batchId: string | null;
  driverId: string | null;
}) {
  const supabase = createClient();
  const [stops, setStops] = useState<StopRow[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    if (!batchId) return;

    const load = async () => {
      const { data } = await supabase
        .from('delivery_stops')
        .select(`
          id, reihenfolge, geliefert_am, angekommen_am, eta_min, order_id,
          order:customer_orders(bestellnummer, kunde_name, kunde_adresse, kunde_plz, kunde_telefon, gesamtbetrag, zahlungsart)
        `)
        .eq('batch_id', batchId)
        .order('reihenfolge', { ascending: true });

      if (data) setStops(data as unknown as StopRow[]);
    };

    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [batchId]);

  const handleConfirmDelivery = async (stopId: string) => {
    setConfirming(stopId);
    await supabase
      .from('delivery_stops')
      .update({ geliefert_am: new Date().toISOString() })
      .eq('id', stopId);

    setStops(prev =>
      prev.map(s => s.id === stopId ? { ...s, geliefert_am: new Date().toISOString() } : s)
    );
    setConfirming(null);
  };

  if (stops.length === 0) return null;

  const delivered = stops.filter(s => s.geliefert_am).length;
  const pending = stops.filter(s => !s.geliefert_am);
  const next = pending[0] ?? null;

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-stone-50 to-white">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-matcha-600" />
          <span className="text-[11px] font-black uppercase tracking-widest text-stone-500">Tour-Stopps Navigator</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-bold">
            {delivered}/{stops.length} geliefert
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-stone-100">
        <div
          className="h-full bg-matcha-600 transition-all duration-500"
          style={{ width: `${stops.length > 0 ? (delivered / stops.length) * 100 : 0}%` }}
        />
      </div>

      {/* Next stop highlight */}
      {next && (
        <div className="p-3 bg-matcha-50 border-b border-matcha-200">
          <div className="text-[9px] font-black uppercase tracking-wider text-matcha-600 mb-1.5">Nächster Stopp</div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-matcha-600 text-white flex items-center justify-center text-[11px] font-black flex-shrink-0">
              {(next.reihenfolge ?? 0) + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-black text-stone-800 truncate">{next.order?.kunde_name ?? 'Kunde'}</div>
              <div className="text-[10px] text-stone-500 truncate mt-0.5">
                {next.order?.kunde_adresse ?? '—'}{next.order?.kunde_plz ? `, ${next.order.kunde_plz}` : ''}
              </div>
              <div className="flex items-center gap-3 mt-2">
                {next.order?.kunde_adresse && (
                  <a
                    href={buildMapsUrl(next.order.kunde_adresse, next.order?.kunde_plz ?? null)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 bg-matcha-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg"
                  >
                    <Navigation className="h-3 w-3" />
                    Navigation
                  </a>
                )}
                {next.order?.kunde_telefon && (
                  <a
                    href={`tel:${next.order.kunde_telefon}`}
                    className="flex items-center gap-1 bg-stone-100 text-stone-700 text-[10px] font-bold px-2.5 py-1.5 rounded-lg"
                  >
                    <Phone className="h-3 w-3" />
                    Anrufen
                  </a>
                )}
                {next.eta_min && (
                  <div className="flex items-center gap-1 text-[9px] text-stone-400">
                    <Clock className="h-3 w-3" />
                    <span>~{next.eta_min} min</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Payment info */}
          {next.order?.zahlungsart === 'bar' && (
            <div className="mt-2 flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
              <AlertCircle className="h-3 w-3 text-amber-600 flex-shrink-0" />
              <span className="text-[10px] font-bold text-amber-700">
                Barzahlung: {next.order.gesamtbetrag ? `€${Number(next.order.gesamtbetrag).toFixed(2)}` : 'Betrag prüfen'}
              </span>
            </div>
          )}

          {/* Confirm button */}
          <button
            onClick={() => handleConfirmDelivery(next.id)}
            disabled={confirming === next.id}
            className="mt-2 w-full flex items-center justify-center gap-2 bg-emerald-600 text-white text-[11px] font-black py-2.5 rounded-xl disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {confirming === next.id ? 'Bestätigen…' : 'Zugestellt bestätigen'}
          </button>
        </div>
      )}

      {/* All stops list */}
      <div className="divide-y divide-stone-100">
        {stops.map((stop, i) => {
          const isDone = !!stop.geliefert_am;
          const isNext = !isDone && stop.id === next?.id;
          return (
            <div
              key={stop.id}
              className={`flex items-center gap-3 px-4 py-2.5 ${isDone ? 'opacity-50' : ''} ${isNext ? 'bg-matcha-50/50' : ''}`}
            >
              {/* Status dot */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0 ${
                isDone ? 'bg-emerald-500 text-white' :
                isNext ? 'bg-matcha-600 text-white' :
                'bg-stone-100 text-stone-500 border border-stone-200'
              }`}>
                {isDone ? <CheckCircle2 className="h-3 w-3" /> : (stop.reihenfolge ?? i) + 1}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-stone-700 truncate">
                  {stop.order?.kunde_name ?? 'Kunde'}
                </div>
                <div className="text-[9px] text-stone-400 truncate">
                  {stop.order?.kunde_adresse ?? '—'}
                </div>
              </div>

              <div className="flex-shrink-0 text-right">
                {isDone ? (
                  <span className="text-[8px] text-emerald-600 font-bold">Geliefert</span>
                ) : stop.order?.zahlungsart === 'bar' ? (
                  <span className="text-[8px] text-amber-600 font-bold">Bar</span>
                ) : (
                  <ChevronRight className="h-3 w-3 text-stone-300" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Completed message */}
      {delivered === stops.length && stops.length > 0 && (
        <div className="p-4 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
          <div className="text-[12px] font-black text-emerald-700">Alle Stopps abgeschlossen!</div>
          <div className="text-[10px] text-stone-400 mt-0.5">Tour erfolgreich abgeliefert</div>
        </div>
      )}
    </div>
  );
}
