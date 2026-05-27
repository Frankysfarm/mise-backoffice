import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createServiceClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { TaxRatesClient, type TaxRate } from './client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Steuersätze · Mise' };

export default async function TaxRatesPage() {
  const emp = await requireManagerPlus();
  if (!emp.tenant_id) redirect('/start');
  const svc = createServiceClient();

  const { data: rates } = await svc
    .from('tax_rates')
    .select('id, name, satz, beschreibung, aktiv')
    .order('satz', { ascending: false })
    .returns<TaxRate[]>();

  return (
    <>
      <PageHeader
        title="Steuersätze"
        description="Mehrwertsteuer-Sätze für deine Speisekarte. Standard in DE: 19 % auf Getränke + Außer-Haus, 7 % auf Speisen vor Ort. Sonderregeln pro Artikel (z. B. Kaffee mit ≥ 70 % Milch = 7 %) setzt du im Artikel-Editor."
        backHref="/shop"
      />
      <TaxRatesClient initialRates={rates ?? []} />
    </>
  );
}
