import Link from 'next/link';
import { ClipboardCheck, ListChecks, ShieldCheck, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requirePosAccess } from '@/lib/auth/requireRole';

export default async function AblaeufePage() {
  const actor = await requirePosAccess();
  const service = await createClient();
  const [{ count: guides }, { count: checks }, { count: cleaning }, { count: operational }] = await Promise.all([
    service.from('shift_guides').select('id', { count: 'exact', head: true }).eq('aktiv', true),
    service.from('checkup_templates').select('id', { count: 'exact', head: true }).eq('aktiv', true),
    service.from('cleaning_tasks').select('id', { count: 'exact', head: true }).eq('aktiv', true),
    service.from('operational_tasks').select('id', { count: 'exact', head: true }).not('status', 'in', '(erledigt,storniert)'),
  ]);
  const cards = [
    { href: '/neo/app/ablaeufe/schichtleitfaeden', title: 'Öffnung & Schließung', text: 'Schichtleitfäden, Kategorien und verbindliche Arbeitsschritte.', value: guides ?? 0, icon: ListChecks },
    ...(['manager', 'backoffice', 'admin'].includes(actor.rolle) ? [
      { href: '/neo/app/ablaeufe/kontrollen', title: 'Checklisten & Kontrollen', text: 'Hygiene-, Kassen-, Qualitäts- und Betriebskontrollen.', value: checks ?? 0, icon: ClipboardCheck },
      { href: '/neo/app/ablaeufe/reinigung', title: 'Reinigung & HACCP', text: 'Reinigungsplan, Fotonachweise und HACCP-Protokolle.', value: cleaning ?? 0, icon: ShieldCheck },
      { href: '/neo/app/mitarbeiter', title: 'Operative Aufgaben', text: 'Delegation, Nachweise, Prüfung und automatische Eskalation.', value: operational ?? 0, icon: Sparkles },
    ] : []),
  ];
  return <div><div className="mb-6"><div className="text-xs font-bold uppercase tracking-[.14em] text-indigo-700">Zentrale Datenbasis</div><h2 className="mt-1 font-display text-2xl font-bold">Listen, Abläufe & Kontrollen</h2><p className="mt-2 text-sm text-slate-500">Die ausgebauten Betriebsabläufe laufen direkt in Neo und verwenden dieselben Mitarbeiter, Bereiche, Standorte und Nachweise.</p></div><div className="grid gap-4 sm:grid-cols-2">{cards.map((card) => <Link key={card.href} href={card.href} className="group rounded-2xl border border-slate-200 bg-white p-5 no-underline shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"><div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><card.icon size={21} /></span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{card.value}</span></div><h3 className="mt-4 text-base font-bold text-slate-950">{card.title}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{card.text}</p></Link>)}</div></div>;
}
