import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, MapPin, ShieldCheck, Warehouse } from 'lucide-react';
import { requirePosAccess } from '@/lib/auth/requireRole';
import { createServiceClient } from '@/lib/supabase/server';
import { InventoryCounter } from './counter';

export const dynamic = 'force-dynamic';

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function EmployeeInventoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = await requirePosAccess();
  if (!employee.tenant_id) redirect('/login?reason=no_access');

  const service = createServiceClient();
  const { data: session } = await service
    .from('inventory_sessions')
    .select('id,area_id,notiz,area:inventory_areas!inner(name,location:locations!inner(id,name,tenant_id))')
    .eq('id', id)
    .eq('assigned_to', employee.id)
    .eq('area.location.tenant_id', employee.tenant_id)
    .is('abgeschlossen_am', null)
    .maybeSingle();

  if (!session?.area_id) notFound();

  const { data: itemData, error } = await service
    .from('inventory_items')
    .select('id,name,einheit,zähl_typ,zähl_einheit,zähl_faktor,fach_position,shelf:inventory_shelves(name),area:inventory_areas!inner(location:locations!inner(tenant_id))')
    .eq('area_id', session.area_id)
    .eq('area.location.tenant_id', employee.tenant_id)
    .eq('aktiv', true)
    .order('fach_position', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw new Error(`Inventurprodukte konnten nicht geladen werden: ${error.message}`);
  const area = one(session.area as unknown as { name: string; location: { id: string; name: string } | { id: string; name: string }[] } | null);
  const location = one(area?.location ?? null);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto min-h-screen max-w-3xl pb-16">
        <header className="bg-slate-950 px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))] text-white sm:px-8">
          <Link href="/mitarbeiter" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <ArrowLeft size={18} /> Zurück zu meinem Tag
          </Link>
          <div className="mt-7 flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-400 text-slate-950"><Warehouse size={24} /></span>
            <div>
              <div className="text-xs font-bold uppercase tracking-[.15em] text-amber-300">Blind-Count</div>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{area?.name ?? 'Inventur'}</h1>
              <div className="mt-2 flex items-center gap-1.5 text-sm text-slate-300"><MapPin size={15} /> {location?.name ?? 'Lagerbereich'}</div>
            </div>
          </div>
          {session.notiz && <p className="mt-5 rounded-2xl bg-white/10 px-4 py-3 text-sm text-slate-200">Auftrag: {session.notiz}</p>}
        </header>

        <section className="px-4 pt-5 sm:px-8">
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
            <ShieldCheck className="mt-0.5 shrink-0 text-emerald-700" size={20} />
            <p className="text-sm leading-6">Der alte Bestand bleibt verborgen. Zähle jedes Produkt vollständig; gespeichert wird alles gemeinsam und erst beim Abschluss.</p>
          </div>
          <InventoryCounter sessionId={session.id} items={(itemData ?? []) as any[]} />
        </section>
      </div>
    </main>
  );
}
