'use client';

import { useMemo, useState } from 'react';
import { ChefHat, ChevronDown, ChevronUp, Flame, Snowflake, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1176 — Koch-Reihenfolge-Empfehlung (Kitchen)
// Optimale Koch-Sequenz: Ofen zuerst (längste Rüstzeit), dann Grill/Pasta, Kaltware zuletzt

interface OrderItem {
  name?: string;
  menge?: number;
  [key: string]: unknown;
}

interface Order {
  id: string;
  bestellnummer?: string;
  bestellt_am?: string | null;
  status?: string;
  items?: OrderItem[];
  [key: string]: unknown;
}

interface Props {
  orders: Order[];
}

type Station = 'ofen' | 'grill' | 'friteuse' | 'pasta' | 'herd' | 'kalt';

const STATION_KEYWORDS: Record<Station, string[]> = {
  ofen:     ['pizza', 'lasagne', 'auflauf', 'brot', 'quiche', 'flammkuchen', 'überbacken', 'gratiniert'],
  grill:    ['burger', 'steak', 'grill', 'bbq', 'schnitzel', 'wrap', 'panini', 'toast'],
  friteuse: ['pommes', 'frites', 'nuggets', 'chicken', 'frit', 'onion ring', 'kalamari', 'mozzarella stick'],
  pasta:    ['pasta', 'spaghetti', 'nudel', 'penne', 'rigatoni', 'tagliatelle', 'gnocchi', 'risotto', 'ramen'],
  herd:     ['suppe', 'eintopf', 'curry', 'sauce', 'wok', 'pfanne', 'chili', 'ramen', 'gulasch'],
  kalt:     ['salat', 'sandwich', 'bowl', 'sushi', 'poke', 'wrap kalt', 'dessert', 'kuchen', 'eis', 'smoothie'],
};

const STATION_META: Record<Station, { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; bg: string; text: string; ruestzeit: number }> = {
  ofen:     { label: 'Ofen',     icon: Flame,    bg: 'bg-orange-100', text: 'text-orange-700', ruestzeit: 15 },
  grill:    { label: 'Grill',   icon: Flame,    bg: 'bg-red-100',    text: 'text-red-700',    ruestzeit: 8  },
  friteuse: { label: 'Friteuse',icon: Flame,    bg: 'bg-yellow-100', text: 'text-yellow-700', ruestzeit: 6  },
  pasta:    { label: 'Pasta',   icon: ChefHat,  bg: 'bg-amber-100',  text: 'text-amber-700',  ruestzeit: 5  },
  herd:     { label: 'Herd',    icon: ChefHat,  bg: 'bg-matcha-100', text: 'text-matcha-700', ruestzeit: 7  },
  kalt:     { label: 'Kalt',   icon: Snowflake, bg: 'bg-blue-100',   text: 'text-blue-700',   ruestzeit: 2  },
};

const STATION_ORDER: Station[] = ['ofen', 'grill', 'friteuse', 'herd', 'pasta', 'kalt'];

function detectStation(name: string): Station {
  const lower = name.toLowerCase();
  for (const st of STATION_ORDER) {
    if (STATION_KEYWORDS[st].some(kw => lower.includes(kw))) return st;
  }
  return 'herd';
}

interface StopInfo {
  orderId: string;
  bestellnummer: string;
  station: Station;
  ruestzeit: number;
  artikel: string[];
  wartezeit_min: number;
}

export function KitchenPhase1176KochReihenfolgeEmpfehlung({ orders }: Props) {
  const [open, setOpen] = useState(false);

  const sorted = useMemo<StopInfo[]>(() => {
    const active = orders.filter(o => o.status !== 'geliefert' && o.status !== 'storniert');
    const now = Date.now();

    return active
      .map(o => {
        const items = (o.items ?? []) as OrderItem[];
        const artikel = items.map(i => i.name ?? '').filter(Boolean);
        // find dominant station = highest ruestzeit among items
        let topStation: Station = 'kalt';
        let topRuest = 0;
        for (const a of artikel) {
          const st = detectStation(a);
          const r = STATION_META[st].ruestzeit;
          if (r > topRuest) { topRuest = r; topStation = st; }
        }
        const wartezeit_min = o.bestellt_am
          ? Math.round((now - new Date(o.bestellt_am).getTime()) / 60_000)
          : 0;
        return { orderId: o.id, bestellnummer: o.bestellnummer ?? o.id.slice(-4), station: topStation, ruestzeit: topRuest || STATION_META[topStation].ruestzeit, artikel, wartezeit_min };
      })
      // sort: highest rüstzeit first, then highest wait
      .sort((a, b) => b.ruestzeit - a.ruestzeit || b.wartezeit_min - a.wartezeit_min);
  }, [orders]);

  if (sorted.length === 0) return null;

  const stationGroups = STATION_ORDER.filter(st => sorted.some(s => s.station === st));

  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50 overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-black/5 transition">
        <ChefHat size={16} className="text-orange-700" />
        <span className="font-bold text-sm uppercase tracking-wider text-orange-700">Koch-Reihenfolge</span>
        <span className="rounded-full bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 ml-1">
          {sorted.length} Bestellung{sorted.length !== 1 ? 'en' : ''}
        </span>
        <div className="ml-auto">
          {open ? <ChevronUp size={14} className="text-orange-700" /> : <ChevronDown size={14} className="text-orange-700" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-black/10 px-4 py-3 space-y-3">
          <p className="text-[10px] text-orange-700/70 font-medium">
            Ofen-Gerichte zuerst starten — sie brauchen am längsten. Kaltware zuletzt anrichten.
          </p>

          {stationGroups.map((station, idx) => {
            const group = sorted.filter(s => s.station === station);
            const meta = STATION_META[station];
            const Icon = meta.icon;
            return (
              <div key={station} className={cn('rounded-xl border px-3 py-2 space-y-2', meta.bg, 'border-black/10')}>
                <div className="flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full bg-white flex items-center justify-center text-[10px] font-black text-orange-700 shrink-0 border">
                    {idx + 1}
                  </span>
                  <Icon size={13} className={meta.text} />
                  <span className={cn('text-xs font-black uppercase tracking-wider', meta.text)}>{meta.label}</span>
                  <span className={cn('ml-auto text-[10px] font-bold flex items-center gap-0.5', meta.text)}>
                    <Timer size={9} /> {meta.ruestzeit} Min Rüstzeit
                  </span>
                </div>
                <div className="space-y-1">
                  {group.map(s => (
                    <div key={s.orderId} className="flex items-start gap-2">
                      <span className="text-[10px] font-black bg-white/70 rounded px-1 py-0.5 text-muted-foreground shrink-0">
                        #{s.bestellnummer.slice(-4)}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate flex-1">
                        {s.artikel.slice(0, 3).join(', ')}{s.artikel.length > 3 ? ` +${s.artikel.length - 3}` : ''}
                      </span>
                      {s.wartezeit_min > 0 && (
                        <span className={cn('text-[9px] font-bold shrink-0', s.wartezeit_min > 20 ? 'text-red-600' : s.wartezeit_min > 10 ? 'text-amber-600' : 'text-muted-foreground')}>
                          {s.wartezeit_min} Min
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
