import { create } from 'zustand';
import { api } from '@/lib/api';

interface Toy {
  toyId: number;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  ageGroup: string;
  type: string;
  permalink: string;
}

interface CartItem {
  id: string;
  user_id: string;
  toy_id: number;
  toy: Toy;
  quantity: number;
  updated_at: string;
}

interface CartResponse {
  items: CartItem[];
  subtotal: number;
}

interface CartState {
  items: CartItem[];
  subtotal: number;
  isLoading: boolean;
  error: string | null;
  itemCount: number;
  
  fetchCart: () => Promise<void>;
  addItem: (toyId: number, quantity: number) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  clearError: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  subtotal: 0,
  isLoading: false,
  error: null,
  itemCount: 0,

  fetchCart: async () => {
    const state = get();
    if (state.isLoading) return; // Prevent duplicate fetches
    
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/cart');
      const data: CartResponse = response.data.data;
      const itemCount = data.items.reduce((sum, item) => sum + item.quantity, 0);
      set({ 
        items: data.items, 
        subtotal: data.subtotal,
        itemCount,
        isLoading: false 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Greška pri učitavanju korpe', 
        isLoading: false 
      });
    }
  },

  addItem: async (toyId: number, quantity: number) => {
    set({ error: null, isLoading: true });
    try {
      await api.post('/cart', { toy_id: toyId, quantity });
      // Fetch updated cart after adding item
      const response = await api.get('/cart');
      const data: CartResponse = response.data.data;
      const itemCount = data.items.reduce((sum, item) => sum + item.quantity, 0);
      set({ 
        items: data.items, 
        subtotal: data.subtotal,
        itemCount,
        isLoading: false 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Nije uspelo dodavanje u korpu', 
        isLoading: false 
      });
      throw error;
    }
  },

  updateQuantity: async (itemId: string, quantity: number) => {
    set({ error: null, isLoading: true });
    try {
      await api.put(`/cart/${itemId}`, { quantity });
      // Fetch updated cart after updating quantity
      const response = await api.get('/cart');
      const data: CartResponse = response.data.data;
      const itemCount = data.items.reduce((sum, item) => sum + item.quantity, 0);
      set({ 
        items: data.items, 
        subtotal: data.subtotal,
        itemCount,
        isLoading: false 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Nije uspela promena količine', 
        isLoading: false 
      });
      throw error;
    }
  },

  removeItem: async (itemId: string) => {
    set({ error: null, isLoading: true });
    try {
      await api.delete(`/cart/${itemId}`);
      // Fetch updated cart after removing item
      const response = await api.get('/cart');
      const data: CartResponse = response.data.data;
      const itemCount = data.items.reduce((sum, item) => sum + item.quantity, 0);
      set({ 
        items: data.items, 
        subtotal: data.subtotal,
        itemCount,
        isLoading: false 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Nije uspelo uklanjanje artikla', 
        isLoading: false 
      });
      throw error;
    }
  },

  clearCart: async () => {
    set({ isLoading: true, error: null });
    try {
      await api.delete('/cart');
      set({ items: [], subtotal: 0, itemCount: 0, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Nije uspelo pražnjenje korpe', 
        isLoading: false 
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
