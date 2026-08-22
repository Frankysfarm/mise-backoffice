import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Sparkles } from 'lucide-react';
import { MenuEditor } from './client';
import { EmptyMenuState } from './empty-state';

export const dynamic = 'force-dynamic';

export default async function MenuPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: emp } = await sb
    .from('employees').select('location_id,tenant_id').eq('id', employee.id).maybeSingle();
  if (!emp?.location_id) redirect('/start');

  const [{ data: categories }, { data: items }, { data: tenant }] = await Promise.all([
    svc.from('menu_categories').select('*').eq('location_id', emp.location_id).order('sort_order'),
    svc.from('menu_items').select('*').eq('location_id', emp.location_id).order('sort_order'),
    svc.from('tenants').select('slug,name').eq('id', emp.tenant_id!).single(),
  ]);

  return (
    <>
      <PageHeader
        title="Menü"
        description="Kategorien und Produkte deiner Karte — wird live auf der Bestellseite angezeigt."
        actions={
          <div className="flex gap-2">
            <Link href="/menu/import">
              <Button className="gap-2 bg-matcha-900 hover:bg-matcha-800 text-white">
                <Sparkles className="h-4 w-4" /> Mit KI hochladen
              </Button>
            </Link>
            <Link href={`/order/${tenant?.slug ?? ""}`} target="_blank">
              <Button variant="outline" className="gap-2">
                Vorschau
              </Button>
            </Link>
          </div>
        }
      />
      {(items ?? []).length === 0 && (categories ?? []).length === 0 ? (
        <EmptyMenuState />
      ) : (
        <MenuEditor
          categories={(categories as any) ?? []}
          items={(items as any) ?? []}
        />
      )}
    </>
  );
}
