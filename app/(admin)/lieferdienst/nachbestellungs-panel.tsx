'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ShoppingCart, ChevronDown, ChevronUp, RefreshCw, CheckCircle2, Clock, PackageCheck } from 'lucide-react';

type NachbestellungStatus = 'ausstehend' | 'bestellt' | 'geliefert';

interface Nachbestellung {
  id:           string;
  artikelName:  string | null;
  einheit:      string | null;
  menge:        number;
  currentStock: number | null;
  minStock:     number | null;
  status:       NachbestellungStatus;
  ausgeloestAm: string;
  bestelltAm:   string | null;
  geliefertAm:  string | null;
  notizen:      string | null;
}

const STATUS_CONFIG: Record<NachbestellungStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  ausstehend: {
    label: 'Ausstehend',
    color: 'text-amber-700',
    bg:    'bg-amber-50',
    icon:  <Clock className="h-3 w-3" />,
  },
  bestellt: {
    label: 'Bestellt',
    color: 'text-blue-700',
    bg:    'bg-blue-50',
    icon:  <ShoppingCart className="h-3 w-3" />,
  },
  geliefert: {
    label: 'Geliefert',
    color: 'text-emerald-700',
    bg:    'bg-emerald-50',
    icon:  <PackageCheck className="h-3 w-3" />,
  },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function NachbestellungsPanel({ locationId }: { locationId: string | null }) {
  const [open, setOpen]           = useState(false);
  const [items, setItems]         = useState<Nachbestellung[]>([]);
  const [loading, setLoading]     = useState(false);
  const [scanning, setScanning]   = useState(false);
  const [updating, setUpdating]   = useState<string | null>(null);
  const [filter, setFilter]       = useState<NachbestellungStatus | ''>('');
  const locationRef               = useRef(locationId);
  locationRef.current             = locationId;

  const load = useCallback(async () => {
    const loc = locationRef.current;
    if (!loc) return;
    setLoading(true);
    try {
      const statusParam = filter ? `&status=${filter}` : '';
      const r = await fetch(`/api/delivery/admin/nachbestellungen?location_id=${encodeURIComponent(loc)}${statusParam}`);
      const j = await r.json() as { nachbestellungen?: Nachbestellung[] };
      if (j.nachbestellungen) setItems(j.nachbestellungen);
    } catch {/* ignore */}
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => {
    if (open && locationId) load();
  }, [open, locationId, load]);

  const handleScan = async () => {
    if (!locationId) return;
    setScanning(true);
    try {
      await fetch('/api/delivery/admin/nachbestellungen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan', location_id: locationId }),
      });
      await load();
    } catch {/* ignore */}
    finally { setScanning(false); }
  };

  const handleUpdateStatus = async (id: string, status: NachbestellungStatus) => {
    if (!locationId) return;
    setUpdating(id);
    try {
      await fetch('/api/delivery/admin/nachbestellungen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-status', id, location_id: locationId, status }),
      });
      await load();
    } catch {/* ignore */}
    finally { setUpdating(null); }
  };

  const ausstehend = items.filter((i) => i.status === 'ausstehend').length;
  const bestellt   = items.filter((i) => i.status === 'bestellt').length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-700">
            <ShoppingCart className="h-4 w-4" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-char">Nachbestellungen</div>
            <div className="text-xs text-stone-400">
              {ausstehend > 0
                ? `${ausstehend} ausstehend · ${bestellt} bestellt`
                : 'Lagerbestands-Bestellaufträge'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ausstehend > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
              {ausstehend}
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-stone-100 p-5 space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1">
              {(['', 'ausstehend', 'bestellt', 'geliefert'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    filter === s
                      ? 'bg-char text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {s === '' ? 'Alle' : STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
            <button
              onClick={handleScan}
              disabled={scanning}
              className="flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${scanning ? 'animate-spin' : ''}`} />
              Bestände scannen
            </button>
          </div>

          {/* Liste */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-stone-100 animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-sm text-stone-400 py-6">
              Keine Nachbestellungen vorhanden.
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => {
                const cfg = STATUS_CONFIG[item.status];
                return (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50 p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-char truncate">
                          {item.artikelName ?? 'Unbekannter Artikel'}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
                          {cfg.icon}
                          {cfg.label}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-3 text-[11px] text-stone-500">
                        <span>
                          <strong>{item.menge}</strong> {item.einheit ?? 'Stk'}
                        </span>
                        {item.currentStock != null && item.minStock != null && (
                          <span>Bestand: <strong>{item.currentStock}</strong> / Min: {item.minStock}</span>
                        )}
                        <span>Erstellt: {fmtDate(item.ausgeloestAm)}</span>
                        {item.bestelltAm && <span>Bestellt: {fmtDate(item.bestelltAm)}</span>}
                        {item.geliefertAm && <span className="text-emerald-600">Geliefert: {fmtDate(item.geliefertAm)}</span>}
                      </div>
                    </div>

                    {/* Aktions-Buttons */}
                    <div className="flex gap-1.5 shrink-0">
                      {item.status === 'ausstehend' && (
                        <button
                          onClick={() => handleUpdateStatus(item.id, 'bestellt')}
                          disabled={updating === item.id}
                          className="rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                        >
                          Bestellt
                        </button>
                      )}
                      {item.status === 'bestellt' && (
                        <button
                          onClick={() => handleUpdateStatus(item.id, 'geliefert')}
                          disabled={updating === item.id}
                          className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Geliefert
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
