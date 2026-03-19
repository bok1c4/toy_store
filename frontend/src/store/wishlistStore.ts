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

interface WishlistItem {
  id: string;
  user_id: string;
  toy_id: number;
  toy: Toy;
  created_at: string;
}

interface WishlistState {
  items: WishlistItem[];
  isLoading: boolean;
  error: string | null;
  
  fetchWishlist: () => Promise<void>;
  addItem: (toyId: number) => Promise<void>;
  removeItem: (toyId: number) => Promise<void>;
  isInWishlist: (toyId: number) => boolean;
  clearError: () => void;
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  items: [],
  isLoading: false,
  error: null,

  fetchWishlist: async () => {
    const state = get();
    if (state.isLoading) return; // Prevent duplicate fetches
    
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/wishlist');
      const data: WishlistItem[] = response.data.data;
      set({ items: data, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Greška pri učitavanju liste želja', 
        isLoading: false 
      });
    }
  },

  addItem: async (toyId: number) => {
    set({ error: null, isLoading: true });
    try {
      await api.post('/wishlist', { toy_id: toyId });
      // Fetch updated wishlist after adding item
      const response = await api.get('/wishlist');
      const data: WishlistItem[] = response.data.data;
      set({ items: data, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Nije uspelo dodavanje u listu želja', 
        isLoading: false 
      });
      throw error;
    }
  },

  removeItem: async (toyId: number) => {
    set({ error: null, isLoading: true });
    try {
      await api.delete(`/wishlist/${toyId}`);
      // Remove item from local state immediately
      set((state) => ({
        items: state.items.filter((item) => item.toy_id !== toyId),
        isLoading: false,
      }));
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Nije uspelo uklanjanje iz liste želja', 
        isLoading: false 
      });
      throw error;
    }
  },

  isInWishlist: (toyId: number) => {
    return get().items.some((item) => item.toy_id === toyId);
  },

  clearError: () => set({ error: null }),
}));
