'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckSquare, Square, ChevronDown, ChevronUp, ClipboardList, AlertTriangle, CheckCircle2 } from 'lucide-react';

// Phase 1513 — Schicht-End-Checkliste (Kitchen)
// Props-basierte Checkliste zum Schichtende (Offene Bestellungen / Reinigung / Lagerbestand)
// mit Bestätigungs-Checkboxen + Status-Ampel; nach Phase1508.

interface Order {
  id: string;
  status?: string | null;
}

interface Props {
  orders: Order[];
  schichtEnde?: boolean;
}

const AKTIVE_STATUSES = new Set(['pending', 'confirmed', 'preparing', 'in_zubereitung', 'accepted']);

interface CheckItem {
  id: string;
  label: string;
  kategorie: 'bestellungen' | 'reinigung' | 'lagerbestand';
  pflicht: boolean;
}

const CHECKLISTEN_ITEMS: CheckItem[] = [
  { id: 'orders_done', label: 'Alle Bestellungen abgeschlossen', kategorie: 'bestellungen', pflicht: true },
  { id: 'orders_checked', label: 'Offene Queues geprüft', kategorie: 'bestellungen', pflicht: true },
  { id: 'station_clean', label: 'Kochstation gereinigt', kategorie: 'reinigung', pflicht: true },
  { id: 'equipment_clean', label: 'Geräte & Werkzeug desinfiziert', kategorie: 'reinigung', pflicht: true },
  { id: 'floor_clean', label: 'Boden gefegt und gewischt', kategorie: 'reinigung', pflicht: false },
  { id: 'stock_checked', label: 'Lagerbestand überprüft', kategorie: 'lagerbestand', pflicht: true },
  { id: 'cold_chain', label: 'Kühlkette kontrolliert', kategorie: 'lagerbestand', pflicht: true },
  { id: 'waste_disposed', label: 'Abfall entsorgt', kategorie: 'lagerbestand', pflicht: false },
];

const KATEGORIE_CONFIG: Record<string, { label: string; color: string }> = {
  bestellungen: { label: 'Bestellungen', color: 'text-blue-600 dark:text-blue-400' },
  reinigung: { label: 'Reinigung', color: 'text-emerald-600 dark:text-emerald-400' },
  lagerbestand: { label: 'Lagerbestand', color: 'text-amber-600 dark:text-amber-400' },
};

type AmpelStatus = 'ok' | 'warnung' | 'offen';

export function KitchenPhase1513SchichtEndCheckliste({ orders, schichtEnde = false }: Props) {
  const [open, setOpen] = useState(true);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const offeneBestellungen = useMemo(
    () => orders.filter(o => AKTIVE_STATUSES.has(o.status ?? '')).length,
    [orders],
  );

  const hatOffene = offeneBestellungen > 0;

  const pflichtItems = CHECKLISTEN_ITEMS.filter(i => i.pflicht);
  const allePflichtErledigt = pflichtItems.every(i => {
    if (i.id === 'orders_done') return !hatOffene && !!checked[i.id];
    return !!checked[i.id];
  });
  const alleErledigt = CHECKLISTEN_ITEMS.every(i => {
    if (i.id === 'orders_done') return !hatOffene && !!checked[i.id];
    return !!checked[i.id];
  });

  const erledigteAnzahl = CHECKLISTEN_ITEMS.filter(i => {
    if (i.id === 'orders_done') return !hatOffene && !!checked[i.id];
    return !!checked[i.id];
  }).length;

  const ampel: AmpelStatus = alleErledigt ? 'ok' : allePflichtErledigt ? 'warnung' : 'offen';

  const AMPEL_CONFIG: Record<AmpelStatus, { border: string; badge: string; badgeText: string; icon: React.ReactNode }> = {
    ok: {
      border: 'border-emerald-200 dark:border-emerald-800',
      badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
      badgeText: 'Abgeschlossen',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    },
    warnung: {
      border: 'border-amber-200 dark:border-amber-800',
      badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
      badgeText: 'Fast fertig',
      icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    },
    offen: {
      border: 'border-slate-200 dark:border-slate-700',
      badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
      badgeText: `${erledigteAnzahl}/${CHECKLISTEN_ITEMS.length}`,
      icon: <ClipboardList className="w-4 h-4 text-slate-400" />,
    },
  };

  const cfg = AMPEL_CONFIG[ampel];

  const kategorien = ['bestellungen', 'reinigung', 'lagerbestand'] as const;

  function toggleItem(id: string) {
    if (id === 'orders_done' && hatOffene) return;
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className={cn('rounded-xl border overflow-hidden', cfg.border)}>
      <button
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        {cfg.icon}
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1 text-left">
          Schicht-End-Checkliste
        </span>
        {hatOffene && (
          <span className="text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 px-1.5 py-0.5 rounded-full font-bold shrink-0">
            {offeneBestellungen} offen
          </span>
        )}
        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0', cfg.badge)}>
          {cfg.badgeText}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 bg-white dark:bg-slate-900 space-y-4">
          {/* Fortschrittsbalken */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>{erledigteAnzahl} von {CHECKLISTEN_ITEMS.length} erledigt</span>
              <span>{Math.round((erledigteAnzahl / CHECKLISTEN_ITEMS.length) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.round((erledigteAnzahl / CHECKLISTEN_ITEMS.length) * 100)}%`,
                  backgroundColor: ampel === 'ok' ? '#10b981' : ampel === 'warnung' ? '#f59e0b' : '#94a3b8',
                }}
              />
            </div>
          </div>

          {/* Kategorien */}
          {kategorien.map(kat => {
            const items = CHECKLISTEN_ITEMS.filter(i => i.kategorie === kat);
            const katCfg = KATEGORIE_CONFIG[kat];
            return (
              <div key={kat} className="space-y-2">
                <div className={cn('text-[11px] font-bold uppercase tracking-wide', katCfg.color)}>
                  {katCfg.label}
                </div>
                {items.map(item => {
                  const isBlocked = item.id === 'orders_done' && hatOffene;
                  const isChecked = item.id === 'orders_done' ? (!hatOffene && !!checked[item.id]) : !!checked[item.id];
                  return (
                    <button
                      key={item.id}
                      className={cn(
                        'w-full flex items-center gap-2 text-left rounded-lg px-3 py-2 transition-colors',
                        isBlocked
                          ? 'bg-rose-50 dark:bg-rose-950/20 cursor-not-allowed opacity-60'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer',
                      )}
                      onClick={() => toggleItem(item.id)}
                      disabled={isBlocked}
                    >
                      {isChecked
                        ? <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                        : <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                      }
                      <span className={cn(
                        'text-sm flex-1',
                        isChecked ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200',
                      )}>
                        {item.label}
                      </span>
                      {item.pflicht && (
                        <span className="text-[9px] text-slate-400 shrink-0">Pflicht</span>
                      )}
                      {isBlocked && (
                        <span className="text-[9px] text-rose-500 shrink-0">{offeneBestellungen} offen</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {/* Status-Footer */}
          {allePflichtErledigt && !alleErledigt && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
              Pflichtaufgaben erledigt — optionale Punkte noch offen.
            </div>
          )}
          {alleErledigt && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Schicht vollständig abgeschlossen — gute Arbeit!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
