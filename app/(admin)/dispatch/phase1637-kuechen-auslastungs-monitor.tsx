'use client';

import React, { useCallback, useEffect, useState } from 'react';

interface KuecheRow {
  location_id: string;
  location_name: string;
  aktive_bestellungen: number;
  kapazitaetsgrenze: number;
  auslastungsgrad: number;
  eta_anpassungsfaktor: number;
  status: 'niedrig' | 'normal' | 'hoch' | 'kritisch';
}

interface KuechenAuslastungData {
  kuechen: KuecheRow[];
  gesamt_aktiv: number;
  gesamt_kapazitaet: number;
  gesamt_auslastung: number;
  timestamp: string;
}

interface Props {
  locationId: string | null;
}

const STATUS_META: Record<KuecheRow['status'], {
  label: string;
  bg: string;
  border: string;
  text: string;
  dot: string;
  badge: string;
  badgeText: string;
}> = {
  niedrig:  { label: 'Niedrig',  bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-400',  badge: 'bg-emerald-100 border-emerald-300',  badgeText: 'text-emerald-700' },
  normal:   { label: 'Normal',   bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    dot: 'bg-blue-400',     badge: 'bg-blue-100 border-blue-300',        badgeText: 'text-blue-700'    },
  hoch:     { label: 'Hoch',     bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-400',    badge: 'bg-amber-100 border-amber-300',      badgeText: 'text-amber-700'   },
  kritisch: { label: 'Kritisch', bg: 'bg-red-50',     border: 'border-red-300',     text: 'text-red-700',     dot: 'bg-red-500',      badge: 'bg-red-100 border-red-300',          badgeText: 'text-red-700'     },
};

function fmtPct(v: number) {
  return `${Math.round(v * 100)}%`;
}

function fmtFaktor(v: number) {
  return `×${v.toFixed(2)}`;
}

export function DispatchPhase1637KuechenAuslastungsMonitor({ locationId }: Props) {
  const [data, setData] = useState<KuechenAuslastungData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (locationId) params.set('location_id', locationId);
    try {
      const r = await fetch(`/api/delivery/admin/kuechen-auslastung?${params}`, { cache: 'no-store' });
      if (r.ok) {
        setData(await r.json());
        setLastUpdate(new Date());
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60_000); // 5-Min-Polling
    return () => clearInterval(id);
  }, [load]);

  if (loading) return null;
  if (!data || data.kuechen.length === 0) return null;

  const kritischCount = data.kuechen.filter((k) => k.status === 'kritisch').length;
  const hochCount = data.kuechen.filter((k) => k.status === 'hoch').length;
  const headerBg = kritischCount > 0 ? 'bg-red-600' : hochCount > 0 ? 'bg-amber-600' : 'bg-blue-600';

  return (
    <div className="rounded-2xl border border-blue-200 bg-white overflow-hidden shadow-sm mb-4">
      {/* Header */}
      <button
        className={`w-full flex items-center gap-3 px-4 py-3 ${headerBg} text-white`}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="text-sm font-bold uppercase tracking-wider flex-1 text-left">
          Küchen-Auslastung
        </span>
        <div className="flex items-center gap-2 text-xs">
          {kritischCount > 0 && (
            <span className="bg-white/25 rounded-full px-2 py-0.5 font-bold">{kritischCount} kritisch</span>
          )}
          <span className="bg-white/15 rounded-full px-2 py-0.5 tabular-nums">
            Gesamt {fmtPct(data.gesamt_auslastung)}
          </span>
          <span className="opacity-70 text-[10px]">{collapsed ? '▼' : '▲'}</span>
        </div>
      </button>

      {!collapsed && (
        <div className="p-3 space-y-2">
          {/* Gesamt-Auslastungsbalken */}
          <div className="px-1 pb-1">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Gesamt-Auslastung</span>
              <span className="tabular-nums font-medium">
                {data.gesamt_aktiv} / {data.gesamt_kapazitaet} Bestellungen
              </span>
            </div>
            <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  data.gesamt_auslastung >= 0.9 ? 'bg-red-500' :
                  data.gesamt_auslastung >= 0.7 ? 'bg-amber-500' :
                  data.gesamt_auslastung >= 0.4 ? 'bg-blue-500' :
                  'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(data.gesamt_auslastung * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Küchen-Karten */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.kuechen.map((kueche) => {
              const meta = STATUS_META[kueche.status];
              return (
                <div
                  key={kueche.location_id}
                  className={`rounded-xl border p-3 ${meta.bg} ${meta.border}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`relative flex h-2 w-2`}>
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${meta.dot}`} />
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${meta.dot}`} />
                    </span>
                    <span className={`text-xs font-bold truncate flex-1 ${meta.text}`}>
                      {kueche.location_name}
                    </span>
                    <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 border ${meta.badge} ${meta.badgeText}`}>
                      {meta.label}
                    </span>
                  </div>

                  {/* Auslastungsbalken */}
                  <div className="h-1.5 rounded-full bg-black/10 overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${meta.dot}`}
                      style={{ width: `${Math.min(kueche.auslastungsgrad * 100, 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className={`tabular-nums ${meta.text}`}>
                      {kueche.aktive_bestellungen}/{kueche.kapazitaetsgrenze} aktiv
                    </span>
                    <span className={`font-bold tabular-nums ${meta.text}`}>
                      {fmtPct(kueche.auslastungsgrad)}
                    </span>
                  </div>

                  {/* ETA-Anpassungsfaktor */}
                  {kueche.eta_anpassungsfaktor !== 1.0 && (
                    <div className={`mt-1.5 text-[10px] font-medium rounded px-1.5 py-0.5 border ${meta.badge} ${meta.badgeText} inline-flex items-center gap-1`}>
                      <span>ETA</span>
                      <span className="font-bold">{fmtFaktor(kueche.eta_anpassungsfaktor)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Letzte Aktualisierung */}
          {lastUpdate && (
            <div className="text-[10px] text-muted-foreground/50 text-right px-1">
              Aktualisiert {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · alle 5 Min
            </div>
          )}
        </div>
      )}
    </div>
  );
}
