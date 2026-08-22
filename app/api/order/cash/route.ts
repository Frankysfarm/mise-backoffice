import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function retired() {
  return NextResponse.json(
    { error: 'Dieser unsichere Legacy-Bestellweg ist stillgelegt. Bitte den aktuellen Tischbestell-Checkout verwenden.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
}

export const GET = retired;
export const POST = retired;
export const PUT = retired;
export const PATCH = retired;
export const DELETE = retired;
