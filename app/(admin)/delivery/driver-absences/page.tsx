import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { DriverAbsencesClient } from './client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Fahrer-Abwesenheiten' };

export default async function DriverAbsencesPage() {
  await requireManagerPlus().catch(() => redirect('/login'));
  return <DriverAbsencesClient />;
}
