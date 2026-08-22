'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Check, ChefHat, Clock, MapPin, Package, Star, Truck, Users, TrendingUp, ShoppingBag, Utensils,
  Sparkles, FileText, Bell, BookOpen, Receipt, Camera, CreditCard, Banknote,
} from 'lucide-react';

/* =========================
   1) Dienstplan-Demo
   ========================= */
export function ScheduleDemo() {
  const [week] = useState(() => [
    { day: 'Mo', shifts: [{ who: 'Mira',  from: '08:00', to: '14:00', tone: 'matcha' },  { who: 'Jamal', from: '14:00', to: '22:00', tone: 'gold' }] },
    { day: 'Di', shifts: [{ who: 'Nina',  from: '08:00', to: '16:00', tone: 'accent' }] },
    { day: 'Mi', shifts: [{ who: 'Mira',  from: '10:00', to: '18:00', tone: 'matcha' }, { who: 'Tom',  from: '18:00', to: '22:00', tone: 'gold' }] },
    { day: 'Do', shifts: [{ who: 'Nina',  from: '08:00', to: '14:00', tone: 'accent' }] },
    { day: 'Fr', shifts: [{ who: 'Mira',  from: '08:00', to: '12:00', tone: 'matcha' }, { who: 'Jamal', from: '12:00', to: '22:00', tone: 'gold' }] },
  ]);

  return (
    <div className="rounded-2xl border bg-white shadow-soft overflow-hidden">
      <div className="flex items-center justify-between bg-matcha-50 px-4 py-3 border-b">
        <div className="flex items-center gap-2 text-sm font-bold text-matcha-900">
          <Users size={14} /> Dienstplan · KW 15
        </div>
        <div className="text-xs text-matcha-700">5 Mitarbeiter · 142 Std</div>
      </div>
      <div className="grid grid-cols-5 divide-x text-xs">
        {week.map((d, di) => (
          <div key={d.day} className="p-2 min-h-[120px]">
            <div className="font-bold text-matcha-900 mb-2">{d.day}</div>
            {d.shifts.map((s, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-lg px-2 py-1.5 mb-1 text-[11px] animate-shift-in',
                  s.tone === 'matcha' && 'bg-matcha-100 text-matcha-900',
                  s.tone === 'gold' && 'bg-gold/30 text-matcha-900',
                  s.tone === 'accent' && 'bg-accent/30 text-matcha-900',
                )}
                style={{ animationDelay: `${di * 100 + i * 80}ms` }}
              >
                <div className="font-bold">{s.who}</div>
                <div className="text-[10px] opacity-70">{s.from}–{s.to}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <style jsx>{`
        @keyframes shift-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .animate-shift-in { animation: shift-in 0.5s ease-out both; }
      `}</style>
    </div>
  );
}

/* =========================
   2) Lager-Demo
   ========================= */
export function InventoryDemo() {
  const items = [
    { name: 'Matcha Premium', stock: 85, min: 40, tone: 'ok' },
    { name: 'Hafermilch', stock: 18, min: 30, tone: 'low' },
    { name: 'Croissants', stock: 42, min: 20, tone: 'ok' },
    { name: 'Erdbeeren', stock: 0, min: 10, tone: 'out' },
  ];
  return (
    <div className="rounded-2xl border bg-white shadow-soft overflow-hidden">
      <div className="flex items-center justify-between bg-matcha-50 px-4 py-3 border-b">
        <div className="flex items-center gap-2 text-sm font-bold text-matcha-900">
          <Package size={14} /> Bestand · Küche
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-red-700 animate-pulse">1 Reorder nötig</div>
      </div>
      <div className="divide-y text-xs">
        {items.map((it, i) => {
          const pct = Math.min(100, (it.stock / (it.min * 2)) * 100);
          const barColor = it.tone === 'ok' ? 'bg-matcha-500' : it.tone === 'low' ? 'bg-gold' : 'bg-red-500';
          return (
            <div key={i} className="px-4 py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex justify-between font-semibold">
                  <span className="truncate">{it.name}</span>
                  <span className={cn(
                    'font-mono text-[11px]',
                    it.tone === 'ok' && 'text-matcha-700',
                    it.tone === 'low' && 'text-gold-800',
                    it.tone === 'out' && 'text-red-700',
                  )}>{it.stock} / {it.min}</span>
                </div>
                <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all duration-1000 ease-out', barColor)} style={{ width: `${pct}%`, animation: 'grow 1.2s ease-out' }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <style jsx>{`@keyframes grow { from { width: 0; } }`}</style>
    </div>
  );
}

/* =========================
   3) Bestellsystem / Storefront-Mini
   ========================= */
export function OrderingDemo() {
  return (
    <div className="rounded-2xl border bg-white shadow-soft overflow-hidden">
      <div className="bg-gradient-to-br from-matcha-800 to-matcha-600 px-4 py-6 text-white">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70">AACHEN · ab 12 €</div>
        <div className="mt-1 font-display text-2xl font-bold">Matcha Kaffee</div>
        <div className="inline-flex mt-2 rounded-full bg-accent text-matcha-900 px-3 py-1 text-xs font-bold">
          14 Tage · 4,9 ★ · 312 Bewertungen
        </div>
      </div>
      <div className="p-3 space-y-2 text-xs">
        {[
          { name: 'Matcha Latte', price: '4,80', icon: '☕' },
          { name: 'Avocado Toast', price: '7,90', icon: '🥑' },
          { name: 'Matcha Bowl', price: '8,50', icon: '🍵' },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2 rounded-xl border px-3 py-2 animate-item-in" style={{ animationDelay: `${i * 120}ms` }}>
            <div className="h-10 w-10 bg-matcha-100 rounded-lg flex items-center justify-center text-xl">{item.icon}</div>
            <div className="flex-1 font-semibold">{item.name}</div>
            <div className="font-display font-bold">{item.price} €</div>
            <div className="h-6 w-6 rounded-full bg-matcha-900 text-white flex items-center justify-center text-xs animate-pulse-once" style={{ animationDelay: `${i * 120 + 400}ms` }}>+</div>
          </div>
        ))}
      </div>
      <div className="bg-matcha-900 text-white p-3 flex items-center justify-between text-sm">
        <span>2 Artikel</span>
        <span className="font-display font-bold">12,70 €</span>
        <span className="rounded-full bg-accent text-matcha-900 px-3 py-1 text-xs font-bold">Zur Kasse →</span>
      </div>
      <style jsx>{`
        @keyframes item-in { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes pulse-once { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2); } }
        .animate-item-in { animation: item-in 0.5s both; }
        .animate-pulse-once { animation: pulse-once 0.4s ease-in-out both; }
      `}</style>
    </div>
  );
}

/* =========================
   4) Küche-Display (KDS)
   ========================= */
export function KitchenDemo() {
  const cols = [
    { label: 'Eingegangen', tone: 'gold', items: [{ n: '#2347', name: 'Lena', time: 2 }] },
    { label: 'In Zubereitung', tone: 'orange', items: [{ n: '#2346', name: 'Tom', time: 6 }] },
    { label: 'Fertig', tone: 'matcha', items: [{ n: '#2345', name: 'Sofia', time: 0 }] },
  ];
  return (
    <div className="rounded-2xl border bg-white shadow-soft overflow-hidden">
      <div className="bg-matcha-50 px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-matcha-900">
          <ChefHat size={14} /> Küche · Live
        </div>
        <div className="h-2 w-2 rounded-full bg-matcha-500 animate-ping" />
      </div>
      <div className="grid grid-cols-3 divide-x text-xs">
        {cols.map((c) => (
          <div key={c.label} className="p-2 space-y-1.5 min-h-[180px]">
            <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{c.label}</div>
            {c.items.map((it) => (
              <div
                key={it.n}
                className={cn(
                  'rounded-lg border-2 p-2 bg-white',
                  c.tone === 'gold' && 'border-gold bg-gold/10',
                  c.tone === 'orange' && 'border-orange-400 bg-orange-50',
                  c.tone === 'matcha' && 'border-matcha-500 bg-matcha-50',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-matcha-800 text-[10px]">{it.n}</span>
                  <span className={cn('text-[9px] font-bold', it.time > 5 && 'text-red-700 animate-pulse')}>
                    {it.time}′
                  </span>
                </div>
                <div className="font-bold text-[11px] mt-0.5">{it.name}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">2× Matcha · 1× Toast</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================
   5) Fahrer / Dispatch mit GPS-Animation
   ========================= */
export function DeliveryDemo() {
  return (
    <div className="rounded-2xl border bg-matcha-900 shadow-soft overflow-hidden relative">
      <div className="bg-matcha-800 px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <Truck size={14} /> Fahrer-Tracking
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-accent">LIVE</div>
      </div>
      <div className="relative h-52 overflow-hidden">
        {/* Karte */}
        <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full">
          <rect width="400" height="200" fill="#162920" />
          <g stroke="#263830" strokeWidth="10">
            <line x1="-10" y1="60"  x2="410" y2="70" />
            <line x1="-10" y1="130" x2="410" y2="140" />
            <line x1="120" y1="-10" x2="130" y2="210" />
            <line x1="280" y1="-10" x2="290" y2="210" />
          </g>
          <rect x="40" y="150" width="50" height="40" rx="4" fill="#14532d" opacity="0.5" />
          <rect x="300" y="15" width="60" height="35" rx="4" fill="#14532d" opacity="0.5" />
          {/* Restaurant */}
          <g transform="translate(80, 60)">
            <circle r="10" fill="#d4a843" />
            <text y="3" textAnchor="middle" fontSize="10">🍵</text>
          </g>
          {/* Kunde */}
          <g transform="translate(340, 150)">
            <circle r="10" fill="#4ae68a" />
            <text y="3" textAnchor="middle" fontSize="10">🏠</text>
          </g>
          {/* Route */}
          <path d="M 80 60 Q 200 100 340 150" stroke="#4ae68a" strokeWidth="3" fill="none" strokeDasharray="6 4" />
          {/* Fahrer — animiert entlang der Route */}
          <g>
            <circle r="15" fill="#4ae68a" opacity="0.2">
              <animate attributeName="r" values="12;20;12" dur="1.5s" repeatCount="indefinite" />
              <animateMotion dur="6s" repeatCount="indefinite" path="M 0 0 Q 120 40 260 90" />
            </circle>
            <circle r="7" fill="#4ae68a" stroke="#fff" strokeWidth="2">
              <animateMotion dur="6s" repeatCount="indefinite" path="M 80 60 Q 200 100 340 150" />
            </circle>
          </g>
        </svg>
        <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-white/10 backdrop-blur border border-white/20 p-2 text-white text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold">🛵 Mira · Aachen-Mitte</span>
            <span className="font-mono">0.8 km · 4 min</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   6) Kasse/Analytics
   ========================= */
export function AnalyticsDemo() {
  const days = [45, 62, 48, 71, 83, 95, 88];
  const max = Math.max(...days);
  return (
    <div className="rounded-2xl border bg-white shadow-soft overflow-hidden">
      <div className="bg-matcha-50 px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-matcha-900">
          <TrendingUp size={14} /> Umsatz · diese Woche
        </div>
        <div className="text-xs font-bold text-matcha-700">+23% vs. Vorwoche</div>
      </div>
      <div className="p-4 space-y-3">
        <div className="font-display text-3xl font-bold text-matcha-900">
          4 218 € <span className="text-sm font-medium text-muted-foreground">brutto</span>
        </div>
        <div className="flex items-end gap-1.5 h-28">
          {days.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-gradient-to-t from-matcha-700 to-accent rounded-t" style={{ height: `${(d / max) * 100}%`, animation: `bar-grow 1s ease-out ${i * 80}ms both` }} />
              <div className="text-[9px] text-muted-foreground">{['Mo','Di','Mi','Do','Fr','Sa','So'][i]}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 pt-2 border-t text-xs">
          <div><div className="text-muted-foreground">⌀ Bon</div><div className="font-display font-bold">14,20 €</div></div>
          <div><div className="text-muted-foreground">Bons</div><div className="font-display font-bold">297</div></div>
          <div><div className="text-muted-foreground">Food-Cost</div><div className="font-display font-bold">28,4%</div></div>
        </div>
      </div>
      <style jsx>{`@keyframes bar-grow { from { height: 0 !important; } }`}</style>
    </div>
  );
}

/* =========================
   7) Plattform-Integration
   ========================= */
export function PlatformsDemo() {
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPulse((x) => (x + 1) % 3), 1200);
    return () => clearInterval(id);
  }, []);

  const platforms = [
    { name: 'Lieferando', icon: '🧡', color: 'bg-orange-500' },
    { name: 'Uber Eats', icon: '🟩', color: 'bg-emerald-500' },
    { name: 'Wolt', icon: '💙', color: 'bg-blue-500' },
  ];
  return (
    <div className="rounded-2xl border bg-white shadow-soft overflow-hidden">
      <div className="bg-matcha-50 px-4 py-3 border-b flex items-center gap-2 text-sm font-bold text-matcha-900">
        🔌 Eingehende Orders
      </div>
      <div className="p-6 flex items-center justify-center gap-6">
        <div className="flex flex-col gap-3">
          {platforms.map((p, i) => (
            <div
              key={p.name}
              className={cn('flex items-center gap-2 rounded-xl bg-white border px-3 py-2 text-xs font-bold transition-all duration-500', i === pulse && 'scale-105 shadow-soft')}
            >
              <div className={cn('h-6 w-6 rounded-md flex items-center justify-center text-xs', p.color)}>{p.icon}</div>
              {p.name}
              {i === pulse && <div className="ml-1 h-2 w-2 rounded-full bg-matcha-500 animate-pulse" />}
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center gap-1">
          <svg width="60" height="30" viewBox="0 0 60 30">
            <path d="M 5 15 L 55 15" stroke="#14532d" strokeWidth="2" strokeDasharray="4 3" />
            <path d="M 50 10 L 58 15 L 50 20" stroke="#14532d" strokeWidth="2" fill="none" />
          </svg>
          <div className="text-[9px] text-muted-foreground">Webhook</div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-matcha-800 to-matcha-600 px-5 py-6 text-white shadow-soft">
          <div className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-70">FoodFlow</div>
          <div className="mt-1 font-display text-lg font-bold">Ein Cockpit</div>
          <div className="text-[10px] text-white/70 mt-1">Küche · Kasse · Fahrer · Analyse</div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   8) Reinigung & HACCP
   ========================= */
export function CleaningDemo() {
  const zones = [
    { name: 'Küche',        done: 100, color: 'bg-matcha-500' },
    { name: 'Gastraum',     done: 75,  color: 'bg-accent' },
    { name: 'Sanitär',      done: 50,  color: 'bg-gold' },
    { name: 'Lager',        done: 25,  color: 'bg-orange-400' },
  ];
  return (
    <div className="rounded-2xl border bg-white shadow-soft overflow-hidden">
      <div className="bg-matcha-50 px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-matcha-900">
          <Sparkles size={14} /> Reinigung · Tagesplan
        </div>
        <div className="text-[10px] font-bold text-matcha-700">HACCP · Foto-Pflicht</div>
      </div>
      <div className="p-4 space-y-2.5">
        {zones.map((z, i) => (
          <div key={z.name} className="flex items-center gap-3">
            <div className="w-20 text-xs font-semibold">{z.name}</div>
            <div className="flex-1 h-7 bg-muted rounded-full overflow-hidden relative">
              <div
                className={cn('h-full transition-all rounded-full flex items-center pr-2 justify-end', z.color)}
                style={{ width: `${z.done}%`, animation: `grow 1.2s ease-out ${i * 120}ms both` }}
              >
                {z.done > 20 && <span className="text-[10px] font-bold text-white">{z.done}%</span>}
              </div>
              {z.done === 100 && (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-matcha-900 text-white flex items-center justify-center">
                  <Check size={12} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-2.5 bg-matcha-50 border-t text-xs text-matcha-700 flex items-center gap-2">
        <Camera size={12} />
        <span>12 Fotos dokumentiert · letzter Check vor 4 Min</span>
      </div>
      <style jsx>{`@keyframes grow { from { width: 0; } }`}</style>
    </div>
  );
}

/* =========================
   9) Check-ups / Foto-Kontrolle
   ========================= */
export function CheckupDemo() {
  const items = [
    { name: 'Kühlschrank-Temp. unter 5°C', done: true },
    { name: 'Handseife in allen Spülen',    done: true },
    { name: 'Menü-Vitrine sauber',            done: true },
    { name: 'Bar-Theke gewischt',             done: false },
    { name: 'Mülleimer geleert',              done: false },
  ];
  return (
    <div className="rounded-2xl border bg-white shadow-soft overflow-hidden">
      <div className="bg-matcha-900 px-4 py-3 flex items-center justify-between text-white">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Camera size={14} /> Morgen-Check
        </div>
        <div className="text-[10px] font-bold text-accent">3 / 5 erledigt</div>
      </div>
      <div className="p-3 space-y-1.5">
        {items.map((it, i) => (
          <div
            key={i}
            className={cn('flex items-center gap-3 rounded-xl border px-3 py-2 text-sm animate-fade-up',
              it.done ? 'bg-matcha-50 border-matcha-200' : 'bg-white',
            )}
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className={cn('h-6 w-6 rounded-full flex items-center justify-center shrink-0',
              it.done ? 'bg-matcha-500 text-white' : 'border-2 border-border bg-white',
            )}>
              {it.done && <Check size={14} />}
            </div>
            <span className={cn('flex-1', it.done && 'line-through text-muted-foreground')}>{it.name}</span>
            {it.done && (
              <div className="h-8 w-8 rounded-lg bg-matcha-100 flex items-center justify-center">
                <Camera size={12} className="text-matcha-700" />
              </div>
            )}
          </div>
        ))}
      </div>
      <style jsx>{`
        @keyframes fade-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-up { animation: fade-up 0.4s both; }
      `}</style>
    </div>
  );
}

/* =========================
   10) Training / Lernkarten
   ========================= */
export function TrainingDemo() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % 3), 2500);
    return () => clearInterval(id);
  }, []);

  const screens = [
    {
      kind: 'question',
      title: 'Allergen-Quiz: Welches Produkt enthält Gluten?',
      options: ['Espresso', 'Haferkeks', 'Bananen'],
      correct: 1,
    },
    {
      kind: 'correct',
      title: 'Richtig!',
      explain: 'Hafer enthält Avenin — bei EU-Kennzeichnung zählt das als Gluten-Quelle.',
    },
    {
      kind: 'progress',
      title: 'Barista-Basics',
      progress: 70,
      modules: 7,
      done: 5,
    },
  ];

  const s = screens[step];

  return (
    <div className="rounded-2xl border bg-white shadow-soft overflow-hidden">
      <div className="bg-matcha-50 px-4 py-3 border-b flex items-center gap-2 text-sm font-bold text-matcha-900">
        <BookOpen size={14} /> Training · Onboarding
      </div>
      <div className="p-6 min-h-[240px] flex flex-col justify-center">
        {s.kind === 'question' && (
          <div className="animate-fade-in">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Frage 3 von 8</div>
            <div className="mt-2 font-display text-xl font-bold">{s.title}</div>
            <div className="mt-4 space-y-2">
              {s.options!.map((o, i) => (
                <div key={i} className="rounded-xl border px-4 py-3 text-sm hover:bg-muted/40 cursor-pointer">
                  <span className="font-mono text-xs text-muted-foreground mr-2">{String.fromCharCode(65 + i)}</span>
                  {o}
                </div>
              ))}
            </div>
          </div>
        )}
        {s.kind === 'correct' && (
          <div className="animate-fade-in text-center">
            <div className="h-16 w-16 mx-auto rounded-full bg-matcha-500 text-white flex items-center justify-center mb-4">
              <Check size={28} />
            </div>
            <div className="font-display text-2xl font-bold">{s.title}</div>
            <p className="mt-2 text-sm text-muted-foreground">{s.explain}</p>
            <div className="mt-4 inline-flex items-center gap-1 bg-gold/20 text-matcha-900 rounded-full px-3 py-1 text-xs font-bold">
              <Star size={10} className="fill-gold text-gold" /> +10 Punkte
            </div>
          </div>
        )}
        {s.kind === 'progress' && (
          <div className="animate-fade-in">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dein Fortschritt</div>
            <div className="font-display text-xl font-bold mt-1">{s.title}</div>
            <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-matcha-700 to-accent rounded-full" style={{ width: `${s.progress}%`, animation: 'grow 1s ease-out' }} />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>{s.done} von {s.modules} Modulen</span>
              <span>{s.progress}%</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {['Hygiene', 'Allergene', 'Maschinen'].map((b) => (
                <div key={b} className="inline-flex items-center gap-1 bg-accent/20 text-matcha-900 rounded-full px-2.5 py-1 text-[10px] font-bold">
                  <Check size={10} /> {b}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <style jsx>{`
        @keyframes fade-in { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fade-in 0.4s ease-out; }
        @keyframes grow { from { width: 0; } }
      `}</style>
    </div>
  );
}

/* =========================
   11) Kasse / POS
   ========================= */
export function PosDemo() {
  return (
    <div className="rounded-2xl border bg-matcha-900 shadow-soft overflow-hidden">
      <div className="bg-matcha-800 px-4 py-3 border-b border-white/10 flex items-center justify-between text-white">
        <div className="flex items-center gap-2 text-sm font-bold">
          💰 Kasse · Matcha-Theke
        </div>
        <div className="text-[10px] font-bold text-accent">Bon #0247</div>
      </div>
      <div className="grid grid-cols-[1fr_auto] divide-x divide-white/10">
        {/* Produkt-Grid */}
        <div className="p-3 grid grid-cols-3 gap-2">
          {[
            { name: 'Matcha Latte', price: '4,80', beliebt: true },
            { name: 'Iced Matcha',  price: '4,50' },
            { name: 'Espresso',     price: '2,80' },
            { name: 'Cheesecake',   price: '4,80', active: true },
            { name: 'Bowl',         price: '8,50' },
            { name: 'Toast',        price: '7,90' },
          ].map((p, i) => (
            <div
              key={i}
              className={cn(
                'rounded-xl border p-2.5 text-left transition relative',
                p.active ? 'bg-accent/20 border-accent ring-2 ring-accent' : 'bg-white/5 border-white/10 hover:bg-white/10',
              )}
            >
              <div className="text-white font-semibold text-[11px] leading-tight">{p.name}</div>
              <div className="mt-1 text-accent font-bold text-sm">{p.price} €</div>
              {p.beliebt && <Star size={10} className="absolute top-1.5 right-1.5 fill-gold text-gold" />}
              {p.active && (
                <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-accent text-matcha-900 flex items-center justify-center text-[10px] font-bold">
                  1
                </div>
              )}
            </div>
          ))}
        </div>
        {/* Bon-Preview */}
        <div className="w-36 bg-matcha-950 p-3 text-white text-[10px] space-y-1.5">
          <div className="text-[9px] uppercase tracking-wider text-matcha-400">Aktueller Bon</div>
          <div className="border-b border-white/10 pb-1.5">
            <div className="flex justify-between"><span>1× Matcha</span><span>4,80</span></div>
            <div className="flex justify-between"><span>1× Cheesecake</span><span>4,80</span></div>
          </div>
          <div className="flex justify-between font-bold text-sm pt-1">
            <span>GESAMT</span>
            <span className="text-accent">9,60 €</span>
          </div>
          <div className="pt-2 space-y-1">
            <div className="rounded-md bg-accent text-matcha-900 text-center py-1 font-bold">Bar</div>
            <div className="rounded-md bg-white/10 text-center py-1">Karte</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   12) Dokumente & Benachrichtigungen
   ========================= */
export function NotificationsDemo() {
  const notifs = [
    { icon: '⚠️', title: 'Gesundheitszeugnis läuft ab',   sub: 'Tom · in 14 Tagen',     tone: 'red' },
    { icon: '✓',  title: 'Kassenabschluss eingereicht',  sub: 'Nina · vor 5 Min',       tone: 'green' },
    { icon: '🎉', title: 'Schulung abgeschlossen',        sub: 'Mira · Allergen-Basics', tone: 'matcha' },
    { icon: '📦', title: 'Bestellung bei Lieferant',       sub: 'Hafermilch · morgen',    tone: 'blue' },
  ];
  return (
    <div className="rounded-2xl border bg-white shadow-soft overflow-hidden">
      <div className="bg-matcha-50 px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-matcha-900">
          <Bell size={14} /> Aktivität
        </div>
        <div className="h-2 w-2 rounded-full bg-matcha-500 animate-ping" />
      </div>
      <div className="divide-y">
        {notifs.map((n, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 animate-slide-in hover:bg-muted/30 transition"
            style={{ animationDelay: `${i * 150}ms` }}
          >
            <div className={cn(
              'h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-lg',
              n.tone === 'red' && 'bg-red-50',
              n.tone === 'green' && 'bg-matcha-50',
              n.tone === 'matcha' && 'bg-accent/20',
              n.tone === 'blue' && 'bg-blue-50',
            )}>
              {n.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{n.title}</div>
              <div className="text-xs text-muted-foreground">{n.sub}</div>
            </div>
          </div>
        ))}
      </div>
      <style jsx>{`
        @keyframes slide-in { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
        .animate-slide-in { animation: slide-in 0.5s ease-out both; }
      `}</style>
    </div>
  );
}
