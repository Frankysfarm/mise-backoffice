'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn, euro } from '@/lib/utils';
import { MapPin, Clock, CheckCircle2, Navigation, Phone, MessageSquare, ChevronRight } from 'lucide-react';

interface TourStop {
  id: string;
  status: string;
  adresse?: string | null;
  kundenname?: string | null;
  telefon?: string | null;
  trinkgeld?: number | null;
  position?: number | null;
  bestellwert?: number | null;
  anmerkung?: string | null;
  arrived_at?: string | null;
  delivered_at?: string | null;
  eta?: string | null;
}

interface Props {
  batchId?: string | null;
}

const MOCK_STOPS: TourStop[] = [
  { id: 's1', status: 'geliefert', adresse: 'Hauptstr. 12, Berlin', kundenname: 'Anna M.', telefon: '+4915112345678', trinkgeld: 3.0, position: 1, bestellwert: 24.5, arrived_at: new Date(Date.now() - 25 * 60_000).toISOString(), delivered_at: new Date(Date.now() - 22 * 60_000).toISOString() },
  { id: 's2', status: 'unterwegs', adresse: 'Berliner Allee 55, Berlin', kundenname: 'Klaus B.', telefon: '+4915287654321', trinkgeld: null, position: 2, bestellwert: 37.8, eta: new Date(Date.now() + 4 * 60_000).toISOString() },
  { id: 's3', status: 'offen', adresse: 'Gartenweg 3, Berlin', kundenname: 'Lena S.', position: 3, bestellwert: 18.9 },
];

function durationMin(from?: string | null, to?: string | null): number | null {
  if (!from || !to) return null;
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000);
}

function fmtEta(eta?: string | null): string | null {
  if (!eta) return null;
  const diff = Math.round((new Date(eta).getTime() - Date.now()) / 60_000);
  if (diff <= 0) return 'Jetzt';
  return `~${diff} Min`;
}

export function FahrerTourStoppAnalyseCard({ batchId }: Props) {
  const [stops, setStops] = useState<TourStop[]>(MOCK_STOPS);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!batchId) return;
    const sb = createClient();
    sb.from('delivery_stops')
      .select('id,status,adresse,kundenname,telefon,trinkgeld,position,bestellwert,anmerkung,arrived_at,delivered_at,eta')
      .eq('batch_id', batchId)
      .order('position')
      .then(({ data }) => { if (data?.length) setStops(data as TourStop[]); });
  }, [batchId]);

  const delivered = stops.filter(s => s.status === 'geliefert').length;
  const total = stops.length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 bg-matcha-50 border-b border-matcha-100">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-matcha-600" />
          <span className="text-sm font-bold text-matcha-800">Tour-Stopps</span>
        </div>
        <span className="text-xs font-semibold text-matcha-700 bg-matcha-100 px-2 py-0.5 rounded-full">
          {delivered}/{total} geliefert
        </span>
      </div>

      <div className="divide-y divide-stone-100">
        {stops.map((stop, idx) => {
          const isDone = stop.status === 'geliefert';
          const isCurrent = stop.status === 'unterwegs';
          const isOpen = stop.status === 'offen';
          const dur = durationMin(stop.arrived_at, stop.delivered_at);
          const eta = fmtEta(stop.eta);
          const isExpanded = expanded === stop.id;

          return (
            <div key={stop.id}>
              <button
                className={cn(
                  'w-full text-left px-4 py-3 flex items-start gap-3 transition-colors',
                  isDone ? 'bg-white' : isCurrent ? 'bg-blue-50' : 'bg-stone-50',
                  isExpanded && 'bg-stone-100',
                )}
                onClick={() => setExpanded(isExpanded ? null : stop.id)}
              >
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold',
                  isDone ? 'bg-matcha-500 text-white' : isCurrent ? 'bg-blue-500 text-white' : 'bg-stone-300 text-stone-600',
                )}>
                  {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn(
                      'text-xs font-semibold truncate',
                      isDone ? 'text-stone-500 line-through' : isCurrent ? 'text-blue-700' : 'text-stone-700',
                    )}>
                      {stop.kundenname ?? `Stopp ${idx + 1}`}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {stop.trinkgeld != null && stop.trinkgeld > 0 && (
                        <span className="text-[10px] font-bold text-matcha-600 bg-matcha-50 px-1.5 py-0.5 rounded">+{euro(stop.trinkgeld)}</span>
                      )}
                      {isCurrent && eta && (
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{eta}</span>
                      )}
                      <ChevronRight className={cn('w-3 h-3 text-stone-400 transition-transform', isExpanded && 'rotate-90')} />
                    </div>
                  </div>
                  <p className="text-[11px] text-stone-400 truncate mt-0.5">{stop.adresse}</p>
                  {isDone && dur !== null && (
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3 text-stone-400" />
                      <span className="text-[10px] text-stone-500">{dur} Min Lieferzeit</span>
                    </div>
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 bg-stone-50 space-y-2">
                  {stop.bestellwert != null && (
                    <div className="text-xs text-stone-600">Bestellwert: <strong>{euro(stop.bestellwert)}</strong></div>
                  )}
                  {stop.anmerkung && (
                    <div className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">📝 {stop.anmerkung}</div>
                  )}
                  <div className="flex gap-2">
                    {stop.telefon && (
                      <a
                        href={`tel:${stop.telefon}`}
                        className="flex items-center gap-1 rounded-lg bg-matcha-600 text-white text-xs px-3 py-1.5 font-medium"
                      >
                        <Phone className="w-3 h-3" /> Anrufen
                      </a>
                    )}
                    {stop.adresse && (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(stop.adresse)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 rounded-lg bg-blue-600 text-white text-xs px-3 py-1.5 font-medium"
                      >
                        <Navigation className="w-3 h-3" /> Navigieren
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
