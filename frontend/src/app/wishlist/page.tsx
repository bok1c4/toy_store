'use client';

import { useWishlist } from '@/hooks/useWishlist';
import { useCartStore } from '@/store/cartStore';
import { Button } from '@/components/ui/button';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('sr-RS').format(amount) + ' RSD';
}

export default function WishlistPage(): JSX.Element {
  const { items, isLoading, error, removeItem, clearError } = useWishlist();
  const addToCart = useCartStore((state) => state.addItem);
  const [addingToCart, setAddingToCart] = useState<number | null>(null);

  const handleAddToCart = async (toyId: number) => {
    setAddingToCart(toyId);
    try {
      await addToCart(toyId, 1);
    } finally {
      setAddingToCart(null);
    }
  };

  if (isLoading && items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <h1 className="mb-8 font-display text-3xl font-bold text-foreground">Lista želja</h1>
          <div className="rounded-lg bg-card border border-border p-8 shadow-sm">
            <div className="flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="mb-8 font-display text-3xl font-bold text-foreground">Lista želja</h1>

        {error && (
          <div className="mb-6 rounded-lg bg-destructive/10 p-4 text-destructive">
            <div className="flex items-center justify-between">
              <span>{error}</span>
              <Button onClick={clearError} variant="destructive" size="sm">
                Zatvori
              </Button>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="rounded-lg bg-card border border-border py-16 text-center shadow-sm">
            <Heart className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
            <h2 className="mb-2 text-xl font-semibold text-foreground">Lista želja je prazna</h2>
            <p className="mb-6 text-muted-foreground">Sačuvajte omiljene igračke ovde za kasnije.</p>
            <Link href="/toys">
              <Button>Pregledaj igračke</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="overflow-hidden rounded-lg bg-card border border-border shadow-sm transition-shadow hover:shadow-md"
              >
                <Link href={`/toys/${item.toy_id}`}>
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    {item.toy.imageUrl ? (
                      <Image
                        src={item.toy.imageUrl}
                        alt={item.toy.name}
                        fill
                        className="object-cover transition-transform hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted">
                        <ShoppingCart className="h-12 w-12 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                </Link>

                <div className="p-4">
                  <Link href={`/toys/${item.toy_id}`}>
                    <h3 className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-1">
                      {item.toy.name}
                    </h3>
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.toy.type} · {item.toy.ageGroup}
                  </p>
                  <p className="mt-2 text-base font-bold text-brand-primary">
                    {formatPrice(item.toy.price)}
                  </p>

                  <div className="mt-4 flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => handleAddToCart(item.toy_id)}
                      disabled={addingToCart === item.toy_id || isLoading}
                    >
                      {addingToCart === item.toy_id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary-foreground" />
                      ) : (
                        <>
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          U korpu
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => removeItem(item.toy_id)}
                      disabled={isLoading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
