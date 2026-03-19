import { useEffect } from 'react';
import { useCartStore } from '@/store/cartStore';

export function useCart() {
  const {
    items,
    subtotal,
    isLoading,
    error,
    itemCount,
    fetchCart,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    clearError,
  } = useCartStore();

  // Fetch cart on mount
  useEffect(() => {
    fetchCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    items,
    subtotal,
    isLoading,
    error,
    itemCount,
    fetchCart,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    clearError,
  };
}
