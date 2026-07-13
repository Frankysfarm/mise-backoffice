'use client';

// Phase 1264 — Schicht-Snapshot-Widget (Fahrer-App)
// Nutzt Phase1257-API (schicht-snapshot): Gesamtumsatz, Ø-Lieferzeit, Top-Zone,
// aktive Fahrer — komprimierte Übersicht auf dem Fahrer-Dashboard.
// Props: locationId, isOnline · 15-Min-Polling

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, BarChart2, Loader2, Clock, Euro, MapPin, Users, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Snapshot {
  gesamt_bestellungen: number;
  gesamt_umsatz_eur: number;
  schnitt_lieferzeit_min: number | null;
  fahrer_schnitt_stimmung: number | null;
  top_zone: string | null;
  top_fahrer: string | null;
  aktive_fahrer: number;
  location_id: string;
  generiert_am: string;
}

const MOCK: Snapshot = {
  gesamt_bestellungen: 47,
  gesamt_umsatz_eur: 1840,
  schnitt_lieferzeit_min: 26,
  fahrer_schnitt_stimmung: 3.8,
  top_zone: 'Nord',
  top_fahrer: 'Max M.',
  aktive_fahrer: 8,
  location_id: '',
  generiert_am: new Date().toISOString(),
};

function Kpi({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-white/60 dark:bg-white/5 px-3 py-2.5 text-center min-w-0">
      <Icon className="h-4 w-4 text-matcha-600 dark:text-matcha-400 mb-1" />
      <p className="text-xs text-slate-500 dark:text-slate-400 truncate w-full">{label}</p>
      <p className="text-sm font-black text-slate-800 dark:text-slate-100 tabular-nums truncate w-full">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export function FahrerPhase1264SchichtSnapshotWidget({
  locationId,
  isOnline,
}: {
  locationId?: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!isOnline || !locationId) { setData(MOCK); setLoading(false); return; }
    try {
      const r = await fetch(`/api/delivery/admin/schicht-snapshot?location_id=${locationId}`);
      if (!r.ok) throw new Error();
      setData(await r.json());
    } catch {
      setData({ ...MOCK, location_id: locationId ?? '' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15 * 60_000);
    return () => clearInterval(t);
  }, [locationId, isOnline]);

  if (!isOnline) return null;

  const d = data ?? MOCK;
  const stimmungEmoji = d.fahrer_schnitt_stimmung
    ? d.fahrer_schnitt_stimmung >= 4.5 ? '😄' : d.fahrer_schnitt_stimmung >= 3.5 ? '😊' : d.fahrer_schnitt_stimmung >= 2.5 ? '😐' : '😑'
    : null;

  return (
    <div className="rounded-xl border border-matcha-200 dark:border-matcha-800 bg-matcha-50 dark:bg-matcha-950/30 shadow-sm overflow-hidden mb-3">
      <button
        className="flex w-full items-center justify-between px-4 py-2.5 bg-gradient-to-r from-matcha-600 to-matcha-500 text-white"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4" />
          <span className="font-semibold text-sm">Schicht-Snapshot</span>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold">
              {d.gesamt_bestellungen} Bestellungen
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="px-3 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Kpi
              icon={Euro}
              label="Gesamt-Umsatz"
              value={`${d.gesamt_umsatz_eur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`}
            />
            <Kpi
              icon={Clock}
              label="Ø Lieferzeit"
              value={d.schnitt_lieferzeit_min != null ? `${d.schnitt_lieferzeit_min} Min` : '—'}
            />
            <Kpi
              icon={MapPin}
              label="Top-Zone"
              value={d.top_zone ?? '—'}
            />
            <Kpi
              icon={Users}
              label="Aktive Fahrer"
              value={String(d.aktive_fahrer)}
            />
          </div>
          {(d.top_fahrer || stimmungEmoji) && (
            <div className="flex items-center justify-between rounded-lg bg-white/60 dark:bg-white/5 px-3 py-2">
              {d.top_fahrer && (
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-matcha-500" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">Top-Fahrer</span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{d.top_fahrer}</span>
                </div>
              )}
              {stimmungEmoji && d.fahrer_schnitt_stimmung != null && (
                <div className="flex items-center gap-1">
                  <span className="text-base">{stimmungEmoji}</span>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {d.fahrer_schnitt_stimmung.toFixed(1)} Team-Stimmung
                  </span>
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-slate-400 dark:text-slate-500 text-right">
            Stand: {new Date(d.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
          </p>
        </div>
      )}
    </div>
  );
}
