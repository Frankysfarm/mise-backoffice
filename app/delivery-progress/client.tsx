'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type Commit = {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  html_url: string;
};

type Props = {
  commits: Commit[];
  progressContent: string;
};

type Phase = {
  id: number;
  name: string;
  agent: 'backend' | 'frontend' | 'ceo';
  description: string;
  features: { name: string; status: 'done' | 'in-progress' | 'todo' | 'bug' }[];
  estimatedDays: string;
};

const PHASES_BASE: Phase[] = [
  {
    id: 1, name: 'Datenmodell', agent: 'backend',
    description: 'Supabase SQL Migrations für Zonen, Touren, Stops, Scores',
    estimatedDays: '1-2 Tage',
    features: [
      { name: 'delivery_zones Tabelle', status: 'todo' },
      { name: 'delivery_tours Tabelle', status: 'todo' },
      { name: 'tour_stops Tabelle', status: 'todo' },
      { name: 'dispatch_scores Tabelle', status: 'todo' },
      { name: 'kitchen_timings Tabelle', status: 'todo' },
      { name: 'customer_orders erweitern', status: 'todo' },
      { name: 'drivers erweitern', status: 'todo' },
    ],
  },
  {
    id: 2, name: 'Dispatch Engine', agent: 'backend',
    description: 'Smart Scoring, Bündelung, ETA, Tour-Optimierung',
    estimatedDays: '2-3 Tage',
    features: [
      { name: 'dispatch-engine.ts', status: 'todo' },
      { name: 'scoring.ts (10 Faktoren)', status: 'todo' },
      { name: 'bundling.ts', status: 'todo' },
      { name: 'zones.ts (A/B/C/D)', status: 'todo' },
      { name: 'eta.ts (dynamisch)', status: 'todo' },
      { name: 'kitchen-sync.ts', status: 'todo' },
      { name: 'tour-optimizer.ts', status: 'todo' },
    ],
  },
  {
    id: 3, name: 'API-Routes', agent: 'backend',
    description: 'REST-Endpoints für Dispatch, Touren, Zonen, Stats',
    estimatedDays: '2-3 Tage',
    features: [
      { name: 'POST /api/delivery/dispatch', status: 'todo' },
      { name: 'GET /api/delivery/tours', status: 'todo' },
      { name: 'PATCH /api/delivery/tours/[id]', status: 'todo' },
      { name: 'GET+POST /api/delivery/zones', status: 'todo' },
      { name: 'GET /api/delivery/eta', status: 'todo' },
      { name: 'GET /api/delivery/kitchen/queue', status: 'todo' },
      { name: 'GET /api/delivery/stats', status: 'todo' },
    ],
  },
  {
    id: 4, name: 'Küchen-Dashboard', agent: 'frontend',
    description: 'Smart-Timing, Countdown, Farbcodierung, Realtime',
    estimatedDays: '2-3 Tage',
    features: [
      { name: 'Smart-Timing-Anzeige', status: 'todo' },
      { name: 'Countdown bis Fahrer', status: 'todo' },
      { name: 'Farbcodierung Grün/Gelb/Rot', status: 'todo' },
      { name: 'Realtime Updates', status: 'todo' },
    ],
  },
  {
    id: 5, name: 'Fahrer-App', agent: 'frontend',
    description: 'Tour-Übersicht, Navigation, Multi-Stop',
    estimatedDays: '2-3 Tage',
    features: [
      { name: 'Tour-Übersicht mit Stops', status: 'todo' },
      { name: 'Karten-Ansicht', status: 'todo' },
      { name: 'Navigation-Links', status: 'todo' },
      { name: 'GPS-Tracking', status: 'todo' },
    ],
  },
  {
    id: 6, name: 'Storefront + Tracking', agent: 'frontend',
    description: 'Dynamische ETA, Live-Tracking',
    estimatedDays: '1-2 Tage',
    features: [
      { name: 'Dynamische ETA-Anzeige', status: 'todo' },
      { name: 'Live-Tracking Fahrer', status: 'todo' },
      { name: 'Realtime Status', status: 'todo' },
    ],
  },
  {
    id: 7, name: 'Admin Dashboard', agent: 'frontend',
    description: 'Zonen-Config, Statistiken, Heatmap',
    estimatedDays: '2-3 Tage',
    features: [
      { name: 'Zonen-Konfiguration', status: 'todo' },
      { name: 'Touren-Übersicht', status: 'todo' },
      { name: 'Fahrer-Management', status: 'todo' },
      { name: 'Statistiken-Dashboard', status: 'todo' },
    ],
  },
];

const AGENT_COLORS = {
  backend: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Backend' },
  frontend: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500', label: 'Frontend' },
  ceo: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'CEO' },
};

function parseProgress(content: string): Phase[] {
  const phases = JSON.parse(JSON.stringify(PHASES_BASE)) as Phase[];
  if (!content) return phases;
  const lines = content.split('\n');
  for (const phase of phases) {
    for (const feature of phase.features) {
      const escaped = feature.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`^- \\[(x|X| )\\].*${escaped}`, 'i');
      for (const line of lines) {
        if (re.test(line)) {
          if (line.toLowerCase().includes('[x]')) feature.status = 'done';
          else if (line.includes('[~]') || /in.progress/i.test(line)) feature.status = 'in-progress';
          else if (/bug/i.test(line)) feature.status = 'bug';
          break;
        }
      }
    }
  }
  return phases;
}

function detectAgent(message: string): 'backend' | 'frontend' | 'ceo' | 'other' {
  const m = message.toLowerCase();
  if (m.includes('backend') || m.includes('api') || m.includes('lib/delivery') || m.includes('migration')) return 'backend';
  if (m.includes('frontend') || m.includes('ui') || m.includes('dashboard') || m.includes('kitchen') || m.includes('fahrer')) return 'frontend';
  if (m.includes('review') || m.includes('ceo') || m.includes('integration') || m.includes('fix')) return 'ceo';
  return 'other';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std`;
  const d = Math.floor(h / 24);
  return `vor ${d} Tagen`;
}

export function DeliveryProgressDashboard({ commits, progressContent }: Props) {
  const phases = parseProgress(progressContent);
  const [expandedPhase, setExpandedPhase] = React.useState<number | null>(null);

  const totalFeatures = phases.reduce((s, p) => s + p.features.length, 0);
  const doneFeatures = phases.reduce((s, p) => s + p.features.filter((f) => f.status === 'done').length, 0);
  const inProgressFeatures = phases.reduce((s, p) => s + p.features.filter((f) => f.status === 'in-progress').length, 0);
  const bugFeatures = phases.reduce((s, p) => s + p.features.filter((f) => f.status === 'bug').length, 0);
  const progressPercent = totalFeatures > 0 ? Math.round((doneFeatures / totalFeatures) * 100) : 0;

  // Agent activity from commits
  const deliveryCommits = commits.filter((c) =>
    /delivery|dispatch|tour|fahrer|kitchen|liefer/i.test(c.commit.message),
  );
  const agentActivity = {
    backend: deliveryCommits.filter((c) => detectAgent(c.commit.message) === 'backend').length,
    frontend: deliveryCommits.filter((c) => detectAgent(c.commit.message) === 'frontend').length,
    ceo: deliveryCommits.filter((c) => detectAgent(c.commit.message) === 'ceo').length,
  };
  const lastCommit = commits[0];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Live von GitHub
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 md:text-4xl">
          Smart Delivery System
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          {deliveryCommits.length} Delivery-Commits · {commits.length} Commits gesamt
          {lastCommit && ` · Letzter Commit ${timeAgo(lastCommit.commit.author.date)}`}
        </p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Fortschritt" value={`${progressPercent}%`} sub={`${doneFeatures}/${totalFeatures} Features`} accent />
        <StatCard label="In Arbeit" value={String(inProgressFeatures)} sub="Aktiv" />
        <StatCard label="Bugs" value={String(bugFeatures)} sub={bugFeatures === 0 ? 'Keine Bugs' : 'Zu fixen'} alert={bugFeatures > 0} />
        <StatCard label="Commits" value={String(deliveryCommits.length)} sub="Delivery-Module" />
      </div>

      {/* Progress Bar */}
      <div className="mb-8 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-neutral-900">Gesamtfortschritt</span>
          <span className="font-mono text-xs text-neutral-600">{progressPercent}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-1000"
            style={{ width: `${Math.max(progressPercent, 2)}%` }}
          />
        </div>
      </div>

      {/* Agent Status */}
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-bold text-neutral-900">Agenten-Team (Live)</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {(['ceo', 'backend', 'frontend'] as const).map((agent) => {
            const c = AGENT_COLORS[agent];
            return (
              <div key={agent} className={cn('rounded-xl p-4 ring-1 ring-neutral-200', c.bg)}>
                <div className="flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full animate-pulse', c.dot)} />
                  <span className={cn('text-sm font-bold', c.text)}>{c.label} Agent</span>
                </div>
                <div className="mt-2 text-2xl font-bold text-neutral-900">{agentActivity[agent]}</div>
                <div className="text-xs text-neutral-600">Commits</div>
                <div className="mt-2 font-mono text-[10px] text-neutral-400">
                  Läuft jede Stunde · Sonnet 4.6
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Phases */}
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-bold text-neutral-900">Bauphasen</h2>
        <div className="space-y-3">
          {phases.map((phase) => {
            const done = phase.features.filter((f) => f.status === 'done').length;
            const total = phase.features.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const ac = AGENT_COLORS[phase.agent];
            const isExpanded = expandedPhase === phase.id;

            return (
              <div key={phase.id} className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-neutral-200">
                <button
                  onClick={() => setExpandedPhase(isExpanded ? null : phase.id)}
                  className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-neutral-50"
                >
                  <div className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold',
                    pct === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500',
                  )}>
                    {pct === 100 ? '✓' : phase.id}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-900 truncate">{phase.name}</span>
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold', ac.bg, ac.text)}>
                        {ac.label}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">{phase.description}</div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="shrink-0 font-mono text-[11px] text-neutral-600">{done}/{total}</span>
                    </div>
                  </div>
                  <svg className={cn('h-4 w-4 shrink-0 text-neutral-400 transition', isExpanded && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="border-t border-neutral-100 px-4 py-3 space-y-2">
                    {phase.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                        <span className={cn('h-2 w-2 shrink-0 rounded-full',
                          feature.status === 'done' ? 'bg-emerald-500' :
                          feature.status === 'in-progress' ? 'bg-blue-500' :
                          feature.status === 'bug' ? 'bg-red-500' : 'bg-neutral-300',
                        )} />
                        <span className="flex-1 text-sm text-neutral-900">{feature.name}</span>
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold',
                          feature.status === 'done' ? 'bg-emerald-50 text-emerald-700' :
                          feature.status === 'in-progress' ? 'bg-blue-50 text-blue-700' :
                          feature.status === 'bug' ? 'bg-red-50 text-red-700' : 'bg-neutral-50 text-neutral-500',
                        )}>
                          {feature.status === 'done' ? 'Fertig' :
                           feature.status === 'in-progress' ? 'In Arbeit' :
                           feature.status === 'bug' ? 'Bug' : 'Offen'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Commits */}
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-bold text-neutral-900">Letzte Aktivität</h2>
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-neutral-200 overflow-hidden">
          {commits.slice(0, 15).map((c, i) => {
            const agent = detectAgent(c.commit.message);
            const ac = agent !== 'other' ? AGENT_COLORS[agent] : null;
            return (
              <a
                key={c.sha}
                href={c.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex items-start gap-3 p-3 transition hover:bg-neutral-50',
                  i > 0 && 'border-t border-neutral-100',
                )}
              >
                {ac ? (
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', ac.dot)} />
                ) : (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-neutral-300" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-neutral-900 truncate">{c.commit.message.split('\n')[0]}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-500">
                    <span>{c.commit.author.name}</span>
                    <span>·</span>
                    <span>{timeAgo(c.commit.author.date)}</span>
                    {ac && (
                      <>
                        <span>·</span>
                        <span className={ac.text}>{ac.label}</span>
                      </>
                    )}
                  </div>
                </div>
              </a>
            );
          })}
          {commits.length === 0 && (
            <div className="p-8 text-center text-sm text-neutral-500">
              Noch keine Commits — Agenten starten gleich
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-neutral-400">
        Auto-Refresh alle 60 Sekunden · Daten von GitHub Frankysfarm/mise-backoffice
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent, alert }: { label: string; value: string; sub: string; accent?: boolean; alert?: boolean }) {
  return (
    <div className={cn(
      'rounded-xl p-4 ring-1',
      alert ? 'bg-red-50 ring-red-200' : accent ? 'bg-emerald-50 ring-emerald-200' : 'bg-white ring-neutral-200',
    )}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">{label}</div>
      <div className={cn('mt-1 text-2xl font-bold', alert ? 'text-red-600' : accent ? 'text-emerald-600' : 'text-neutral-900')}>
        {value}
      </div>
      <div className="mt-0.5 text-xs text-neutral-500">{sub}</div>
    </div>
  );
}
