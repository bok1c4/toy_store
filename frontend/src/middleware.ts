import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function decodeJWT(token: string): { user_id?: string; role?: string; exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const payload = parts[1];
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return true;
  }
  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes and static files
  if (pathname.startsWith('/api/') || 
      pathname.startsWith('/_next/') || 
      pathname.startsWith('/static/') || 
      pathname.includes('.')) {
    return NextResponse.next();
  }

  // Handle login/register redirect
  if (pathname === '/login' || pathname === '/register') {
    const token = request.cookies.get('access_token')?.value;
    if (token && !isTokenExpired(token)) {
      return NextResponse.redirect(new URL('/toys', request.url));
    }
    return NextResponse.next();
  }

  // Check admin routes
  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get('access_token')?.value;
    if (!token || isTokenExpired(token)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    const payload = decodeJWT(token);
    if (payload?.role !== 'admin') {
      return NextResponse.redirect(new URL('/forbidden', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
