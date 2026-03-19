'use client';

import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import { Trash2, Minus, Plus, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('sr-RS').format(amount) + ' RSD';
}

export default function CartPage(): JSX.Element {
  const { items, subtotal, isLoading, error, updateQuantity, removeItem, clearError } = useCart();

  if (isLoading && items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <h1 className="mb-8 font-display text-3xl font-bold text-foreground">Korpa</h1>
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
        <h1 className="mb-8 font-display text-3xl font-bold text-foreground">Korpa</h1>

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
            <ShoppingCart className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
            <h2 className="mb-2 text-xl font-semibold text-foreground">Vaša korpa je prazna</h2>
            <p className="mb-6 text-muted-foreground">Još uvek niste dodali nijednu igračku.</p>
            <Link href="/toys">
              <Button>Pregledaj igračke</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="rounded-lg bg-card border border-border shadow-sm">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className={`flex gap-4 p-4 ${index !== items.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                      {item.toy.imageUrl ? (
                        <Image
                          src={item.toy.imageUrl}
                          alt={item.toy.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted">
                          <ShoppingCart className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <Link href={`/toys/${item.toy_id}`}>
                          <h3 className="font-semibold text-foreground hover:text-primary transition-colors">
                            {item.toy.name}
                          </h3>
                        </Link>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.toy.type} · {item.toy.ageGroup}
                        </p>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              if (item.quantity > 1) updateQuantity(item.id, item.quantity - 1);
                            }}
                            disabled={isLoading}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-medium text-foreground">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            disabled={isLoading}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="font-semibold text-brand-primary">
                            {formatPrice(item.toy.price * item.quantity)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => removeItem(item.id)}
                            disabled={isLoading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-4 rounded-lg bg-card border border-border p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-foreground">Pregled porudžbine</h2>

                <div className="space-y-2 border-b border-border pb-4">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Međuzbir</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Dostava</span>
                    <span>Izračunava se na naplati</span>
                  </div>
                </div>

                <div className="mt-4 flex justify-between text-lg font-semibold text-foreground">
                  <span>Ukupno</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>

                <Link href="/checkout">
                  <Button className="mt-6 w-full" size="lg" disabled={isLoading}>
                    Nastavi na naplatu
                  </Button>
                </Link>

                <Link href="/toys">
                  <Button variant="outline" className="mt-3 w-full" disabled={isLoading}>
                    Nastavi kupovinu
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
