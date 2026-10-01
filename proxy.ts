import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ─────────────────────────────────────────────────────────────────────────────
// Proxy — Internal Tool Route Guard
//
// Single login page at /login. No public pages.
//
//   /customer/*   → redirect (admin → /admin, unauthenticated → /login)
//   /admin/login  → retired, redirect to /login
// ─────────────────────────────────────────────────────────────────────────────
export default auth((req: NextRequest & { auth: any }) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const isAdmin = session && session.user?.role === 'admin';

  // /customer/* — old customer-facing shell, should never be visited directly
  if (pathname.startsWith('/customer')) {
    return NextResponse.redirect(
      new URL(isAdmin ? '/admin' : '/login', req.url)
    );
  }

  // /admin/login — retired in favour of single /login page
  if (pathname === '/admin/login') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/customer/:path*', '/admin/login'],
};
