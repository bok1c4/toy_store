'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { Toy } from '@/components/toys/ToyCard';

interface ToyResponse {
  data: Toy;
}

export default function ToyDetailPage(): JSX.Element {
  const params = useParams();
  const toyId = Number(params.id);
  
  const { isAuthenticated } = useAuth();
  const addToCart = useCartStore((state) => state.addItem);
  const addToWishlist = useWishlistStore((state) => state.addItem);
  const removeFromWishlist = useWishlistStore((state) => state.removeItem);
  const wishlistItems = useWishlistStore((state) => state.items);
  
  const [toy, setToy] = useState<Toy | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isUpdatingWishlist, setIsUpdatingWishlist] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);

  const isInWishlist = wishlistItems.some((item) => item.toy_id === toyId);

  useEffect(() => {
    const fetchToy = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.get<ToyResponse>(`/toys/${toyId}`);
        setToy(response.data.data);
      } catch (err) {
        setError('Igračka nije dostupna. Proverite kasnije.');
      } finally {
        setIsLoading(false);
      }
    };

    if (toyId) {
      fetchToy();
    }
  }, [toyId]);

  const handleAddToCart = async () => {
    if (!isAuthenticated || !toy) {
      return;
    }
    
    setIsAddingToCart(true);
    try {
      await addToCart(toy.toyId, quantity);
      setCartSuccess(true);
      setTimeout(() => setCartSuccess(false), 2000);
    } catch {
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleAddToWishlist = async () => {
    if (!isAuthenticated || !toy) {
      return;
    }
    
    setIsUpdatingWishlist(true);
    try {
      if (isInWishlist) {
        await removeFromWishlist(toy.toyId);
      } else {
        await addToWishlist(toy.toyId);
      }
    } catch {
    } finally {
      setIsUpdatingWishlist(false);
    }
  };

  const formatPrice = (price: number): string =>
    new Intl.NumberFormat('sr-RS').format(price) + ' RSD';

  const handleRetry = () => {
    window.location.reload();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="animate-pulse">
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="aspect-square rounded-lg bg-muted" />
              <div className="space-y-4">
                <div className="h-8 w-3/4 rounded bg-muted" />
                <div className="h-6 w-1/4 rounded bg-muted" />
                <div className="h-24 w-full rounded bg-muted" />
                <div className="h-12 w-1/3 rounded bg-muted" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !toy) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="rounded-lg bg-destructive/10 p-6 text-destructive">
            <h2 className="text-lg font-semibold">Greška pri učitavanju igračke</h2>
            <p className="mt-2">{error || 'Igračka nije pronađena.'}</p>
            <div className="mt-4 flex gap-4">
              <button
                onClick={handleRetry}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90"
              >
                Pokušaj ponovo
              </button>
              <Link
                href="/toys"
                className="rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                Nazad na katalog
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <Link href="/toys" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mr-1 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Nazad na katalog
        </Link>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="aspect-square overflow-hidden rounded-lg bg-card border border-border shadow-sm relative">
            <Image
              src={toy.imageUrl}
              alt={toy.name}
              fill
              className="object-cover"
            />
          </div>

          <div className="flex flex-col">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-brand-sage px-3 py-1 text-xs font-medium text-brand-primary">
                {toy.type}
              </span>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {toy.ageGroup}
              </span>
            </div>

            <h1 className="mb-4 font-display text-3xl font-bold text-foreground">{toy.name}</h1>

            <p className="mb-6 text-3xl font-bold text-brand-primary">{formatPrice(toy.price)}</p>

            <div className="mb-6">
              <h2 className="mb-2 text-lg font-semibold text-foreground">Opis</h2>
              <p className="text-muted-foreground">{toy.description}</p>
            </div>

            <div className="mt-auto space-y-4">
              <div>
                <label htmlFor="quantity" className="mb-2 block text-sm font-medium text-foreground">
                  Količina
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="rounded-md border border-input px-3 py-2 hover:bg-muted transition-colors"
                    disabled={quantity <= 1}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <input
                    id="quantity"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 rounded-md border border-input bg-background px-3 py-2 text-center text-foreground"
                  />
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    className="rounded-md border border-input px-3 py-2 hover:bg-muted transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleAddToCart}
                  disabled={isAddingToCart}
                  className={`flex-1 rounded-lg px-6 py-3 text-lg font-medium transition-all ${
                    cartSuccess
                      ? 'bg-primary text-primary-foreground'
                      : isAddingToCart
                      ? 'bg-primary/60 text-primary-foreground cursor-wait'
                      : isAuthenticated
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }`}
                >
                  {isAddingToCart ? 'Dodaje...' : cartSuccess ? 'Dodato!' : isAuthenticated ? 'Dodaj u korpu' : 'Prijavite se za kupovinu'}
                </button>
                <button
                  onClick={handleAddToWishlist}
                  disabled={!isAuthenticated || isUpdatingWishlist}
                  className={`rounded-lg border-2 px-4 py-3 transition-all ${
                    isInWishlist
                      ? 'bg-destructive border-destructive text-destructive-foreground'
                      : isAuthenticated && !isUpdatingWishlist
                      ? 'border-border text-foreground hover:border-destructive hover:text-destructive'
                      : 'cursor-not-allowed border-border text-muted-foreground'
                  }`}
                  title={!isAuthenticated ? 'Prijavite se za listu želja' : isInWishlist ? 'Ukloni iz liste želja' : 'Dodaj u listu želja'}
                >
                  {isUpdatingWishlist ? (
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill={isInWishlist ? 'currentColor' : 'none'}
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
