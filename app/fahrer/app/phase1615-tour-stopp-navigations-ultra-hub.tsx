'use client';

import React, { useMemo, useState } from 'react';

interface Stop {
  id: string;
  adresse?: string | null;
  status?: string | null;
  sequence_number?: number | null;
  eta?: string | null;
  customer_name?: string | null;
  phone?: string | null;
  distance_km?: number | null;
  order_id?: string | null;
}

interface Props {
  stops: Stop[];
  currentStopId?: string | null;
  onNavigate?: (stop: Stop) => void;
  onComplete?: (stopId: string) => void;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string; ring: string }> = {
  geliefert:      { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Geliefert',  ring: 'ring-emerald-300' },
  abgeschlossen:  { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Abgeschl.',  ring: 'ring-emerald-300' },
  unterwegs:      { bg: 'bg-blue-50',    text: 'text-blue-700',    label: 'Unterwegs',  ring: 'ring-blue-400'    },
  pending:        { bg: 'bg-stone-50',   text: 'text-stone-500',   label: 'Ausstehend', ring: 'ring-stone-200'   },
};

function etaLabel(iso: string | null | undefined): string {
  if (!iso) return '–';
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.round((d.getTime() - now.getTime()) / 60_000);
  if (Math.abs(diffMin) < 1) return 'jetzt';
  if (diffMin > 0) return `in ${diffMin} min`;
  return `vor ${-diffMin} min`;
}

export function FahrerPhase1615TourStoppNavigationsUltraHub({ stops, currentStopId, onNavigate, onComplete }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const sorted = useMemo(() =>
    [...stops].sort((a, b) => (a.sequence_number ?? 99) - (b.sequence_number ?? 99)),
  [stops]);

  const naechster = sorted.find(
    (s) => s.status !== 'geliefert' && s.status !== 'abgeschlossen',
  );

  if (sorted.length === 0) return null;

  const done = sorted.filter((s) => s.status === 'geliefert' || s.status === 'abgeschlossen').length;

  return (
    <div className="rounded-2xl border border-blue-200 bg-white overflow-hidden shadow-sm mb-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-blue-700 text-white">
        <span className="text-sm font-bold uppercase tracking-wider flex-1">Tour-Stopps</span>
        <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">
          {done}/{sorted.length} erledigt
        </span>
      </div>

      {/* Fortschrittsbalken */}
      <div className="h-1.5 bg-stone-100">
        <div
          className="h-full bg-blue-500 transition-all"
          style={{ width: `${sorted.length > 0 ? (done / sorted.length) * 100 : 0}%` }}
        />
      </div>

      {/* Nächster Stopp Highlight */}
      {naechster && (
        <div className="mx-4 mt-3 mb-2 rounded-xl border border-blue-100 bg-blue-50 p-3">
          <div className="text-[10px] font-bold uppercase text-blue-600 mb-1">Nächster Stopp</div>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-black">
              {naechster.sequence_number ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-stone-800 truncate">
                {naechster.customer_name ?? 'Kunde'}
              </div>
              <div className="text-xs text-stone-500 truncate">{naechster.adresse ?? '–'}</div>
              <div className="flex items-center gap-3 mt-1 text-xs text-stone-500">
                {naechster.distance_km != null && (
                  <span>{naechster.distance_km.toFixed(1)} km</span>
                )}
                {naechster.eta && (
                  <span className="text-blue-600 font-semibold">{etaLabel(naechster.eta)}</span>
                )}
              </div>
            </div>
            <button
              onClick={() => onNavigate?.(naechster)}
              className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white active:bg-blue-700 transition-colors"
            >
              Navi
            </button>
          </div>
        </div>
      )}

      {/* Alle Stopps */}
      <div className="divide-y divide-stone-50 pb-2">
        {sorted.map((s) => {
          const ss = STATUS_STYLE[s.status ?? ''] ?? STATUS_STYLE['pending'];
          const isActive = s.id === currentStopId || s.id === naechster?.id;
          const isExpanded = expanded === s.id;

          return (
            <div key={s.id}>
              <button
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isActive ? 'bg-blue-50' : 'hover:bg-stone-50'}`}
                onClick={() => setExpanded(isExpanded ? null : s.id)}
              >
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ring-2 ${ss.bg} ${ss.text} ${ss.ring}`}>
                  {s.sequence_number ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-stone-800 truncate">
                      {s.customer_name ?? 'Kunde'}
                    </span>
                    <span className={`text-[9px] font-bold rounded-full px-1.5 py-0.5 ${ss.bg} ${ss.text}`}>
                      {ss.label}
                    </span>
                  </div>
                  <div className="text-xs text-stone-400 truncate">{s.adresse ?? '–'}</div>
                </div>
                {s.eta && (
                  <span className="text-[10px] font-semibold text-stone-500 shrink-0">
                    {etaLabel(s.eta)}
                  </span>
                )}
                <span className="text-stone-300 text-xs ml-1">{isExpanded ? '▲' : '▼'}</span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 bg-stone-50 border-t border-stone-100">
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {s.phone && (
                      <a
                        href={`tel:${s.phone}`}
                        className="flex items-center gap-1 rounded-lg bg-white border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-700 active:bg-stone-100"
                      >
                        📞 Anrufen
                      </a>
                    )}
                    <button
                      onClick={() => onNavigate?.(s)}
                      className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white active:bg-blue-700"
                    >
                      🧭 Navigation
                    </button>
                    {s.status !== 'geliefert' && s.status !== 'abgeschlossen' && (
                      <button
                        onClick={() => onComplete?.(s.id)}
                        className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white active:bg-emerald-700"
                      >
                        ✓ Abschließen
                      </button>
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
