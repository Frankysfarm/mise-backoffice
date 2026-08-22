'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, Check, Layers, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Preset } from '@/lib/setup-presets';
import { PRESET_CATEGORIES } from '@/lib/setup-presets';

// 12 einzelne Module — der User kann sie frei kombinieren
type ModuleCard = {
  id: string;
  icon: string;
  name: string;
  short: string;
  category: 'verkauf' | 'team' | 'betrieb' | 'finanzen' | 'admin';
};

const MODULES: ModuleCard[] = [
  { id: 'ordering',      icon: '🛒',  name: 'Bestellsystem',        short: 'Eigener Shop, QR-Bestellung, Checkout',       category: 'verkauf' },
  { id: 'delivery',      icon: '🛵',  name: 'Fahrer & Lieferung',   short: 'Fahrer-App, GPS-Live, Route-Optimierung',      category: 'verkauf' },
  { id: 'kitchen',       icon: '👨‍🍳', name: 'Küchen-Monitor',       short: 'Live-Tickets, Timer, Allergen-Warnung',       category: 'betrieb' },
  { id: 'cash',          icon: '💰',  name: 'Kasse (POS)',          short: 'Touch-Terminal, Z-Bericht, TSE-ready',         category: 'finanzen' },
  { id: 'operations',    icon: '📅',  name: 'Dienstplan & Team',    short: 'Drag-Drop, ArbZG, Schichttausch',              category: 'team' },
  { id: 'inventory',     icon: '📦',  name: 'Lagerverwaltung',      short: 'Inventur, FIFO, Auto-Reorder',                 category: 'betrieb' },
  { id: 'training',      icon: '🎓',  name: 'Training & Schulung',  short: 'Lernkarten, Quiz, AI-Generator',               category: 'team' },
  { id: 'cleaning',      icon: '✨',  name: 'Reinigung & HACCP',    short: '6 Zonen, Foto-Pflicht, HACCP-PDF',             category: 'betrieb' },
  { id: 'checkups',      icon: '📋',  name: 'Check-ups',            short: 'Tägliche Foto-Kontrollen',                     category: 'betrieb' },
  { id: 'analytics',     icon: '📊',  name: 'Analytics & Reports',  short: 'Umsatz, Top-Seller, Food-Cost',                category: 'finanzen' },
  { id: 'documents',     icon: '📄',  name: 'Dokumente & Verträge', short: 'Ablauf-Ampel, Zeugnisse, Kategorien',          category: 'admin' },
  { id: 'notifications', icon: '🔔',  name: 'Benachrichtigungen',   short: 'Push, Regeln, Team-Chat',                      category: 'admin' },
];

const MODULE_CATS = [
  { id: 'verkauf',  label: '💰 Verkauf & Lieferung' },
  { id: 'team',     label: '👥 Team' },
  { id: 'betrieb',  label: '⚙️ Betrieb' },
  { id: 'finanzen', label: '🧾 Finanzen' },
  { id: 'admin',    label: '🛠 Admin' },
];

type Tab = 'pakete' | 'einzeln';

export function UseCasePicker({ presets }: { presets: Preset[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('pakete');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());

  function choosePreset(id: string) {
    setSelectedPreset(id);
    setSelectedModules(new Set());
  }

  function toggleModule(id: string) {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectedPreset(null);
  }

  function proceed() {
    if (tab === 'pakete' && selectedPreset) {
      router.push(`/start?preset=${selectedPreset}`);
    } else if (tab === 'einzeln' && selectedModules.size > 0) {
      const modulesParam = Array.from(selectedModules).join(',');
      router.push(`/start?modules=${modulesParam}`);
    }
  }

  const canProceed =
    (tab === 'pakete' && !!selectedPreset) ||
    (tab === 'einzeln' && selectedModules.size > 0);

  return (
    <>
      {/* Tab-Switcher */}
      <div className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/10 p-1 mb-8">
        <TabBtn active={tab === 'pakete'} onClick={() => setTab('pakete')} icon={<Layers size={14} />}>
          Pakete · fertig geschnürt
        </TabBtn>
        <TabBtn active={tab === 'einzeln'} onClick={() => setTab('einzeln')} icon={<Package size={14} />}>
          Einzel-Module selbst wählen
        </TabBtn>
      </div>

      {/* PAKETE */}
      {tab === 'pakete' && (
        <div className="space-y-10">
          {PRESET_CATEGORIES.map((cat) => {
            const catPresets = cat.ids
              .map((id) => presets.find((p) => p.id === id))
              .filter((x): x is Preset => !!x);
            if (catPresets.length === 0) return null;

            return (
              <section key={cat.id}>
                <div className="mb-4 px-1">
                  <h2 className="font-display text-xl font-bold text-white">{cat.label}</h2>
                  <p className="text-xs text-matcha-300 mt-0.5">{cat.desc}</p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {catPresets.map((p) => (
                    <PresetCard
                      key={p.id}
                      preset={p}
                      active={selectedPreset === p.id}
                      onChoose={() => choosePreset(p.id)}
                      onDoubleClick={() => router.push(`/start?preset=${p.id}`)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* EINZEL-MODULE */}
      {tab === 'einzeln' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-sm text-matcha-100">
            <strong className="text-white">Dein eigenes Paket bauen:</strong> Wähle genau die Module die du testen willst.
            Alle gewählten Module bekommen 14 Tage Trial, später kannst du einzelne abschalten.
          </div>

          {MODULE_CATS.map((cat) => {
            const catMods = MODULES.filter((m) => m.category === cat.id);
            if (catMods.length === 0) return null;
            return (
              <section key={cat.id}>
                <h3 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-matcha-200 mb-2 px-1">
                  {cat.label}
                </h3>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {catMods.map((m) => (
                    <ModuleToggle
                      key={m.id}
                      module={m}
                      active={selectedModules.has(m.id)}
                      onToggle={() => toggleModule(m.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Sticky CTA */}
      {canProceed && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={proceed}
            className="group inline-flex items-center gap-3 rounded-full bg-accent text-matcha-900 px-8 py-4 font-display text-base font-bold shadow-strong hover:bg-accent/90 transition"
          >
            {tab === 'pakete'
              ? 'Weiter zum Signup'
              : `Mit ${selectedModules.size} ${selectedModules.size === 1 ? 'Modul' : 'Modulen'} starten`}
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      )}

      <div className="mt-12 text-center text-sm text-matcha-300">
        Noch unsicher? <a href="/welcome" className="underline hover:text-white">Alle Module im Detail →</a>
      </div>
    </>
  );
}

function TabBtn({
  active, onClick, icon, children,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition',
        active ? 'bg-accent text-matcha-900' : 'text-matcha-100 hover:bg-white/5',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function PresetCard({
  preset: p, active, onChoose, onDoubleClick,
}: {
  preset: Preset;
  active: boolean;
  onChoose: () => void;
  onDoubleClick: () => void;
}) {
  return (
    <button
      onClick={onChoose}
      onDoubleClick={onDoubleClick}
      className={cn(
        'group text-left rounded-2xl border bg-white/5 backdrop-blur border-white/10 p-5 transition text-white',
        active ? 'border-accent ring-2 ring-accent/30 bg-white/10 shadow-strong' : 'hover:bg-white/10 hover:border-white/20',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="text-3xl shrink-0">{p.icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-lg font-bold leading-tight">{p.name}</h3>
          <p className="text-sm text-matcha-100 mt-1.5">{p.tagline}</p>
          <p className="text-xs text-matcha-200 mt-2.5 leading-relaxed line-clamp-3">{p.description}</p>

          <div className="mt-3 flex flex-wrap gap-1">
            {p.modules.slice(0, 5).map((m) => (
              <span
                key={m}
                className="text-[10px] font-bold uppercase tracking-wider text-accent bg-accent/10 border border-accent/20 rounded px-1.5 py-0.5"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
        <span className="text-matcha-200">{p.steps.length} Schritte · ~{Math.max(10, p.steps.length * 3)} Min.</span>
        <span className={cn(
          'inline-flex items-center gap-1 font-bold transition',
          active ? 'text-accent' : 'text-matcha-300 group-hover:text-matcha-100',
        )}>
          {active ? <><Check size={12} /> Ausgewählt</> : <>Auswählen →</>}
        </span>
      </div>
    </button>
  );
}

function ModuleToggle({
  module: m, active, onToggle,
}: {
  module: ModuleCard;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'relative flex items-start gap-3 rounded-xl border bg-white/5 border-white/10 p-3.5 text-left text-white transition',
        active ? 'border-accent bg-accent/10 ring-2 ring-accent/30' : 'hover:bg-white/10',
      )}
    >
      {/* Checkbox */}
      <div className={cn(
        'h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition',
        active ? 'border-accent bg-accent' : 'border-white/30',
      )}>
        {active && <Check size={12} className="text-matcha-900" />}
      </div>

      <div className="text-2xl shrink-0">{m.icon}</div>

      <div className="flex-1 min-w-0">
        <div className="font-display font-bold text-sm leading-tight">{m.name}</div>
        <div className="text-[11px] text-matcha-200 mt-0.5 leading-snug">{m.short}</div>
      </div>
    </button>
  );
}
