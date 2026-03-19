import { useEffect } from 'react';
import { useWishlistStore } from '@/store/wishlistStore';
import { useAuth } from '@/hooks/useAuth';

export function useWishlist() {
  const { isAuthenticated } = useAuth();
  const {
    items,
    isLoading,
    error,
    fetchWishlist,
    addItem,
    removeItem,
    isInWishlist,
    clearError,
  } = useWishlistStore();

  // Only fetch wishlist when the user is logged in
  useEffect(() => {
    if (isAuthenticated) {
      fetchWishlist();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  return {
    items,
    isLoading,
    error,
    fetchWishlist,
    addItem,
    removeItem,
    isInWishlist,
    clearError,
  };
}
