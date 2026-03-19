'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ShoppingCart, Heart, Menu, X } from 'lucide-react';

export function Navbar() {
  const { user, isAuthenticated, isLoading, logout, isAdmin } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const itemCount = useCartStore((state) => state.itemCount);
  const fetchCart = useCartStore((state) => state.fetchCart);
  const fetchWishlist = useWishlistStore((state) => state.fetchWishlist);

  useEffect(() => {
    if (isAuthenticated) {
      fetchCart();
      fetchWishlist();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  return (
    <nav className="bg-background border-b border-border sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="font-display text-xl font-bold text-primary">
            Prodavnica igračaka
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            <Link
              href="/toys"
              className="font-sans text-sm font-medium text-foreground hover:text-primary hover:bg-muted px-3 py-2 rounded-lg transition-colors"
            >
              Igračke
            </Link>
            {isAuthenticated && (
              <>
                <Link
                  href="/cart"
                  className="relative font-sans text-sm font-medium text-foreground hover:text-primary hover:bg-muted px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Korpa
                  {itemCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {itemCount > 9 ? '9+' : itemCount}
                    </span>
                  )}
                </Link>
                <Link
                  href="/wishlist"
                  className="font-sans text-sm font-medium text-foreground hover:text-primary hover:bg-muted px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Heart className="h-4 w-4" />
                  Lista želja
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="font-sans text-sm font-medium text-foreground hover:text-primary hover:bg-muted px-3 py-2 rounded-lg transition-colors"
                  >
                    Admin
                  </Link>
                )}
              </>
            )}
          </div>

          {/* Desktop right */}
          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            {isLoading ? (
              <div className="w-20 h-8 bg-muted animate-pulse rounded-lg" />
            ) : isAuthenticated ? (
              <>
                <Link
                  href="/profile"
                  className="font-sans text-sm font-medium text-foreground hover:text-primary hover:bg-muted px-3 py-2 rounded-lg transition-colors"
                >
                  {user?.username}
                </Link>
                <button
                  onClick={logout}
                  className="font-sans text-sm font-medium text-foreground hover:text-primary hover:bg-muted px-3 py-2 rounded-lg transition-colors"
                >
                  Odjava
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="font-sans text-sm font-medium text-foreground hover:text-primary hover:bg-muted px-3 py-2 rounded-lg transition-colors"
                >
                  Prijava
                </Link>
                <Link
                  href="/register"
                  className="font-sans text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-full transition-colors"
                >
                  Registracija
                </Link>
              </>
            )}
          </div>

          {/* Mobile: theme toggle + hamburger */}
          <div className="flex md:hidden items-center gap-1">
            <ThemeToggle />
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-lg text-foreground hover:bg-muted transition-colors"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="px-4 py-3 space-y-1">
            <Link
              href="/toys"
              onClick={() => setIsMenuOpen(false)}
              className="block font-sans text-sm font-medium text-foreground hover:text-primary hover:bg-muted px-3 py-2 rounded-lg transition-colors"
            >
              Igračke
            </Link>
            {isAuthenticated && (
              <>
                <Link
                  href="/cart"
                  onClick={() => setIsMenuOpen(false)}
                  className="block font-sans text-sm font-medium text-foreground hover:text-primary hover:bg-muted px-3 py-2 rounded-lg transition-colors"
                >
                  Korpa {itemCount > 0 && `(${itemCount})`}
                </Link>
                <Link
                  href="/wishlist"
                  onClick={() => setIsMenuOpen(false)}
                  className="block font-sans text-sm font-medium text-foreground hover:text-primary hover:bg-muted px-3 py-2 rounded-lg transition-colors"
                >
                  Lista želja
                </Link>
                <Link
                  href="/profile"
                  onClick={() => setIsMenuOpen(false)}
                  className="block font-sans text-sm font-medium text-foreground hover:text-primary hover:bg-muted px-3 py-2 rounded-lg transition-colors"
                >
                  Profil
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setIsMenuOpen(false)}
                    className="block font-sans text-sm font-medium text-foreground hover:text-primary hover:bg-muted px-3 py-2 rounded-lg transition-colors"
                  >
                    Admin
                  </Link>
                )}
                <button
                  onClick={() => { logout(); setIsMenuOpen(false); }}
                  className="w-full text-left font-sans text-sm font-medium text-foreground hover:text-primary hover:bg-muted px-3 py-2 rounded-lg transition-colors"
                >
                  Odjava
                </button>
              </>
            )}
            {!isAuthenticated && !isLoading && (
              <>
                <Link
                  href="/login"
                  onClick={() => setIsMenuOpen(false)}
                  className="block font-sans text-sm font-medium text-foreground hover:text-primary hover:bg-muted px-3 py-2 rounded-lg transition-colors"
                >
                  Prijava
                </Link>
                <Link
                  href="/register"
                  onClick={() => setIsMenuOpen(false)}
                  className="block font-sans text-sm font-medium text-foreground hover:text-primary hover:bg-muted px-3 py-2 rounded-lg transition-colors"
                >
                  Registracija
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
