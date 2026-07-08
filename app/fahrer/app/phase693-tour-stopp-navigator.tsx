'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, Phone, Clock, CheckCircle2, ChevronDown, ChevronUp, Package, Zap, ExternalLink } from 'lucide-react';

type OrderInfo = {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  kunde_adresse: string | null;
  kunde_plz: string | null;
  kunde_telefon: string | null;
  eta_earliest?: string | null;
  eta_latest?: string | null;
  kunde_notiz?: string | null;
  gesamtbetrag: number | null;
  bezahlt?: boolean | null;
  zahlungsart?: string | null;
};

type TourStop = {
  id: string;
  sequence?: number | null;
  completed_at?: string | null;
  type?: string | null;
  order?: OrderInfo | null;
};

function formatEta(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function openNavigation(adresse: string | null, plz: string | null) {
  if (!adresse) return;
  const q = encodeURIComponent([adresse, plz, 'Deutschland'].filter(Boolean).join(', '));
  const url = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    ? `maps://maps.apple.com/?q=${q}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`;
  window.open(url, '_blank');
}

function StopCard({ stop, index, total }: { stop: TourStop; index: number; total: number }) {
  const [expanded, setExpanded] = useState(false);
  const order = stop.order;
  const isCompleted = !!stop.completed_at;
  const isPickup = stop.type === 'pickup';

  const etaMin = order?.eta_earliest ? formatEta(order.eta_earliest) : null;
  const etaMax = order?.eta_latest   ? formatEta(order.eta_latest)   : null;
  const etaStr = etaMin && etaMax ? `${etaMin}–${etaMax}` : etaMin ?? null;

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden transition-all',
      isCompleted
        ? 'bg-matcha-50 border-matcha-200 opacity-70'
        : 'bg-white border-border shadow-sm',
    )}>
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Step indicator */}
        <div className={cn(
          'shrink-0 h-8 w-8 rounded-full border-2 flex items-center justify-center text-xs font-black',
          isCompleted
            ? 'bg-matcha-500 border-matcha-600 text-white'
            : index === 0
            ? 'bg-foreground border-foreground text-background'
            : 'bg-muted border-muted-foreground/30 text-muted-foreground',
        )}>
          {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
        </div>

        <div className="flex-1 min-w-0">
          {isPickup ? (
            <div className="text-xs font-bold text-matcha-700 flex items-center gap-1">
              <Package className="h-3.5 w-3.5" /> Abholung Restaurant
            </div>
          ) : (
            <>
              <div className="text-xs font-bold truncate">{order?.kunde_name ?? 'Kunde'}</div>
              <div className="text-[10px] text-muted-foreground truncate">
                {order?.kunde_adresse ?? '—'}{order?.kunde_plz ? ', ' + order.kunde_plz : ''}
              </div>
            </>
          )}
        </div>

        <div className="shrink-0 flex flex-col items-end gap-0.5">
          {etaStr && !isPickup && (
            <span className="text-[10px] font-bold text-matcha-600">{etaStr}</span>
          )}
          {!isPickup && order?.bezahlt === false && (
            <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">
              Bar
            </span>
          )}
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && !isPickup && order && (
        <div className="border-t px-4 py-3 space-y-3">
          {/* Order info */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <div className="text-muted-foreground">Bestellung</div>
              <div className="font-bold">#{order.bestellnummer}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Betrag</div>
              <div className="font-bold">
                {order.gesamtbetrag !== null
                  ? order.gesamtbetrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
                  : '—'}
              </div>
            </div>
            {etaStr && (
              <div>
                <div className="text-muted-foreground">ETA</div>
                <div className="font-bold text-matcha-700">{etaStr} Uhr</div>
              </div>
            )}
            <div>
              <div className="text-muted-foreground">Zahlung</div>
              <div className={cn('font-bold', order.bezahlt ? 'text-matcha-600' : 'text-amber-600')}>
                {order.bezahlt ? 'Bezahlt' : `Bar (${order.zahlungsart ?? 'Cash'})`}
              </div>
            </div>
          </div>

          {order.kunde_notiz && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <div className="text-[9px] font-bold uppercase tracking-wider text-amber-600 mb-0.5">Kundennotiz</div>
              <div className="text-[11px] text-amber-900">{order.kunde_notiz}</div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => openNavigation(order.kunde_adresse, order.kunde_plz)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-matcha-600 text-white py-2.5 text-xs font-bold active:scale-95 transition-transform"
            >
              <Navigation className="h-3.5 w-3.5" />
              Navigation
            </button>
            {order.kunde_telefon && (
              <a
                href={`tel:${order.kunde_telefon}`}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-muted px-4 py-2.5 text-xs font-bold active:scale-95 transition-transform"
              >
                <Phone className="h-3.5 w-3.5" />
                Anrufen
              </a>
            )}
          </div>
        </div>
      )}

      {/* Connection line */}
      {index < total - 1 && !expanded && (
        <div className="ml-[1.875rem] h-3 w-0.5 bg-border" />
      )}
    </div>
  );
}

export function FahrerPhase693TourStoppNavigator({
  stops,
  className,
}: {
  stops: TourStop[];
  className?: string;
}) {
  const [open, setOpen] = useState(true);

  const sorted = [...stops].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  const completedCount = sorted.filter(s => s.completed_at).length;
  const remaining = sorted.length - completedCount;
  const progressPct = sorted.length > 0 ? Math.round((completedCount / sorted.length) * 100) : 0;

  if (sorted.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 bg-card border rounded-xl px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <Zap className="h-4 w-4 text-matcha-600 shrink-0" />
        <div className="flex-1 text-left">
          <div className="text-xs font-bold uppercase tracking-wider">Tour-Stopp-Navigator</div>
          <div className="text-[10px] text-muted-foreground">
            {completedCount}/{sorted.length} abgeschlossen · {remaining} verbleibend
          </div>
        </div>

        {/* Mini progress */}
        <div className="shrink-0 flex items-center gap-2">
          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-matcha-500 transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-[10px] font-bold tabular-nums text-matcha-600">{progressPct}%</span>
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>

      {/* Stops list */}
      {open && (
        <div className="space-y-1.5 pl-1">
          {sorted.map((stop, i) => (
            <StopCard key={stop.id} stop={stop} index={i} total={sorted.length} />
          ))}
        </div>
      )}
    </div>
  );
}
