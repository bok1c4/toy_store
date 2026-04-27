'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

function decodeJWT(token: string): { role?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1]));
  } catch {
    return null;
  }
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const token = document.cookie
      .split('; ')
      .find((c) => c.startsWith('access_token='))
      ?.split('=')[1];

    if (!token) {
      router.replace('/login');
      return;
    }

    const payload = decodeJWT(token);
    if (payload?.role !== 'admin') {
      router.replace('/forbidden');
      return;
    }

    setAuthorized(true);
  }, [router]);

  if (!authorized) return null;

  const navLinks = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/analytics', label: 'Analitika' },
    { href: '/admin/users', label: 'Korisnici' },
    { href: '/admin/orders', label: 'Porudžbine' },
    { href: '/admin/cancellation-requests', label: 'Otkazivanja' },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-56 flex-shrink-0 border-r border-border bg-card px-4 py-8">
        <h2 className="mb-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Admin
        </h2>
        <nav className="space-y-1">
          {navLinks.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
