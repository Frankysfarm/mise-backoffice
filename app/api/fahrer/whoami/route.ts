import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ isDriver: false });

  const svc = createServiceClient();
  const { data: drv } = await svc
    .from('employees')
    .select('id')
    .eq('auth_user_id', user.id)
    .eq('kann_ausliefern', true)
    .maybeSingle();

  return NextResponse.json({ isDriver: !!drv });
}
