'use client';

import { useMemo, useState } from 'react';
import { TrendingUp, Euro, Calendar, Sparkles } from 'lucide-react';

type Input = {
  key: string;
  label: string;
  suffix?: string;
  min: number;
  max: number;
  step: number;
  default: number;
};

type Calc = (inputs: Record<string, number>) => {
  monthly: number;              // € Ersparnis pro Monat
  yearly: number;               // € Ersparnis pro Jahr
  highlights: { icon?: string; label: string; value: string }[];
};

type Preset = {
  title: string;
  subtitle: string;
  inputs: Input[];
  calc: Calc;
  disclaimer?: string;
};

// Module-spezifische ROI-Presets
const PRESETS: Record<string, Preset> = {
  lieferung: {
    title: 'Rechne deine Ersparnis',
    subtitle: 'Eigene Fahrer statt Lieferando/Uber Eats + Routen-Optimierung',
    inputs: [
      { key: 'orders',   label: 'Bestellungen pro Tag',      min: 10,  max: 300, step: 5,  default: 60 },
      { key: 'avg',      label: 'Ø Bestellwert',  suffix:'€', min: 10,  max: 80,  step: 1,  default: 25 },
      { key: 'platformPct', label: 'Plattform-Gebühr jetzt', suffix:'%', min: 0, max: 30, step: 1, default: 14 },
    ],
    calc: ({ orders, avg, platformPct }) => {
      const dailyRev = orders * avg;
      const monthlyRev = dailyRev * 30;
      const savedPlatform = monthlyRev * (platformPct / 100);        // gespart an Plattform-Fee
      const miseFee = dailyRev * 30 * 0.02;                           // 2% Mise-Fee auf Online-Zahlungen
      const routeSave = orders * 0.35 * 0.25 * 30;                    // 35% Orders gebündelt, 0.25€ Sprit/km × 30 Tage (vereinfacht)
      const monthly = Math.round(savedPlatform - miseFee + routeSave);
      return {
        monthly,
        yearly: monthly * 12,
        highlights: [
          { icon: '💰', label: 'Gespart an Plattform-Gebühren', value: `${Math.round(savedPlatform)} €/Monat` },
          { icon: '⛽', label: 'Sprit & Zeit durch Routen-Opt',  value: `${Math.round(routeSave)} €/Monat` },
          { icon: '📉', label: 'Mise-Fee (2 % auf online)',      value: `– ${Math.round(miseFee)} €/Monat` },
        ],
      };
    },
    disclaimer: 'Annahme: 35 % deiner Orders werden clusterbar, Ø Umweg gespart 2 km, Sprit 0,25 €/km.',
  },
  bestellseite: {
    title: 'Was kostet dich die Lieferando-Provision?',
    subtitle: 'Deine eigene Online-Seite statt 14 % Plattform-Fee',
    inputs: [
      { key: 'orders', label: 'Online-Orders / Monat',    min: 50,  max: 3000, step: 10, default: 600 },
      { key: 'avg',    label: 'Ø Bestellwert', suffix:'€', min: 10,  max: 80,   step: 1,  default: 28 },
      { key: 'platformPct', label: 'Platform-Gebühr jetzt', suffix:'%', min: 5, max: 30, step: 1, default: 14 },
    ],
    calc: ({ orders, avg, platformPct }) => {
      const monthlyRev = orders * avg;
      const savedPlatform = monthlyRev * (platformPct / 100);
      const miseFee = monthlyRev * 0.02;
      const monthly = Math.round(savedPlatform - miseFee);
      return {
        monthly,
        yearly: monthly * 12,
        highlights: [
          { icon: '🎯', label: `Gespart an ${platformPct}% Platform-Fee`, value: `${Math.round(savedPlatform)} €/Monat` },
          { icon: '📉', label: 'Mise-Fee (2 % auf online)',              value: `– ${Math.round(miseFee)} €/Monat` },
          { icon: '📊', label: 'Dein Online-Umsatz',                     value: `${Math.round(monthlyRev)} €/Monat` },
        ],
      };
    },
  },
  kasse: {
    title: 'Wie viel spart dir eine moderne Kasse?',
    subtitle: 'Schnellere Bedienung + keine TSE-Strafen + weniger Fehler',
    inputs: [
      { key: 'tables',  label: 'Plätze / Sitze',         min: 10, max: 200, step: 5, default: 40 },
      { key: 'daily',   label: 'Ø Transaktionen / Tag', min: 30, max: 500, step: 10, default: 120 },
      { key: 'oldFee',  label: 'Alte Kassensystem-Kosten', suffix:'€/Mo.', min: 0, max: 500, step: 10, default: 120 },
    ],
    calc: ({ daily, oldFee }) => {
      const timeSaved = daily * 0.4 / 60 * 15 * 22;      // 24s gespart/Trans × 22 Werktage × 15€/h
      const softwareSaved = oldFee;                       // alte Software fällt weg (wir sind im Paket)
      const errorsSaved = daily * 30 * 0.005 * 18;        // 0.5% Falscheingaben à 18€ Ø
      const monthly = Math.round(timeSaved + softwareSaved + errorsSaved);
      return {
        monthly,
        yearly: monthly * 12,
        highlights: [
          { icon: '⚡', label: 'Schnellere Kasse = Personalzeit',  value: `${Math.round(timeSaved)} €/Monat` },
          { icon: '💸', label: 'Alte Kassensoftware ersetzt',     value: `${Math.round(softwareSaved)} €/Monat` },
          { icon: '🧮', label: 'Weniger Falscheingaben',          value: `${Math.round(errorsSaved)} €/Monat` },
        ],
      };
    },
    disclaimer: 'Annahme: 24 Sek. gespart pro Transaktion × 15 €/h Personalkosten × 22 Werktage.',
  },
  dienstplan: {
    title: 'Was sparen dir optimierte Schichten?',
    subtitle: 'Automatischer Dienstplan statt Excel-Chaos',
    inputs: [
      { key: 'employees', label: 'Mitarbeiter',       min: 3,  max: 50, step: 1, default: 12 },
      { key: 'adminHrs',  label: 'Std/Woche fürs Planen heute', min: 1, max: 20, step: 1, default: 6 },
      { key: 'wage',      label: 'Ø Stundenlohn Manager', suffix:'€', min: 14, max: 40, step: 1, default: 22 },
    ],
    calc: ({ employees, adminHrs, wage }) => {
      const planTime = adminHrs * wage * 4.3;               // 4.3 Wochen/Monat, 90% Zeitersparnis
      const planSaved = planTime * 0.9;
      const overstaffSaved = employees * 12 * 4;            // Ø 12€/Monat/MA durch bessere Besetzung
      const monthly = Math.round(planSaved + overstaffSaved);
      return {
        monthly,
        yearly: monthly * 12,
        highlights: [
          { icon: '🗓️', label: '90 % weniger Zeit für Planung', value: `${Math.round(planSaved)} €/Monat` },
          { icon: '👥', label: 'Weniger Überstunden/Fehlplanung', value: `${Math.round(overstaffSaved)} €/Monat` },
        ],
      };
    },
  },
  kueche: {
    title: 'Was bringt ein Küchen-Display?',
    subtitle: 'Tickets statt Bon-Drucker. Perfekte Taktung.',
    inputs: [
      { key: 'orders',  label: 'Gerichte / Tag',           min: 50,  max: 600, step: 10, default: 150 },
      { key: 'returns', label: 'Beschwerden / Woche heute', min: 0,   max: 30,  step: 1,  default: 5 },
    ],
    calc: ({ orders, returns }) => {
      const timeSaved = orders * 0.5 / 60 * 15 * 30;        // 30s pro Ticket eingespart × 15€/h
      const wasteSaved = (returns / 7) * 30 * 8;             // Retour kostet ~8€ (Essen + Ärger)
      const monthly = Math.round(timeSaved * 0.5 + wasteSaved);
      return {
        monthly,
        yearly: monthly * 12,
        highlights: [
          { icon: '⏱️', label: 'Durchlaufzeit ↓ pro Ticket',     value: `${Math.round(timeSaved * 0.5)} €/Monat` },
          { icon: '🗑️', label: 'Weniger Beschwerden/Abfall',    value: `${Math.round(wasteSaved)} €/Monat` },
        ],
      };
    },
  },
  lager: {
    title: 'Was lässt Lager-Kontrolle dir im Geldbeutel?',
    subtitle: 'Auto-Bestellung + Verfallsdatum-Alerts',
    inputs: [
      { key: 'wareRev',  label: 'Wareneinsatz / Monat', suffix:'€', min: 1000, max: 30000, step: 500, default: 8000 },
      { key: 'wastePct', label: 'Schwund / Verlust heute', suffix:'%', min: 0, max: 20, step: 1, default: 8 },
    ],
    calc: ({ wareRev, wastePct }) => {
      const current = wareRev * (wastePct / 100);
      const target = wareRev * 0.02;     // auf 2% runter
      const monthly = Math.round(Math.max(0, current - target));
      return {
        monthly,
        yearly: monthly * 12,
        highlights: [
          { icon: '📦', label: 'Aktueller Schwund',        value: `${Math.round(current)} €/Monat` },
          { icon: '🎯', label: 'Mit Mise realistisch',     value: `${Math.round(target)} €/Monat` },
          { icon: '🟢', label: 'Ersparnis',                value: `${monthly} €/Monat` },
        ],
      };
    },
  },
  plattformen: {
    title: 'Lieferando, Wolt, Uber Eats — alles in einer Kasse',
    subtitle: 'Keine doppelten Tablets mehr. Weniger Fehler.',
    inputs: [
      { key: 'platforms', label: 'Aktive Plattformen',       min: 1,  max: 5,   step: 1,  default: 3 },
      { key: 'orders',    label: 'Plattform-Orders / Tag',   min: 5,  max: 200, step: 5,  default: 40 },
    ],
    calc: ({ platforms, orders }) => {
      const timeSave = orders * 0.75 / 60 * 15 * 30;        // 45s pro Order (Tablet → Kasse)
      const errorSave = orders * 30 * 0.02 * 20;             // 2% Übertrag-Fehler × 20€
      const monthly = Math.round(timeSave + errorSave);
      return {
        monthly,
        yearly: monthly * 12,
        highlights: [
          { icon: '📱', label: `${platforms} Tablets → 1 Kasse`, value: `${Math.round(timeSave)} €/Monat Zeit` },
          { icon: '✅', label: 'Weniger Übertrag-Fehler',         value: `${Math.round(errorSave)} €/Monat` },
        ],
      };
    },
  },
  analytics: {
    title: 'Welche Zahlen siehst du heute nicht?',
    subtitle: 'Live-Dashboards + Top-Seller + Stoßzeiten',
    inputs: [
      { key: 'rev',    label: 'Monats-Umsatz', suffix:'€',       min: 5000, max: 200000, step: 1000, default: 35000 },
    ],
    calc: ({ rev }) => {
      const uplift = Math.round(rev * 0.04);    // 4% Uplift durch datenbasierte Entscheidungen
      return {
        monthly: uplift,
        yearly: uplift * 12,
        highlights: [
          { icon: '📈', label: 'Konservativer 4 % Uplift',     value: `${uplift} €/Monat` },
          { icon: '🎯', label: 'Durch Top-Seller-Promo',        value: 'inklusive' },
          { icon: '⏰', label: 'Durch Stoßzeit-Staffing',       value: 'inklusive' },
        ],
      };
    },
    disclaimer: 'Studien (POS Nation, Toast 2024) zeigen 3-6 % Uplift durch datenbasierte Menü-Optimierung.',
  },
};

function fmt(n: number) {
  return n.toLocaleString('de-DE', { maximumFractionDigits: 0 });
}

export function RoiCalculator({ slug }: { slug: string }) {
  const preset = PRESETS[slug];
  const [values, setValues] = useState<Record<string, number>>(
    () => {
      if (!preset) return {};
      const v: Record<string, number> = {};
      preset.inputs.forEach((i) => { v[i.key] = i.default; });
      return v;
    },
  );

  const result = useMemo(() => preset?.calc(values), [preset, values]);

  if (!preset || !result) return null;

  return (
    <section className="py-20 bg-white">
      <div className="container max-w-5xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/20 text-matcha-900 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] mb-4">
            <TrendingUp className="h-3 w-3" />
            ROI · Live-Rechner
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.02em]">
            {preset.title}
          </h2>
          <p className="mt-3 text-matcha-900/70 max-w-2xl mx-auto">{preset.subtitle}</p>
        </div>

        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-8">
          {/* Inputs */}
          <div className="space-y-6 p-6 md:p-8 rounded-3xl border-2 border-matcha-900/10 bg-matcha-50/50">
            {preset.inputs.map((inp) => (
              <div key={inp.key}>
                <div className="flex items-baseline justify-between mb-2">
                  <label className="text-sm font-semibold">{inp.label}</label>
                  <span className="font-display text-2xl font-bold text-matcha-900">
                    {fmt(values[inp.key])}{inp.suffix ?? ''}
                  </span>
                </div>
                <input
                  type="range"
                  min={inp.min}
                  max={inp.max}
                  step={inp.step}
                  value={values[inp.key]}
                  onChange={(e) => setValues((v) => ({ ...v, [inp.key]: Number(e.target.value) }))}
                  className="w-full accent-accent h-2 rounded-full"
                />
                <div className="flex justify-between text-[10px] text-matcha-900/50 mt-1">
                  <span>{inp.min}{inp.suffix ?? ''}</span>
                  <span>{inp.max}{inp.suffix ?? ''}</span>
                </div>
              </div>
            ))}
            {preset.disclaimer && (
              <div className="text-[11px] text-matcha-900/60 leading-relaxed border-t pt-3">
                {preset.disclaimer}
              </div>
            )}
          </div>

          {/* Output */}
          <div className="relative p-6 md:p-8 rounded-3xl bg-matcha-900 text-white overflow-hidden">
            <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-accent/20 blur-2xl" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-accent text-xs font-bold uppercase tracking-wider mb-4">
                <Sparkles className="h-3 w-3" />
                Deine Ersparnis
              </div>

              <div className="font-display text-5xl md:text-6xl font-black tracking-[-0.02em] leading-none">
                <AnimatedEuro value={result.monthly} />
              </div>
              <div className="mt-1 text-matcha-300 text-sm">pro Monat</div>

              <div className="mt-6 pt-6 border-t border-white/10">
                <div className="flex items-baseline gap-3">
                  <Calendar className="h-4 w-4 text-matcha-300" />
                  <span className="text-matcha-300 text-sm">im Jahr:</span>
                  <span className="font-display text-2xl font-bold text-accent">
                    <AnimatedEuro value={result.yearly} />
                  </span>
                </div>
              </div>

              <div className="mt-8 space-y-3">
                {result.highlights.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="text-xl">{h.icon}</span>
                    <span className="flex-1 text-matcha-100">{h.label}</span>
                    <span className="font-bold text-white">{h.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AnimatedEuro({ value }: { value: number }) {
  return (
    <span className="inline-flex items-baseline gap-1 transition-all">
      <span className="tabular-nums">{fmt(value)}</span>
      <Euro className="h-[0.7em] w-[0.7em]" />
    </span>
  );
}
