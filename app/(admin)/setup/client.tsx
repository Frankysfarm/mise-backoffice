'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ArrowRight, Check, ChevronRight, Clock, ExternalLink, Rocket, Sparkles,
} from 'lucide-react';
import type { Preset, SetupStepId } from '@/lib/setup-presets';

type StepConfig = Record<SetupStepId, {
  title: string; short: string; desc: string; icon: string; href: string; estimatedMin: number;
}>;

export function SetupWizard({
  preset, presets, stepConfig, stepStatus, tenantSlug,
}: {
  preset: Preset | null;
  presets: Preset[];
  stepConfig: StepConfig;
  stepStatus: Record<string, boolean>;
  tenantSlug: string;
}) {
  // Keine Preset gewählt → Use-Case-Picker
  if (!preset) {
    return <PresetPicker presets={presets} />;
  }

  // Preset aktiv → Setup-Steps
  const total = preset.steps.length;
  const done = preset.steps.filter((s) => stepStatus[s]).length;
  const progress = Math.round((done / total) * 100);
  const estMin = preset.steps
    .filter((s) => !stepStatus[s])
    .reduce((sum, s) => sum + stepConfig[s].estimatedMin, 0);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Progress-Hero */}
      <Card className="p-6 bg-gradient-to-br from-matcha-900 to-matcha-700 text-white border-0">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-2xl bg-accent text-matcha-900 flex items-center justify-center text-2xl shrink-0">
            {preset.icon}
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-matcha-200">Use-Case</div>
            <h2 className="font-display text-2xl font-bold mt-1">{preset.name}</h2>
            <p className="text-sm text-matcha-100 mt-1">{preset.tagline}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="font-display font-bold">{done}/{total}</div>
        </div>
        <div className="mt-2 text-xs text-matcha-200 flex items-center gap-1">
          <Clock size={11} />
          noch ~{estMin} Min. bis alles eingerichtet ist
        </div>

        {done === total && (
          <div className="mt-6 rounded-2xl bg-accent/20 border border-accent/40 p-4">
            <div className="flex items-center gap-2 font-display font-bold">
              <Rocket size={18} /> Fertig! Deine Bestellseite ist bereit.
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`/order/${tenantSlug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-matcha-900 px-4 py-2 text-sm font-bold"
              >
                <ExternalLink size={14} /> Bestellseite öffnen
              </a>
              <Link href="/" className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20">
                Zum Dashboard
              </Link>
            </div>
          </div>
        )}
      </Card>

      {/* Step-Liste */}
      <div className="space-y-3">
        {preset.steps.map((stepId, i) => {
          const cfg = stepConfig[stepId];
          const completed = stepStatus[stepId];
          const prevCompleted = i === 0 || preset.steps.slice(0, i).every((s) => stepStatus[s]);
          const isNext = !completed && prevCompleted;

          return (
            <Link
              key={stepId}
              href={cfg.href}
              className={cn(
                'group block rounded-2xl border bg-card p-5 transition',
                completed && 'opacity-60 bg-matcha-50/50',
                isNext && 'border-matcha-500 ring-2 ring-matcha-500/20 shadow-soft',
                !completed && !isNext && 'hover:shadow-subtle hover:-translate-y-0.5',
              )}
            >
              <div className="flex items-start gap-4">
                {/* Step-Nummer / Check */}
                <div className={cn(
                  'h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 font-display font-bold transition',
                  completed ? 'bg-matcha-500 text-white' :
                  isNext ? 'bg-matcha-900 text-matcha-50' :
                  'bg-muted text-muted-foreground',
                )}>
                  {completed ? <Check size={18} /> : <span>{i + 1}</span>}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg">{cfg.icon}</span>
                    <h3 className="font-display font-bold">{cfg.title}</h3>
                    {completed && <Badge variant="accent" className="text-[10px] h-5">Erledigt</Badge>}
                    {isNext && !completed && <Badge variant="default" className="text-[10px] h-5">Jetzt dran</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{cfg.desc}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={10} /> ~{cfg.estimatedMin} Min.
                    </span>
                  </div>
                </div>

                <ChevronRight
                  className={cn(
                    'text-muted-foreground shrink-0 mt-3 transition',
                    isNext && 'text-matcha-700 group-hover:translate-x-0.5',
                  )}
                  size={18}
                />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Wechsel Use-Case */}
      <Card className="p-5 bg-muted/30 border-dashed">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm">
            <div className="font-bold">Falsche Wahl getroffen?</div>
            <div className="text-muted-foreground">Du kannst jederzeit einen anderen Use-Case ausprobieren.</div>
          </div>
          <Link href="/setup" className="text-sm font-semibold text-matcha-700 hover:underline whitespace-nowrap">
            Use-Case wechseln →
          </Link>
        </div>
      </Card>
    </div>
  );
}

function PresetPicker({ presets }: { presets: Preset[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-matcha-100 text-matcha-900 px-3 py-1 text-xs font-bold uppercase tracking-wider">
          <Sparkles size={12} /> Schnell-Setup
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight mt-3">
          Was hast du vor?
        </h1>
        <p className="text-muted-foreground mt-2">
          Wir zeigen dir dann nur die Schritte, die du wirklich brauchst — statt durch alle 12 Module zu laufen.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            onDoubleClick={() => router.push(`/setup?preset=${p.id}`)}
            className={cn(
              'group text-left rounded-2xl border bg-card p-6 transition',
              selected === p.id ? 'border-matcha-700 ring-2 ring-matcha-500/20 shadow-soft' : 'hover:shadow-subtle hover:-translate-y-0.5',
            )}
          >
            <div className="flex items-start gap-3">
              <div className="text-4xl shrink-0">{p.icon}</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-lg font-bold">{p.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{p.tagline}</p>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{p.description}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {p.modules.slice(0, 6).map((m) => (
                    <span key={m} className="text-[10px] font-semibold uppercase tracking-wider text-matcha-700 bg-matcha-50 rounded px-1.5 py-0.5">
                      {m}
                    </span>
                  ))}
                </div>
                <div className="mt-3 text-[10px] text-muted-foreground italic">für: {p.fuer}</div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t flex items-center justify-between">
              <span className="text-xs font-semibold text-matcha-700">
                {p.steps.length} Schritte · ~{p.steps.reduce((s, _) => s + 5, 0) / p.steps.length * 0 + 20} Min.
              </span>
              {selected === p.id && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-matcha-700">
                  <Check size={12} /> Ausgewählt
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="sticky bottom-4 flex justify-center">
          <button
            onClick={() => router.push(`/setup?preset=${selected}`)}
            className="inline-flex items-center gap-2 rounded-2xl bg-matcha-900 text-matcha-50 px-8 py-4 font-display font-bold text-base shadow-strong hover:bg-matcha-800 transition"
          >
            Dieses Setup starten <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
