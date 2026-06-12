import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getDriverActiveChallenges } from '@/lib/delivery/challenges';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serviceSb = createServiceClient();
  const { data: emp } = await serviceSb
    .from('employees')
    .select('id, tenant_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!emp?.tenant_id) return NextResponse.json({ challenges: [] });

  const { data: driver } = await serviceSb
    .from('mise_drivers')
    .select('id')
    .eq('employee_id', emp.id)
    .maybeSingle();

  if (!driver) return NextResponse.json({ challenges: [] });

  const challenges = await getDriverActiveChallenges(
    driver.id as string,
    emp.tenant_id as string,
  );
  return NextResponse.json({ challenges });
}
