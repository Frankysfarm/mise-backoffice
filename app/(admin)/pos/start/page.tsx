import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight, Bell, Calculator, CalendarDays, ChefHat, ClipboardList, Grid,
  Receipt, Settings, ShoppingBag,
} from 'lucide-react';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { getActiveModules } from '@/lib/modules';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Start · Mise POS' };

export default async function POSStartPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb
    .from('employees')
    .select('tenant_id,location_id,vorname,nachname')
    .eq('id', emp.id)
    .maybeSingle();
  if (!empRow?.tenant_id || !empRow.location_id) redirect('/start');

  const todayStr = new Date().toISOString().slice(0, 10);
  const [{ data: tenant }, { data: location }, { count: openOrdersCount }, { data: reservationsToday }, modules] = await Promise.all([
    svc.from('tenants').select('name').eq('id', empRow.tenant_id).single(),
    svc.from('locations').select('name').eq('id', empRow.location_id).single(),
    svc.from('customer_orders').select('id', { count: 'exact', head: true })
      .eq('location_id', empRow.location_id)
      .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs']),
    svc.from('tisch_reservierungen')
      .select('id, gast_name, gast_anzahl, zeit_von, status, restaurant_tables(nummer)')
      .eq('location_id', empRow.location_id)
      .eq('datum', todayStr)
      .not('status', 'in', '(beendet,storniert,noshow)')
      .order('zeit_von', { ascending: true })
      .limit(8),
    getActiveModules(),
  ]);

  const t = tenant as { name: string };
  const l = location as { name: string };
  const e = empRow as { vorname?: string };
  const greeting = e.vorname ? `Hallo ${e.vorname}` : `Willkommen`;
  const openOrders = openOrdersCount ?? 0;

  const hasPos = modules.has('pos');
  const hasOrdering = modules.has('ordering') || modules.has('table_ordering') || modules.has('delivery');

  const sekundaer = [
    { key: 'tables',   title: 'Tischplan',       href: '/pos/tables/layout', icon: Grid,          visible: modules.has('pos') || modules.has('table_ordering') },
    { key: 'kitchen',  title: 'Küche / KDS',     href: '/pos/stations',      icon: ChefHat,       visible: modules.has('kitchen') || modules.has('pos') },
    { key: 'history',  title: 'Bestellhistorie', href: '/pos/history',       icon: ClipboardList, visible: true },
    { key: 'cash',     title: 'Tagesabschluss',  href: '/cash',              icon: Receipt,       visible: modules.has('pos') },
    { key: 'shop',     title: 'Online-Shop',     href: '/shop',              icon: ShoppingBag,   visible: hasOrdering },
    { key: 'settings', title: 'Einstellungen',   href: '/pos/setup',         icon: Settings,      visible: true },
  ].filter((x) => x.visible);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 to-zinc-900 text-white">
      <div className="max-w-3xl mx-auto px-5 py-8 md:py-12">
        <header className="mb-8">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Mise POS · {l.name}
          </p>
          <h1 className="font-display text-3xl md:text-4xl font-black mt-1">
            {greeting} 👋
          </h1>
          <p className="text-zinc-400 mt-1 text-sm">
            {t.name}
          </p>
        </header>

        {hasPos && (
          <Link
            href="/pos"
            className="block w-full mb-4 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-7 md:p-9 shadow-2xl hover:scale-[1.02] transition-transform group"
          >
            <div className="flex items-center gap-5">
              <div className="h-20 w-20 md:h-24 md:w-24 rounded-2xl bg-white/15 backdrop-blur grid place-items-center shrink-0">
                <Calculator className="h-12 w-12 md:h-14 md:w-14 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                  Hauptfunktion
                </p>
                <h2 className="font-display text-3xl md:text-5xl font-black leading-tight mt-1">
                  Kasse starten
                </h2>
                <p className="text-white/90 mt-1 text-sm md:text-base">
                  POS-Terminal · Tische · Kassieren · Trinkgeld
                </p>
              </div>
              <ArrowRight className="h-8 w-8 text-white/70 shrink-0 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        )}

        {hasOrdering && (
          <Link
            href="/pos/inbox"
            className="block w-full mb-6 rounded-3xl border-2 border-amber-400/40 bg-gradient-to-br from-amber-500/15 to-orange-600/15 p-5 md:p-6 hover:bg-amber-500/25 transition-colors group relative"
          >
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-amber-500 text-white grid place-items-center shrink-0 relative">
                <Bell className="h-7 w-7" />
                {openOrders > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[24px] h-6 px-1.5 rounded-full bg-red-600 text-white font-display font-black text-xs grid place-items-center animate-pulse border-2 border-zinc-900">
                    {openOrders}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  Lieferservice
                </p>
                <h3 className="font-display text-xl md:text-2xl font-black text-white leading-tight">
                  Bestellungen annehmen
                </h3>
                <p className="text-white/70 text-xs md:text-sm mt-0.5">
                  {openOrders > 0
                    ? `${openOrders} offene Bestellung${openOrders === 1 ? '' : 'en'} · Live mit Ton`
                    : 'Live-Eingang mit Ton + Push-Notification'}
                </p>
              </div>
              <ArrowRight className="h-6 w-6 text-white/50 shrink-0 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        )}

        {!hasPos && !hasOrdering && (
          <div className="rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 p-5 mb-6">
            <h3 className="font-display font-black text-amber-300">Kein Modul aktiv</h3>
            <p className="text-sm text-amber-100/80 mt-1">
              Buch ein Modul (POS-Kasse oder Lieferservice) um loszulegen.
            </p>
            <Link
              href="/modules"
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-zinc-900 font-bold text-sm"
            >
              Module ansehen
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        <div className="mt-2">
          {reservationsToday && reservationsToday.length > 0 && (
            <Link href="/reservierungen" className="block mb-3 rounded-2xl border-2 border-purple-400/40 bg-gradient-to-br from-purple-500/15 to-fuchsia-600/15 p-4 hover:bg-purple-500/25 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <CalendarDays className="h-5 w-5 text-purple-300" />
                <h3 className="font-display font-black text-white text-base">
                  Reservierungen heute ({reservationsToday.length})
                </h3>
                <ArrowRight className="ml-auto h-4 w-4 text-white/50" />
              </div>
              <div className="space-y-1">
                {(reservationsToday as Array<{id:string;gast_name:string;gast_anzahl:number;zeit_von:string;restaurant_tables?:{nummer?:string|number}|null}>).slice(0, 5).map((r) => (
                  <div key={r.id} className="text-xs text-white/85 flex items-center gap-2">
                    <span className="font-mono font-bold">{r.zeit_von.slice(0, 5)}</span>
                    <span className="font-bold">{r.gast_name}</span>
                    <span className="text-white/60">({r.gast_anzahl}P)</span>
                    {r.restaurant_tables?.nummer && (
                      <span className="text-white/60">· Tisch {r.restaurant_tables.nummer}</span>
                    )}
                  </div>
                ))}
                {reservationsToday.length > 5 && (
                  <div className="text-xs text-white/60 italic">+ {reservationsToday.length - 5} weitere…</div>
                )}
              </div>
            </Link>
          )}
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2 px-1">
            Weitere Funktionen
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {sekundaer.map((tile) => {
              const Icon = tile.icon;
              return (
                <Link
                  key={tile.key}
                  href={tile.href as never}
                  className="rounded-xl bg-zinc-800/70 border border-zinc-700 px-3 py-3 flex items-center gap-2.5 hover:bg-zinc-700/70 transition-colors"
                >
                  <Icon className="h-4 w-4 text-zinc-400 shrink-0" />
                  <span className="font-bold text-sm text-zinc-100 truncate">{tile.title}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <footer className="mt-10 text-center">
          <Link
            href="/welcome"
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← Komplettes Backoffice
          </Link>
        </footer>
      </div>
    </div>
  );
}
