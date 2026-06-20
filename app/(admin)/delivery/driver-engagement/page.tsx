import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { DriverEngagementClient } from './client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Fahrer-Engagement Engine' };

export default async function DriverEngagementPage() {
  await requireManagerPlus().catch(() => redirect('/login'));
  return <DriverEngagementClient />;
}
