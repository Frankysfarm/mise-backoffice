'use client';

import { useState } from 'react';
import { MapPin, Navigation, Phone, CheckCircle2, Clock, Package, ChevronDown, ChevronUp, Banknote, CreditCard } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

interface Stopp {
  id: string;
  reihenfolge: number;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_telefon?: string | null;
    kunde_lat: number | null;
    kunde_lng: number | null;
    gesamtbetrag: number;
    zahlungsart?: string | null;
    bezahlt?: boolean | null;
    eta_earliest?: string | null;
    kunde_notiz?: string | null;
  };
  geliefert_am: string | null;
  angekommen_am: string | null;
}

interface Props {
  stops: Stopp[];
  driverLat: number | null;
  driverLng: number | null;
}

function naviUrl(lat: number | null, lng: number | null, adresse: string | null): string {
  if (lat && lng) return `https://maps.google.com/?q=${lat},${lng}`;
  if (adresse) return `https://maps.google.com/?q=${encodeURIComponent(adresse)}`;
  return '#';
}

function etaLabel(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function FahrerPhase3568TourStoppNavigationCockpit({ stops, driverLat, driverLng }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const offen = stops.filter(s => !s.geliefert_am);
  const geliefert = stops.filter(s => !!s.geliefert_am);
  const naechster = offen[0] ?? null;

  const fortschritt = stops.length > 0 ? Math.round((geliefert.length / stops.length) * 100) : 0;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-800">Tour-Stopp Navigation</span>
        </div>
        <span className="text-xs text-blue-600 font-medium">{geliefert.length}/{stops.length} erledigt</span>
      </div>

      {/* Fortschrittsbalken */}
      <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${fortschritt}%` }} />
      </div>

      {/* Nächster Stopp — Hero */}
      {naechster && (
        <div className="rounded-lg bg-white border-2 border-blue-400 p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-blue-600">Nächster Stopp #{naechster.reihenfolge}</p>
              <p className="text-sm font-bold text-gray-900">{naechster.order.kunde_name}</p>
              {naechster.order.kunde_adresse && (
                <p className="text-xs text-gray-600">{naechster.order.kunde_adresse}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              {naechster.order.eta_earliest && (
                <p className="text-xs text-gray-500">ETA <strong>{etaLabel(naechster.order.eta_earliest)}</strong></p>
              )}
              <p className="text-xs font-semibold text-gray-700 mt-0.5">{euro(naechster.order.gesamtbetrag)}</p>
            </div>
          </div>

          {/* Zahlung */}
          <div className="flex items-center gap-1.5 text-xs">
            {naechster.order.zahlungsart === 'bar' ? (
              <><Banknote className="h-3.5 w-3.5 text-amber-500" /><span className="text-amber-700 font-medium">Bar</span></>
            ) : (
              <><CreditCard className="h-3.5 w-3.5 text-green-500" /><span className="text-green-700 font-medium">Kartenzahlung / Prepaid</span></>
            )}
            {naechster.order.bezahlt && <span className="ml-auto text-green-600 font-semibold">✓ Bezahlt</span>}
          </div>

          {/* Notiz */}
          {naechster.order.kunde_notiz && (
            <p className="text-xs bg-yellow-50 border border-yellow-200 rounded px-2 py-1 text-yellow-800">
              ℹ️ {naechster.order.kunde_notiz}
            </p>
          )}

          {/* Aktions-Buttons */}
          <div className="flex gap-2 pt-1">
            <a
              href={naviUrl(naechster.order.kunde_lat, naechster.order.kunde_lng, naechster.order.kunde_adresse)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold py-2"
            >
              <Navigation className="h-3.5 w-3.5" />
              Navigation starten
            </a>
            {naechster.order.kunde_telefon && (
              <a
                href={`tel:${naechster.order.kunde_telefon}`}
                className="flex items-center justify-center gap-1 rounded-lg bg-green-600 text-white text-xs font-semibold px-3 py-2"
              >
                <Phone className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Alle Stopps */}
      {stops.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-500">Alle Stopps ({stops.length})</p>
          {stops.map(s => {
            const done = !!s.geliefert_am;
            const isCurrent = !done && s === naechster;
            const isExpanded = expandedId === s.id;

            return (
              <div
                key={s.id}
                className={cn(
                  'rounded-lg border px-2.5 py-2 cursor-pointer',
                  done ? 'bg-green-50 border-green-200 opacity-70' : isCurrent ? 'bg-white border-blue-300' : 'bg-white border-gray-200'
                )}
                onClick={() => setExpandedId(isExpanded ? null : s.id)}
              >
                <div className="flex items-center gap-2">
                  <div className={cn('h-2 w-2 rounded-full shrink-0', done ? 'bg-green-500' : isCurrent ? 'bg-blue-500 animate-pulse' : 'bg-gray-300')} />
                  <span className="text-xs font-semibold w-5 text-gray-500">#{s.reihenfolge}</span>
                  <span className="text-xs font-medium flex-1 truncate">{s.order.kunde_name}</span>
                  {done && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                  {!done && s.order.eta_earliest && (
                    <span className="text-xs text-gray-400">{etaLabel(s.order.eta_earliest)}</span>
                  )}
                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                </div>

                {isExpanded && (
                  <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                    {s.order.kunde_adresse && (
                      <p className="text-xs text-gray-600 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-gray-400 shrink-0" />{s.order.kunde_adresse}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{euro(s.order.gesamtbetrag)}</span>
                      <span>{s.order.zahlungsart === 'bar' ? '💵 Bar' : '💳 Karte'}</span>
                      {s.order.bezahlt && <span className="text-green-600 font-medium">✓ bezahlt</span>}
                    </div>
                    {!done && (
                      <div className="flex gap-1.5 pt-1">
                        <a
                          href={naviUrl(s.order.kunde_lat, s.order.kunde_lng, s.order.kunde_adresse)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-600 font-medium"
                        >
                          <Navigation className="h-3 w-3" /> Navi
                        </a>
                        {s.order.kunde_telefon && (
                          <a href={`tel:${s.order.kunde_telefon}`} className="flex items-center gap-1 text-xs text-green-600 font-medium ml-2">
                            <Phone className="h-3 w-3" /> Anruf
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {offen.length === 0 && stops.length > 0 && (
        <div className="text-center py-2 text-sm text-green-700 font-semibold">
          🎉 Alle Stopps erledigt!
        </div>
      )}
    </div>
  );
}
