'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';

export interface Toy {
  toyId: number;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  ageGroup: string;
  type: string;
  permalink: string;
}

interface ToyCardProps {
  toy: Toy;
  onAddToCart?: (toyId: number, quantity?: number) => void | Promise<void>;
  onAddToWishlist?: (toyId: number) => void | Promise<void>;
  onRemoveFromWishlist?: (toyId: number) => void | Promise<void>;
  isInWishlist?: boolean;
}

export function ToyCard({
  toy,
  onAddToCart,
  onAddToWishlist,
  onRemoveFromWishlist,
  isInWishlist = false,
}: ToyCardProps): JSX.Element {
  const { isAuthenticated } = useAuth();
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isUpdatingWishlist, setIsUpdatingWishlist] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);
  const [wishlistSuccess, setWishlistSuccess] = useState(false);

  const handleWishlistClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) return;
    if (isUpdatingWishlist) return;

    setIsUpdatingWishlist(true);
    try {
      if (isInWishlist && onRemoveFromWishlist) {
        await onRemoveFromWishlist(toy.toyId);
      } else if (onAddToWishlist) {
        await onAddToWishlist(toy.toyId);
        setWishlistSuccess(true);
        setTimeout(() => setWishlistSuccess(false), 1500);
      }
    } finally {
      setIsUpdatingWishlist(false);
    }
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated || !onAddToCart || isAddingToCart) return;

    setIsAddingToCart(true);
    try {
      await onAddToCart(toy.toyId, 1);
      setCartSuccess(true);
      setTimeout(() => setCartSuccess(false), 1500);
    } finally {
      setIsAddingToCart(false);
    }
  };

  const formatPrice = (price: number): string =>
    new Intl.NumberFormat('sr-RS').format(price) + ' RSD';

  return (
    <Link href={`/toys/${toy.toyId}`} className="block">
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md relative">
        {cartSuccess && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg font-medium">
              Dodato u korpu!
            </div>
          </div>
        )}

        <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
          <img
            src={toy.imageUrl}
            alt={toy.name}
            className="h-full w-full object-cover"
          />
          {isAuthenticated && (
            <button
              onClick={handleWishlistClick}
              disabled={isUpdatingWishlist}
              className={`absolute right-2 top-2 rounded-full p-2 shadow-md transition-all transform ${
                isInWishlist
                  ? 'bg-destructive text-destructive-foreground'
                  : 'bg-card text-muted-foreground hover:bg-muted'
              } ${isUpdatingWishlist ? 'cursor-wait opacity-70' : ''} ${wishlistSuccess ? 'scale-110' : ''}`}
              title={isInWishlist ? 'Ukloni iz liste želja' : 'Dodaj u listu želja'}
            >
              {isUpdatingWishlist ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
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
          )}
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{toy.type}</span>
            <span className="text-xs font-medium text-muted-foreground">{toy.ageGroup}</span>
          </div>

          <h3 className="line-clamp-2 text-sm font-semibold text-foreground">
            {toy.name}
          </h3>

          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-brand-primary">
              {formatPrice(toy.price)}
            </span>
            {isAuthenticated && (
              <button
                onClick={handleAddToCart}
                disabled={isAddingToCart}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                  cartSuccess
                    ? 'bg-primary text-primary-foreground scale-105'
                    : isAddingToCart
                    ? 'cursor-wait bg-primary/60 text-primary-foreground'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
                title="Dodaj u korpu"
              >
                {isAddingToCart ? 'Dodaje...' : cartSuccess ? 'Dodato!' : 'U korpu'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
