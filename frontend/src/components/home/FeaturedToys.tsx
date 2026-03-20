'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { Badge } from '@/components/ui/badge';
import type { Toy } from '@/lib/types';

function formatPrice(rsd: number): string {
  return new Intl.NumberFormat('sr-RS').format(rsd) + ' RSD';
}

interface FeaturedToysProps {
  toys: Toy[];
  isAuthenticated: boolean;
}

export function FeaturedToys({ toys, isAuthenticated }: FeaturedToysProps) {
  const { addItem: addToCart } = useCartStore();
  const { addItem: addToWishlist, removeItem: removeFromWishlist, isInWishlist } = useWishlistStore();
  const [loadingCart, setLoadingCart] = useState<number | null>(null);
  const [loadingWishlist, setLoadingWishlist] = useState<number | null>(null);

  async function handleAddToCart(toyId: number) {
    if (!isAuthenticated) return;
    setLoadingCart(toyId);
    try {
      await addToCart(toyId, 1);
    } finally {
      setLoadingCart(null);
    }
  }

  async function handleToggleWishlist(toyId: number) {
    if (!isAuthenticated) return;
    setLoadingWishlist(toyId);
    try {
      if (isInWishlist(toyId)) {
        await removeFromWishlist(toyId);
      } else {
        await addToWishlist(toyId);
      }
    } finally {
      setLoadingWishlist(null);
    }
  }

  return (
    <section className="bg-brand-bg py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="font-sans text-brand-accent font-semibold text-xs uppercase tracking-widest mb-2">
              Istaknuto
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground">
              Omiljene igračke
            </h2>
          </div>
          <Link
            href="/toys"
            className="font-sans text-sm font-semibold text-brand-primary hover:underline hidden sm:block"
          >
            Sve igračke →
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {toys.slice(0, 8).map((toy) => {
            const inWish = isInWishlist(toy.toyId);
            return (
              <div
                key={toy.toyId}
                className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-brand-primary hover:shadow-md transition-all flex flex-col"
              >
                {/* Product image */}
                <Link href={`/toys/${toy.toyId}`} className="block">
                  <div className="aspect-square bg-brand-sage overflow-hidden group-hover:opacity-90 transition-opacity relative">
                    <Image
                      src={toy.imageUrl}
                      alt={toy.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                </Link>

                <div className="p-4 flex flex-col flex-1 gap-2">
                  {/* Type badge */}
                  <Badge variant="secondary" className="self-start text-xs">
                    {toy.type.name}
                  </Badge>

                  {/* Name */}
                  <Link href={`/toys/${toy.toyId}`}>
                    <p className="font-sans text-sm font-semibold text-foreground line-clamp-2 hover:text-brand-primary transition-colors leading-snug">
                      {toy.name}
                    </p>
                  </Link>

                  {/* Age */}
                  <p className="font-sans text-xs text-muted-foreground">
                    {toy.ageGroup.name} god.
                  </p>

                  {/* Price + actions */}
                  <div className="mt-auto pt-3 border-t border-border flex items-center justify-between gap-2">
                    <p className="font-sans font-bold text-brand-primary text-sm">
                      {formatPrice(toy.price)}
                    </p>

                    <div className="flex items-center gap-1">
                      {/* Wishlist */}
                      {isAuthenticated ? (
                        <button
                          onClick={() => handleToggleWishlist(toy.toyId)}
                          disabled={loadingWishlist === toy.toyId}
                          aria-label={inWish ? 'Ukloni iz liste želja' : 'Dodaj u listu želja'}
                          className="p-1.5 rounded-lg text-base hover:bg-brand-sage transition-colors disabled:opacity-50"
                        >
                          {inWish ? '❤️' : '🤍'}
                        </button>
                      ) : null}

                      {/* Cart */}
                      {isAuthenticated ? (
                        <button
                          onClick={() => handleAddToCart(toy.toyId)}
                          disabled={loadingCart === toy.toyId}
                          aria-label="Dodaj u korpu"
                          className="p-1.5 rounded-lg text-base hover:bg-brand-sage transition-colors disabled:opacity-50"
                        >
                          {loadingCart === toy.toyId ? '⏳' : '🛒'}
                        </button>
                      ) : (
                        <Link
                          href="/login"
                          className="font-sans text-xs font-semibold text-brand-primary hover:underline"
                        >
                          Prijavi se
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 text-center sm:hidden">
          <Link
            href="/toys"
            className="inline-flex items-center gap-2 font-sans text-sm font-semibold text-brand-primary hover:underline"
          >
            Sve igračke →
          </Link>
        </div>
      </div>
    </section>
  );
}
