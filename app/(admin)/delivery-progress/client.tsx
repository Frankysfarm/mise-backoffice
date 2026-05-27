'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type Phase = {
  id: number;
  name: string;
  agent: 'backend' | 'frontend' | 'ceo';
  description: string;
  features: Feature[];
  estimatedDays: string;
};

type Feature = {
  name: string;
  status: 'done' | 'in-progress' | 'todo' | 'bug';
  path?: string;
};

type AgentRun = {
  agent: string;
  time: string;
  commits: number;
  status: 'success' | 'failed' | 'running';
};

const PHASES: Phase[] = [
  {
    id: 1,
    name: 'Datenmodell',
    agent: 'backend',
    description: 'Supabase SQL Migrations — Tabellen für Zonen, Touren, Stops, Scores, Kitchen-Timings',
    estimatedDays: '1–2 Tage',
    features: [
      { name: 'delivery_zones Tabelle', status: 'todo', path: 'scripts/migrations/' },
      { name: 'delivery_tours Tabelle', status: 'todo', path: 'scripts/migrations/' },
      { name: 'tour_stops Tabelle', status: 'todo', path: 'scripts/migrations/' },
      { name: 'dispatch_scores Tabelle', status: 'todo', path: 'scripts/migrations/' },
      { name: 'kitchen_timings Tabelle', status: 'todo', path: 'scripts/migrations/' },
      { name: 'customer_orders erweitern (tour_id, zone, dispatch_score)', status: 'todo' },
      { name: 'drivers erweitern (lat, lng, status, capacity)', status: 'todo' },
    ],
  },
  {
    id: 2,
    name: 'Dispatch Engine',
    agent: 'backend',
    description: 'Kern-Algorithmus — Scoring, Bündelung, Zonen, ETA, Küchen-Sync, Tour-Optimierung',
    estimatedDays: '2–3 Tage',
    features: [
      { name: 'dispatch-engine.ts — Kern-Algorithmus', status: 'todo', path: 'lib/delivery/' },
      { name: 'scoring.ts — 10-Faktoren Score', status: 'todo', path: 'lib/delivery/' },
      { name: 'bundling.ts — Auto-Touren-Bündelung', status: 'todo', path: 'lib/delivery/' },
      { name: 'zones.ts — Zone A/B/C/D Berechnung', status: 'todo', path: 'lib/delivery/' },
      { name: 'eta.ts — Dynamische ETA', status: 'todo', path: 'lib/delivery/' },
      { name: 'kitchen-sync.ts — Küchen-Timing', status: 'todo', path: 'lib/delivery/' },
      { name: 'tour-optimizer.ts — Routen-Optimierung', status: 'todo', path: 'lib/delivery/' },
    ],
  },
  {
    id: 3,
    name: 'API-Routes',
    agent: 'backend',
    description: 'REST-Endpoints für Dispatch, Touren, Zonen, ETA, Küche, Stats',
    estimatedDays: '2–3 Tage',
    features: [
      { name: 'POST /api/delivery/dispatch', status: 'todo', path: 'app/api/delivery/' },
      { name: 'GET /api/delivery/tours', status: 'todo', path: 'app/api/delivery/' },
      { name: 'POST /api/delivery/tours/[id]/optimize', status: 'todo', path: 'app/api/delivery/' },
      { name: 'PATCH /api/delivery/tours/[id]/status', status: 'todo', path: 'app/api/delivery/' },
      { name: 'GET+POST /api/delivery/zones', status: 'todo', path: 'app/api/delivery/' },
      { name: 'GET /api/delivery/eta/[orderId]', status: 'todo', path: 'app/api/delivery/' },
      { name: 'GET /api/delivery/kitchen/queue', status: 'todo', path: 'app/api/delivery/' },
      { name: 'PATCH /api/delivery/kitchen/[orderId]/status', status: 'todo', path: 'app/api/delivery/' },
      { name: 'GET /api/delivery/stats', status: 'todo', path: 'app/api/delivery/' },
    ],
  },
  {
    id: 4,
    name: 'Küchen-Dashboard',
    agent: 'frontend',
    description: 'Live-Bestellübersicht für die Küche — Kanban, Timer, Touch-optimiert',
    estimatedDays: '2–3 Tage',
    features: [
      { name: 'Kanban-Board (6 Spalten)', status: 'todo', path: 'app/(admin)/kitchen/' },
      { name: 'Bestellkarten mit Items + Sonderwünsche', status: 'todo' },
      { name: 'Countdown-Timer pro Bestellung', status: 'todo' },
      { name: 'Farbcodierung (Grün/Gelb/Rot)', status: 'todo' },
      { name: 'One-Tap Status-Wechsel', status: 'todo' },
      { name: 'Sound-Notification neue Bestellung', status: 'todo' },
      { name: 'Supabase Realtime Live-Updates', status: 'todo' },
      { name: 'Tablet-optimiertes Layout', status: 'todo' },
    ],
  },
  {
    id: 5,
    name: 'Fahrer-App',
    agent: 'frontend',
    description: 'Tour-Übersicht, Navigation, Status-Updates, GPS-Tracking',
    estimatedDays: '2–3 Tage',
    features: [
      { name: 'Tour-Übersicht mit Stops', status: 'todo', path: 'app/driver/' },
      { name: 'Karten-Ansicht mit Route', status: 'todo' },
      { name: 'Stop-Details (Kunde, Adresse, Items)', status: 'todo' },
      { name: 'Status-Buttons (Abgeholt→Zugestellt)', status: 'todo' },
      { name: 'Navigation-Link (Google/Apple Maps)', status: 'todo' },
      { name: 'Tour-Zusammenfassung', status: 'todo' },
      { name: 'GPS-Standort senden', status: 'todo' },
      { name: 'Mobile-first Responsive', status: 'todo' },
    ],
  },
  {
    id: 6,
    name: 'Storefront + Tracking',
    agent: 'frontend',
    description: 'Dynamische ETA für Kunden, Live-Tracking, Echtzeit-Updates',
    estimatedDays: '1–2 Tage',
    features: [
      { name: 'Dynamische ETA-Anzeige ("19:20–19:40")', status: 'todo', path: 'app/order/' },
      { name: 'Smart-Messaging (kein Bündelungs-Hinweis)', status: 'todo' },
      { name: 'Live-Tracking Fahrer-Position', status: 'todo', path: 'app/track/' },
      { name: 'Realtime Order-Status-Updates', status: 'todo' },
    ],
  },
  {
    id: 7,
    name: 'Admin Dashboard',
    agent: 'frontend',
    description: 'Zonen-Config, Touren-Übersicht, Fahrer-Management, Statistiken',
    estimatedDays: '2–3 Tage',
    features: [
      { name: 'Zonen-Konfiguration mit Karte', status: 'todo', path: 'app/(admin)/lieferdienst/' },
      { name: 'Aktive Touren Übersicht', status: 'todo' },
      { name: 'Fahrer-Management (Online/Offline)', status: 'todo' },
      { name: 'Liefer-Statistiken Dashboard', status: 'todo' },
      { name: 'Bestell-Heatmap', status: 'todo' },
    ],
  },
];

const AGENT_COLORS = {
  backend: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500', label: 'Backend-Architekt' },
  frontend: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500', label: 'Frontend-Ingenieur' },
  ceo: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500', label: 'CEO Agent' },
};

const STATUS_CONFIG = {
  done: { label: 'Fertig', color: 'bg-emerald-500', textColor: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  'in-progress': { label: 'In Arbeit', color: 'bg-blue-500', textColor: 'text-blue-700', bgColor: 'bg-blue-50' },
  todo: { label: 'Offen', color: 'bg-neutral-300', textColor: 'text-neutral-500', bgColor: 'bg-neutral-50' },
  bug: { label: 'Bug', color: 'bg-red-500', textColor: 'text-red-700', bgColor: 'bg-red-50' },
};

export function DeliveryProgressDashboard() {
  const [phases] = React.useState<Phase[]>(PHASES);
  const [expandedPhase, setExpandedPhase] = React.useState<number | null>(null);
  const [lastUpdate] = React.useState(new Date().toLocaleString('de-DE'));

  const totalFeatures = phases.reduce((s, p) => s + p.features.length, 0);
  const doneFeatures = phases.reduce((s, p) => s + p.features.filter((f) => f.status === 'done').length, 0);
  const inProgressFeatures = phases.reduce((s, p) => s + p.features.filter((f) => f.status === 'in-progress').length, 0);
  const bugFeatures = phases.reduce((s, p) => s + p.features.filter((f) => f.status === 'bug').length, 0);
  const progressPercent = totalFeatures > 0 ? Math.round((doneFeatures / totalFeatures) * 100) : 0;

  const startDate = new Date('2026-05-28');
  const estimatedEndDate = new Date('2026-06-18');
  const today = new Date();
  const daysElapsed = Math.max(0, Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.max(0, Math.ceil((estimatedEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-matcha-600">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Live-Fortschritt
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-matcha-900 md:text-4xl">
          Smart Delivery System
        </h1>
        <p className="mt-1 text-sm text-matcha-800/60">
          3 AI-Agenten bauen das intelligente Liefer-System — 24 Sessions pro Tag
        </p>
      </div>

      {/* Stats Cards */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Gesamt-Fortschritt" value={`${progressPercent}%`} sub={`${doneFeatures}/${totalFeatures} Features`} accent />
        <StatCard label="In Arbeit" value={String(inProgressFeatures)} sub="Features aktiv" />
        <StatCard label="Bugs" value={String(bugFeatures)} sub={bugFeatures === 0 ? 'Keine Bugs' : 'Zu fixen'} alert={bugFeatures > 0} />
        <StatCard label="Geschätzt fertig" value={daysRemaining > 0 ? `${daysRemaining} Tage` : 'Fertig!'} sub={estimatedEndDate.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} />
      </div>

      {/* Progress Bar */}
      <div className="mb-8 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-matcha-900/5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-matcha-900">Gesamtfortschritt</span>
          <span className="font-mono text-xs text-matcha-600">{progressPercent}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-matcha-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-1000"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="mt-3 flex gap-4 text-[11px] text-matcha-800/60">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Fertig ({doneFeatures})</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" /> In Arbeit ({inProgressFeatures})</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-neutral-300" /> Offen ({totalFeatures - doneFeatures - inProgressFeatures - bugFeatures})</span>
          {bugFeatures > 0 && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> Bugs ({bugFeatures})</span>}
        </div>
      </div>

      {/* Agent Status */}
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-bold text-matcha-900">Agenten-Team</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {(['ceo', 'backend', 'frontend'] as const).map((agent) => {
            const c = AGENT_COLORS[agent];
            const phaseCount = phases.filter((p) => p.agent === agent).length;
            return (
              <div key={agent} className={cn('rounded-xl p-4 ring-1', c.bg, c.border)}>
                <div className="flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full animate-pulse', c.dot)} />
                  <span className={cn('text-sm font-bold', c.text)}>{c.label}</span>
                </div>
                <div className="mt-2 text-xs text-matcha-800/60">
                  {agent === 'ceo' ? 'Review, QA, Integration' : `${phaseCount} Phasen zugewiesen`}
                </div>
                <div className="mt-1 font-mono text-[10px] text-matcha-800/40">
                  8 Sessions/Tag · Sonnet 4.6
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Phases */}
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-bold text-matcha-900">Bauphasen</h2>
        <div className="space-y-3">
          {phases.map((phase) => {
            const done = phase.features.filter((f) => f.status === 'done').length;
            const total = phase.features.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const ac = AGENT_COLORS[phase.agent];
            const isExpanded = expandedPhase === phase.id;
            const hasInProgress = phase.features.some((f) => f.status === 'in-progress');
            const hasBug = phase.features.some((f) => f.status === 'bug');

            return (
              <div key={phase.id} className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-matcha-900/5">
                <button
                  onClick={() => setExpandedPhase(isExpanded ? null : phase.id)}
                  className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-matcha-50/50"
                >
                  {/* Phase number */}
                  <div className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold',
                    pct === 100 ? 'bg-emerald-100 text-emerald-700' : hasInProgress ? 'bg-blue-100 text-blue-700' : 'bg-neutral-100 text-neutral-500',
                  )}>
                    {pct === 100 ? '✓' : phase.id}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-matcha-900 truncate">{phase.name}</span>
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold', ac.bg, ac.text)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', ac.dot)} />
                        {ac.label.split('-')[0]}
                      </span>
                      {hasBug && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">Bug</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-matcha-800/50">{phase.description}</div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-matcha-100">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="shrink-0 font-mono text-[11px] text-matcha-600">{done}/{total}</span>
                    </div>
                  </div>

                  <div className="shrink-0 text-xs text-matcha-800/40">{phase.estimatedDays}</div>

                  <svg className={cn('h-4 w-4 shrink-0 text-matcha-400 transition', isExpanded && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="border-t border-matcha-900/5 px-4 py-3">
                    <div className="space-y-2">
                      {phase.features.map((feature, i) => {
                        const sc = STATUS_CONFIG[feature.status];
                        return (
                          <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-matcha-50/50">
                            <span className={cn('h-2 w-2 shrink-0 rounded-full', sc.color)} />
                            <span className="flex-1 text-sm text-matcha-900">{feature.name}</span>
                            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', sc.bgColor, sc.textColor)}>
                              {sc.label}
                            </span>
                            {feature.path && (
                              <span className="hidden font-mono text-[10px] text-matcha-400 md:block">{feature.path}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline */}
      <div className="mb-8 rounded-2xl bg-matcha-900 p-6 text-matcha-50">
        <h2 className="text-lg font-bold">Timeline</h2>
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-accent">28. Mai</div>
            <div className="mt-1 text-xs text-matcha-300">Start</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{daysElapsed} Tage</div>
            <div className="mt-1 text-xs text-matcha-300">Vergangen</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-accent">~18. Juni</div>
            <div className="mt-1 text-xs text-matcha-300">Ziel: Markt-reif</div>
          </div>
        </div>
        <div className="mt-4 text-center text-xs text-matcha-400">
          24 AI-Sessions pro Tag · 3 Agenten · Sonnet 4.6
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-matcha-800/40">
        Letztes Update: {lastUpdate} · Daten werden automatisch durch die Agenten aktualisiert
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent, alert }: { label: string; value: string; sub: string; accent?: boolean; alert?: boolean }) {
  return (
    <div className={cn(
      'rounded-xl p-4 ring-1',
      alert ? 'bg-red-50 ring-red-200' : accent ? 'bg-emerald-50 ring-emerald-200' : 'bg-white ring-matcha-900/5',
    )}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-600">{label}</div>
      <div className={cn('mt-1 text-2xl font-bold', alert ? 'text-red-600' : accent ? 'text-emerald-600' : 'text-matcha-900')}>
        {value}
      </div>
      <div className="mt-0.5 text-xs text-matcha-800/50">{sub}</div>
    </div>
  );
}
