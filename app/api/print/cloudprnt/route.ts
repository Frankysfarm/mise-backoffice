import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function locId(token: string | null): Promise<string | null> {
  if (!token) return null;
  const svc = createServiceClient();
  const { data } = await svc.from('locations').select('id').eq('kitchen_token', token).maybeSingle();
  return (data?.id as string) ?? null;
}

// Drucker fragt: Job bereit?
export async function POST(req: NextRequest) {
  const id = await locId(req.nextUrl.searchParams.get('token'));
  if (!id) return NextResponse.json({ jobReady: false });
  const svc = createServiceClient();
  const { data } = await svc.from('mise_print_jobs').select('id').eq('location_id', id).eq('status', 'queued').limit(1);
  return NextResponse.json({ jobReady: (data?.length ?? 0) > 0, mediaTypes: ['text/plain'] });
}

// Drucker holt den Job (als text/plain) -> markiert printing
export async function GET(req: NextRequest) {
  const id = await locId(req.nextUrl.searchParams.get('token'));
  if (!id) return new NextResponse('', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  const svc = createServiceClient();
  const { data } = await svc.from('mise_print_jobs').select('id, payload').eq('location_id', id).eq('status', 'queued').order('created_at', { ascending: true }).limit(1);
  const job = data?.[0];
  if (!job) return new NextResponse('', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  await svc.from('mise_print_jobs').update({ status: 'printing' }).eq('id', job.id);
  return new NextResponse((job.payload as string) ?? '', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

// Drucker bestaetigt -> done
export async function DELETE(req: NextRequest) {
  const id = await locId(req.nextUrl.searchParams.get('token'));
  if (!id) return new NextResponse('', { status: 200 });
  const svc = createServiceClient();
  const { data } = await svc.from('mise_print_jobs').select('id').eq('location_id', id).eq('status', 'printing').order('created_at', { ascending: true }).limit(1);
  if (data?.[0]) await svc.from('mise_print_jobs').update({ status: 'done' }).eq('id', data[0].id);
  return new NextResponse('', { status: 200 });
}
