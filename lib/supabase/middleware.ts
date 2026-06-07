import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  const reqHeaders = new Headers(request.headers);
  reqHeaders.set('x-pathname', request.nextUrl.pathname);
  let response = NextResponse.next({ request: { headers: reqHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Bereits installierte Native-App hat /pos/terminal als Start-URL
  // gebaked → leite zur neuen Auswahl-Seite, ohne Auth-Check.
  if (pathname === '/pos/terminal' || pathname === '/pos/start') {
    const url = request.nextUrl.clone();
    url.pathname = '/apps';
    return NextResponse.redirect(url);
  }

  const isPublic =
    pathname === '/login' ||
    pathname === '/delivery-progress' ||
    pathname === '/start' ||
    pathname === '/use-case' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/register/') ||
    pathname.startsWith('/api/register/') ||
    pathname === '/welcome' ||
    pathname.startsWith('/welcome/') ||
    pathname === '/datenschutz' ||
    pathname === '/impressum' ||
    pathname === '/agb' ||
    pathname.startsWith('/datenschutz/') ||
    pathname.startsWith('/impressum/') ||
    pathname.startsWith('/agb/') ||
    pathname === '/biss-app' ||
    pathname.startsWith('/biss-app/') ||
    pathname === '/fahrer' ||
    pathname.startsWith('/fahrer/') ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/sw-customer.js' ||
    pathname.startsWith('/api/push/') ||
    pathname === '/api/drivers/push/send' ||
    pathname === '/api/pos/z-report/auto' ||
    pathname === '/api/pos/backup/worm' ||
    pathname.startsWith('/fahrer-icon') ||
    pathname.startsWith('/track/') ||
    pathname.startsWith('/order/') ||
    pathname.startsWith('/t/') ||
    pathname.startsWith('/here/') ||
    pathname.startsWith('/bon/') ||
    pathname.startsWith('/pruefung/') ||
    pathname.startsWith('/api/pruefung/') ||
    pathname.startsWith('/kitchen/display/') ||
    pathname === '/kitchen/pair' ||
    pathname === '/pos/pair' ||
    pathname.startsWith('/kitchen/device/') ||
    pathname.startsWith('/api/pos/tables/') ||
    pathname.startsWith('/api/pos/qr') ||
    pathname.startsWith('/api/pos/bon/') ||
    pathname.startsWith('/api/orders/external') ||
    pathname.startsWith('/api/signup/') ||
    pathname === '/signup' ||
    pathname === '/api/auth/signup' ||
    pathname === '/api/auth/google-signup-finish' ||
    pathname === '/api/voice-orders/webhook/elevenlabs' ||
    pathname.startsWith('/api/stripe/webhook') ||
    pathname.startsWith('/api/vouchers/') ||
    pathname.startsWith('/api/email/process-outbox') ||
    pathname.startsWith('/api/checkout/') ||
    pathname.startsWith('/go/') ||
    pathname.startsWith('/api/qr/') ||
    pathname === '/unsubscribe' ||
    pathname.startsWith('/api/track/') ||
    pathname.startsWith('/api/driver/v1/') ||
    pathname === '/apps' || pathname === '/driver' || pathname.startsWith('/driver/') || pathname === '/lieferdienst' || pathname.startsWith('/lieferdienst/') || pathname.startsWith('/api/lieferdienst/') || pathname.startsWith('/api/driver-app/') || pathname === '/pos/terminal-v5' || pathname.startsWith('/pos/terminal-v5/');

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    // Root → Landing-Page für Neukunden; alles andere → Login
    if (pathname === '/') {
      url.pathname = '/welcome';
    } else {
      url.pathname = '/login';
      url.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(url);
  }

  if (user && !isPublic) {
    const { data: emp } = await supabase.from('employees')
      .select('id,rolle,muss_passwort_aendern')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    // Force Password-Change wenn Flag gesetzt
    if (emp?.muss_passwort_aendern &&
        !pathname.startsWith('/auth/change-password') &&
        !pathname.startsWith('/api/auth/change-password')) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/change-password';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }

    // Backoffice-Zugriff: nur Hierarchie-Rollen.
    // POS-Bereich (Kassieren, Bestelleingang, Küche): alle eingeloggten Mitarbeiter
    // damit Kellner, Service-Personal und Kiosk-Accounts arbeiten können.
    const backofficeRoles = ['manager', 'backoffice', 'admin'];
    const posRoles = [
      'mitarbeiter', 'teamleiter', 'manager', 'backoffice', 'admin',
      'server', 'bartender', 'cook', 'dishwasher',
    ];
    const isPosArea =
      pathname === '/pos' ||
      pathname.startsWith('/pos/') ||
      pathname.startsWith('/api/pos/') ||
      pathname.startsWith('/api/printer') ||
      pathname.startsWith('/api/kitchen/') ||
      pathname === '/auth/signout';
    const allowedForPath = isPosArea ? posRoles : backofficeRoles;
    if (!emp || !allowedForPath.includes(emp.rolle)) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('reason', 'no_access');
      return NextResponse.redirect(url);
    }
    response.headers.set('x-employee-id', emp.id);
    response.headers.set('x-employee-role', emp.rolle);
  }

  return response;
}
