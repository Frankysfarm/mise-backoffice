'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { cn, euro } from '@/lib/utils';
import {
  ArrowRight, Check, Clock, CreditCard, Lock, Sparkles, TrendingUp, XCircle, Loader2,
} from 'lucide-react';
import type { PlatformModule, TenantModule } from './page';

type Props = {
  modules: PlatformModule[];
  status: TenantModule[];
  routeMap: Record<string, string>;
};

const CATEGORY_ORDER = ['kern', 'umsatz', 'betrieb', 'finanzen', 'admin'];
const CATEGORY_LABEL: Record<string, string> = {
  kern:     '🧩 Kern-Module',
  umsatz:   '💰 Verkauf & Umsatz',
  betrieb:  '⚙️ Betrieb & Alltag',
  finanzen: '🧾 Finanzen & Auswertung',
  admin:    '🛠 Administration',
};

export function ModulesGallery({ modules, status, routeMap }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [pending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const statusMap = new Map(status.map((s) => [s.module_id, s]));

  function isComingSoon(m: PlatformModule) {
    return (m as any).launch_status === 'coming_soon';
  }

  function trialInfo(m: PlatformModule) {
    const s = statusMap.get(m.id);
    if (!s) return { state: 'inaktiv', daysLeft: null as number | null };

    if (s.status === 'aktiv') return { state: 'aktiv', daysLeft: null };
    if (s.status === 'trial' && s.aktiv && s.ablauf_am) {
      const days = Math.ceil((new Date(s.ablauf_am).getTime() - Date.now()) / (24 * 3600 * 1000));
      if (days <= 0) return { state: 'abgelaufen', daysLeft: 0 };
      return { state: 'trial', daysLeft: days };
    }
    if (s.status === 'abgelaufen') return { state: 'abgelaufen', daysLeft: 0 };
    if (s.test_gestartet_am) return { state: 'verbraucht', daysLeft: null }; // Trial schon mal gestartet, aber nicht mehr aktiv
    return { state: 'inaktiv', daysLeft: null };
  }

  async function startTrial(moduleId: string) {
    setLoadingId(moduleId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: emp } = await supabase.from('employees').select('tenant_id').eq('auth_user_id', user.id).maybeSingle();
      if (!emp?.tenant_id) return;

      const { data } = await supabase.rpc('start_module_trial', { p_tenant_id: emp.tenant_id, p_module_id: moduleId });
      const result = data as { ok: boolean; error?: string };

      if (!result?.ok) {
        alert(result?.error ?? 'Trial konnte nicht gestartet werden');
        setLoadingId(null);
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoadingId(null);
    }
  }

  // Gruppiere nach Kategorie
  const byCat = new Map<string, PlatformModule[]>();
  for (const m of modules) {
    const c = m.kategorie ?? 'sonstiges';
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c)!.push(m);
  }

  const activeCount = modules.filter((m) => {
    const s = trialInfo(m);
    return s.state === 'trial' || s.state === 'aktiv';
  }).length;

  return (
    <div className="space-y-8">
      {/* Summary */}
      <Card className="p-5 bg-gradient-to-br from-matcha-900 to-matcha-700 text-white border-0">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-accent text-matcha-900 flex items-center justify-center">
            <Sparkles size={20} />
          </div>
          <div className="flex-1">
            <div className="font-display text-2xl font-bold">{activeCount} von {modules.length} Modulen aktiv</div>
            <div className="text-sm text-matcha-100 mt-0.5">
              Jedes Modul kommt mit 14 Tagen Test. Danach entscheidest du, was bleibt.
            </div>
          </div>
        </div>
      </Card>

      {/* Gruppen */}
      {CATEGORY_ORDER.map((cat) => {
        const mods = byCat.get(cat) ?? [];
        if (mods.length === 0) return null;
        return (
          <section key={cat}>
            <h2 className="font-display text-xl font-bold mb-4 px-1">{CATEGORY_LABEL[cat] ?? cat}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mods.map((m) => {
                const info = trialInfo(m);
                const route = routeMap[m.id];
                const comingSoon = isComingSoon(m);
                return (
                  <ModuleTile
                    key={m.id}
                    module={m}
                    state={comingSoon ? 'coming_soon' : info.state}
                    daysLeft={info.daysLeft}
                    route={route}
                    loading={loadingId === m.id || pending}
                    onStartTrial={() => !comingSoon && startTrial(m.id)}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ModuleTile({
  module: m, state, daysLeft, route, loading, onStartTrial,
}: {
  module: PlatformModule;
  state: string;
  daysLeft: number | null;
  route?: string;
  loading: boolean;
  onStartTrial: () => void;
}) {
  const features = Array.isArray(m.features) ? (m.features as string[]) : [];

  return (
    <Card className={cn(
      'relative flex flex-col p-5 transition',
      state === 'trial' && 'border-matcha-500/40 bg-matcha-50/40 shadow-subtle',
      state === 'aktiv' && 'border-matcha-700 bg-matcha-50/60 shadow-subtle',
      state === 'abgelaufen' && 'border-red-300 bg-red-50/40',
      (state === 'inaktiv' || state === 'verbraucht') && 'opacity-80 hover:opacity-100',
    )}>
      {/* Status-Badge */}
      <div className="absolute top-4 right-4">
        <StatusBadge state={state} daysLeft={daysLeft} />
      </div>

      {/* Icon */}
      <div className="text-4xl mb-2">{m.icon ?? '📦'}</div>

      {/* Name + Desc */}
      <h3 className="font-display text-lg font-bold leading-tight">{m.name}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed line-clamp-2">{m.beschreibung}</p>

      {/* Features */}
      {features.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {features.slice(0, 3).map((f, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <Check className="h-3 w-3 text-matcha-600 shrink-0 mt-0.5" />
              <span className="line-clamp-1">{f}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Preis */}
      <div className="mt-4 flex items-baseline gap-1">
        {m.preis_monatlich && m.preis_monatlich > 0 ? (
          <>
            <span className="font-display text-2xl font-bold">{euro(m.preis_monatlich)}</span>
            <span className="text-xs text-muted-foreground">/ Monat</span>
          </>
        ) : (
          <span className="text-xs text-matcha-700 font-bold uppercase tracking-wider">inklusive</span>
        )}
      </div>

      {/* CTA */}
      <div className="mt-4 pt-4 border-t">
        {(state === 'trial' || state === 'aktiv') && route ? (
          <Link
            href={route}
            className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-matcha-900 text-matcha-50 font-bold hover:bg-matcha-800 transition"
          >
            Öffnen <ArrowRight size={14} />
          </Link>
        ) : state === 'inaktiv' ? (
          <button
            onClick={onStartTrial}
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-accent text-matcha-900 font-bold hover:bg-accent/90 disabled:opacity-50 transition"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading ? 'Starte …' : 'Jetzt 14 Tage testen'}
          </button>
        ) : state === 'abgelaufen' || state === 'verbraucht' ? (
          <Link
            href={`/settings/restaurant#zahlung?buy=${m.id}`}
            className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition"
          >
            <CreditCard size={14} />
            Jetzt bezahlen
          </Link>
        ) : state === 'coming_soon' ? (
          <button
            disabled
            className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-gradient-to-br from-gold/20 to-amber-200 text-amber-900 font-bold cursor-not-allowed"
          >
            <Clock size={14} />
            Kommt bald · {(m as any).launch_eta ?? 'Q2 2026'}
          </button>
        ) : (
          <button
            disabled
            className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-muted text-muted-foreground font-bold"
          >
            <Lock size={14} />
            Nicht verfügbar
          </button>
        )}
      </div>
    </Card>
  );
}

function StatusBadge({ state, daysLeft }: { state: string; daysLeft: number | null }) {
  if (state === 'coming_soon') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gold/30 text-amber-900 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
        <Clock className="h-3 w-3" /> Bald
      </span>
    );
  }
  if (state === 'aktiv') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-matcha-700 text-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
        <Check className="h-3 w-3" /> Aktiv
      </span>
    );
  }
  if (state === 'trial') {
    const warn = (daysLeft ?? 99) <= 3;
    return (
      <span className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
        warn ? 'bg-gold text-matcha-900 animate-pulse' : 'bg-accent/30 text-matcha-900',
      )}>
        <Clock className="h-3 w-3" /> Trial · {daysLeft}d
      </span>
    );
  }
  if (state === 'abgelaufen') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-800 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
        <XCircle className="h-3 w-3" /> Abgelaufen
      </span>
    );
  }
  if (state === 'verbraucht') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
        Test genutzt
      </span>
    );
  }
  // inaktiv
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-card border border-dashed border-border text-muted-foreground px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
      <TrendingUp className="h-3 w-3" /> Testen
    </span>
  );
}
