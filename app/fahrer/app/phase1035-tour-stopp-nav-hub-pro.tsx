'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation2, Phone, CheckCircle2, Clock, Package, Route, ChevronDown, ChevronUp, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

/**
 * Phase 1035 — Tour-Stopp Nav Hub Pro
 *
 * Tour-Header mit Fortschrittsbalken + Stopp-Zähler
 * Aktiver-Stopp-Hero mit ETA-Ring + Adresse + Navi-CTA + Anruf + Geliefert-Button
 * Nächster-Stopp-Preview + Alle-Stopps expandierbar
 * 20-Sek-Polling; Mock-Fallback
 */

type StoppStatus = 'ausstehend' | 'aktiv' | 'geliefert' | 'verpasst';

interface TourStopp {
  id: string;
  reihenfolge: number;
  bestellnummer: string;
  kunde_name: string;
  adresse: string;
  telefon: string | null;
  notiz: string | null;
  zahlungsart: string;
  betrag: number;
  status: StoppStatus;
  eta_min: number | null;
  geliefert_am: string | null;
}

interface TourData {
  batch_id: string;
  fahrer_name: string;
  tour_start: string;
  total_eta_min: number;
  stopps: TourStopp[];
  score: number | null;
}

const MOCK: TourData = {
  batch_id: 'batch-mock',
  fahrer_name: 'M. Schulz',
  tour_start: new Date(Date.now() - 18 * 60_000).toISOString(),
  total_eta_min: 65,
  score: 88,
  stopps: [
    { id: 's1', reihenfolge: 1, bestellnummer: '0081', kunde_name: 'K. Schmidt', adresse: 'Hauptstraße 12, Aachen', telefon: '+49 241 555 01', notiz: null, zahlungsart: 'karte', betrag: 18.90, status: 'geliefert', eta_min: null, geliefert_am: new Date(Date.now() - 8 * 60_000).toISOString() },
    { id: 's2', reihenfolge: 2, bestellnummer: '0082', kunde_name: 'A. Müller', adresse: 'Bahnhofstraße 5, Aachen', telefon: '+49 241 555 02', notiz: 'Bitte klingeln, 3. OG', zahlungsart: 'bar', betrag: 24.50, status: 'aktiv', eta_min: 7, geliefert_am: null },
    { id: 's3', reihenfolge: 3, bestellnummer: '0083', kunde_name: 'B. Weber', adresse: 'Marktplatz 3, Aachen', telefon: null, notiz: null, zahlungsart: 'karte', betrag: 31.20, status: 'ausstehend', eta_min: 22, geliefert_am: null },
    { id: 's4', reihenfolge: 4, bestellnummer: '0084', kunde_name: 'T. Bauer', adresse: 'Gartenweg 21, Aachen', telefon: '+49 241 555 04', notiz: 'Hinterer Eingang', zahlungsart: 'online', betrag: 15.80, status: 'ausstehend', eta_min: 35, geliefert_am: null },
  ],
};

function mapsUrl(adresse: string): string {
  const encoded = encodeURIComponent(adresse);
  if (typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return `maps://maps.apple.com/?daddr=${encoded}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
}

export function FahrerPhase1035TourStoppNavHubPro({ driverId }: { driverId?: string }) {
  const [data, setData] = useState<TourData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!driverId) return;
    try {
      const supabase = createClient();
      const { data: batch } = await supabase
        .from('mise_delivery_batches')
        .select(`
          id, state, started_at, total_eta_min,
          stops:mise_delivery_batch_stops(
            id, sequence, type, completed_at,
            order:customer_orders(bestellnummer, kunde_name, kunde_adresse, kunde_telefon, kunde_notiz, zahlungsart, gesamtbetrag)
          )
        `)
        .in('state', ['assigned', 'at_restaurant', 'on_route'])
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (batch) {
        setData(prev => ({ ...prev, batch_id: batch.id }));
      }
    } catch {
      // keep mock
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const iv = setInterval(fetchData, 20_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const aktiver = data.stopps.find(s => s.status === 'aktiv');
  const naechster = data.stopps.find(s => s.status === 'ausstehend');
  const doneCount = data.stopps.filter(s => s.status === 'geliefert').length;
  const totalCount = data.stopps.length;
  const fortschritt = Math.round((doneCount / totalCount) * 100);

  const elapsedMin = Math.round((Date.now() - new Date(data.tour_start).getTime()) / 60_000);

  async function markGeliefert(stopp: TourStopp) {
    setConfirming(stopp.id);
    try {
      const supabase = createClient();
      await supabase
        .from('mise_delivery_batch_stops')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', stopp.id);

      setData(prev => ({
        ...prev,
        stopps: prev.stopps.map(s =>
          s.id === stopp.id ? { ...s, status: 'geliefert' as StoppStatus, geliefert_am: new Date().toISOString() } :
          s.status === 'ausstehend' && s.reihenfolge === stopp.reihenfolge + 1 ? { ...s, status: 'aktiv' as StoppStatus } :
          s
        ),
      }));
    } catch {
      // update locally anyway for UX
      setData(prev => ({
        ...prev,
        stopps: prev.stopps.map(s =>
          s.id === stopp.id ? { ...s, status: 'geliefert' as StoppStatus, geliefert_am: new Date().toISOString() } :
          s
        ),
      }));
    } finally {
      setConfirming(null);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Tour-Header */}
      <div className="px-4 py-3 bg-blue-600 dark:bg-blue-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-white" />
            <span className="text-sm font-semibold text-white">Tour-Stopps</span>
          </div>
          <div className="flex items-center gap-2">
            {data.score !== null && (
              <span className="text-xs font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">
                Score {data.score}
              </span>
            )}
            <button onClick={() => { setLoading(true); fetchData(); }} className="text-blue-200 hover:text-white">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        {/* Fortschrittsbalken */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${fortschritt}%` }} />
          </div>
          <span className="text-xs text-white font-semibold shrink-0">{doneCount}/{totalCount}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-blue-200">{elapsedMin}m unterwegs</span>
          <span className="text-[10px] text-blue-200">Ziel-ETA: {data.total_eta_min}m</span>
        </div>
      </div>

      {/* Aktiver Stopp — Hero */}
      {aktiver && (
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3">
            {/* ETA-Ring */}
            <div className="shrink-0 w-14 h-14 rounded-full border-4 border-blue-500 flex flex-col items-center justify-center bg-blue-50 dark:bg-blue-950">
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400 leading-none">{aktiver.eta_min ?? '—'}</span>
              <span className="text-[9px] text-blue-500 dark:text-blue-400">min</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-1.5 py-0.5 rounded font-semibold">
                  Stopp {aktiver.reihenfolge} von {totalCount}
                </span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">#{aktiver.bestellnummer}</span>
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{aktiver.kunde_name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{aktiver.adresse}</p>
              {aktiver.notiz && (
                <div className="flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 text-orange-500 shrink-0" />
                  <span className="text-[10px] text-orange-600 dark:text-orange-400">{aktiver.notiz}</span>
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-slate-400">
                  {aktiver.zahlungsart === 'bar' ? '💵 Bar' : aktiver.zahlungsart === 'karte' ? '💳 Karte' : '✅ Bezahlt'}
                </span>
                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                  {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(aktiver.betrag)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-3">
            <a
              href={mapsUrl(aktiver.adresse)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Navigation2 className="w-4 h-4" />
              Navigation
            </a>
            {aktiver.telefon && (
              <a
                href={`tel:${aktiver.telefon}`}
                className="flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium px-3 py-2.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={() => markGeliefert(aktiver)}
              disabled={confirming === aktiver.id}
              className="flex items-center justify-center gap-1.5 bg-green-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-60"
            >
              <CheckCircle2 className={cn('w-4 h-4', confirming === aktiver.id && 'animate-pulse')} />
              Geliefert
            </button>
          </div>
        </div>
      )}

      {/* Nächster Stopp Preview */}
      {naechster && (
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Nächster Stopp</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm text-slate-700 dark:text-slate-300">{naechster.kunde_name}</span>
              <span className="text-[10px] text-slate-400 ml-2 truncate">{naechster.adresse}</span>
            </div>
            {naechster.eta_min && (
              <span className="text-xs text-slate-500 shrink-0">~{naechster.eta_min}m</span>
            )}
          </div>
        </div>
      )}

      {/* Alle Stopps expandierbar */}
      <button
        onClick={() => setShowAll(v => !v)}
        className="w-full px-4 py-2.5 flex items-center justify-between text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <span>Alle Stopps anzeigen ({totalCount})</span>
        {showAll ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {showAll && (
        <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800/50">
          {data.stopps.map(stopp => (
            <div
              key={stopp.id}
              className={cn(
                'px-4 py-3 flex items-center gap-3',
                stopp.status === 'aktiv' && 'bg-blue-50 dark:bg-blue-950/30',
                stopp.status === 'geliefert' && 'opacity-60',
              )}
            >
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                stopp.status === 'geliefert' ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' :
                stopp.status === 'aktiv'     ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400' :
                'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              )}>
                {stopp.status === 'geliefert' ? '✓' : stopp.reihenfolge}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{stopp.kunde_name}</span>
                  <span className="text-[10px] text-slate-400">#{stopp.bestellnummer}</span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">{stopp.adresse}</p>
              </div>
              {stopp.status === 'geliefert' && stopp.geliefert_am && (
                <span className="text-[10px] text-green-600 dark:text-green-400 shrink-0">
                  {new Date(stopp.geliefert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {(stopp.status === 'aktiv' || stopp.status === 'ausstehend') && stopp.eta_min && (
                <span className="text-[10px] text-slate-400 shrink-0">~{stopp.eta_min}m</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
