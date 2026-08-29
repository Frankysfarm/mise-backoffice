import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
  return NextResponse.json({
    error: 'Die separate Mise-OS-Anmeldung wurde abgeschaltet. Alle Module laufen nativ in Neo.',
    redirect: '/neo',
  }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}
