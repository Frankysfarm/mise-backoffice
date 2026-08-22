import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lokaler QR-Generator — kein externer Dienst.
 * Wird vom POS-Success-Screen genutzt (Kunde scannt → Bon auf Handy).
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return new NextResponse('Missing url', { status: 400 });

  const size = Number(req.nextUrl.searchParams.get('size') ?? '300');

  try {
    const svg = await QRCode.toString(url, {
      type: 'svg',
      margin: 1,
      width: Math.max(100, Math.min(800, size)),
      color: { dark: '#0d1f16', light: '#ffffff' },
    });
    return new NextResponse(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return new NextResponse('QR gen failed', { status: 500 });
  }
}
