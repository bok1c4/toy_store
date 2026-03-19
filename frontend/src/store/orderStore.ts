import { create } from 'zustand';
import { api } from '@/lib/api';
import { extractApiError } from '@/lib/errors';

interface OrderItem {
  id: string;
  order_id: string;
  toy_id: number;
  toy_name: string;
  toy_image_url: string;
  price_at_purchase: number;
  quantity: number;
}

interface Order {
  id: string;
  user_id: string;
  status: string;
  payment_status: string;
  total_amount: number;
  shipping_address: string;
  cancellation_requested: boolean;
  cancellation_reason?: string;
  cancellation_approved?: boolean;
  cancellation_response?: string;
  created_at: string;
  updated_at: string;
}

interface OrderWithItems extends Order {
  items: OrderItem[];
}

interface CheckoutResponse {
  data: OrderWithItems;
}

interface PaymentIntentResponse {
  data: {
    client_secret: string;
    payment_intent_id: string;
    total_amount: number;
  };
}

interface OrdersListResponse {
  data: OrderWithItems[];
  total: number;
  page: number;
  per_page: number;
}

interface OrderState {
  orders: OrderWithItems[];
  currentOrder: OrderWithItems | null;
  isLoading: boolean;
  error: string | null;
  totalOrders: number;
  currentPage: number;
  perPage: number;

  fetchOrders: (page?: number, perPage?: number) => Promise<void>;
  fetchOrderById: (orderId: string) => Promise<void>;
  checkout: (shippingAddress: string, simulateFailure?: boolean) => Promise<OrderWithItems>;
  createPaymentIntent: () => Promise<{ clientSecret: string; paymentIntentId: string; totalAmount: number }>;
  confirmCheckout: (paymentIntentId: string, shippingAddress: string) => Promise<OrderWithItems>;
  requestCancellation: (orderId: string, reason: string) => Promise<void>;
  clearError: () => void;
  clearCurrentOrder: () => void;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  currentOrder: null,
  isLoading: false,
  error: null,
  totalOrders: 0,
  currentPage: 1,
  perPage: 10,

  fetchOrders: async (page = 1, perPage = 10) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/user/orders', {
        params: { page, per_page: perPage }
      });
      const data: OrdersListResponse = response.data;
      set({
        orders: data.data,
        totalOrders: data.total,
        currentPage: data.page,
        perPage: data.per_page,
        isLoading: false
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Greška pri učitavanju porudžbina',
        isLoading: false
      });
    }
  },

  fetchOrderById: async (orderId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/user/orders/${orderId}`);
      const data = response.data.data as OrderWithItems;
      set({ currentOrder: data, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Greška pri učitavanju porudžbine',
        isLoading: false
      });
    }
  },

  checkout: async (shippingAddress: string, simulateFailure = false) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/checkout', {
        shipping_address: shippingAddress,
        simulate_failure: simulateFailure
      });
      const data: CheckoutResponse = response.data;
      set({ currentOrder: data.data, isLoading: false });
      return data.data;
    } catch (error: unknown) {
      set({ error: extractApiError(error, 'Naplata nije uspela'), isLoading: false });
      throw error;
    }
  },

  createPaymentIntent: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/checkout/intent');
      const data: PaymentIntentResponse = response.data;
      set({ isLoading: false });
      return {
        clientSecret: data.data.client_secret,
        paymentIntentId: data.data.payment_intent_id,
        totalAmount: data.data.total_amount,
      };
    } catch (error: unknown) {
      set({ error: extractApiError(error, 'Nije uspelo kreiranje payment intent'), isLoading: false });
      throw error;
    }
  },

  confirmCheckout: async (paymentIntentId: string, shippingAddress: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/checkout/confirm', {
        payment_intent_id: paymentIntentId,
        shipping_address: shippingAddress,
      });
      const data: CheckoutResponse = response.data;
      set({ currentOrder: data.data, isLoading: false });
      return data.data;
    } catch (error: unknown) {
      set({ error: extractApiError(error, 'Potvrda naplate nije uspela'), isLoading: false });
      throw error;
    }
  },

  requestCancellation: async (orderId: string, reason: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/user/orders/${orderId}/cancel`, { reason });
      await get().fetchOrders(get().currentPage, get().perPage);
      set({ isLoading: false });
    } catch (error: unknown) {
      set({ error: extractApiError(error, 'Nije uspelo slanje zahteva za otkazivanje'), isLoading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
  clearCurrentOrder: () => set({ currentOrder: null }),
}));
