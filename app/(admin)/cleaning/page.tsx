import { redirect } from 'next/navigation';
import { operationsBasePath } from '@/lib/routing/operations-base-path';

/** Konsolidiert (Owner-Auftrag 04.09.): Checklisten & Reinigung leben jetzt im Listen-Builder. */
export default async function LegacyRedirect() {
  redirect(await operationsBasePath('/shift-guides', '/neo/app/ablaeufe/schichtleitfaeden'));
}
