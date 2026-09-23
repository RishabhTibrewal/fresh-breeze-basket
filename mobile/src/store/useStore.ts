import { create } from 'zustand';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  quantity: number;
  unit?: string;
}

export interface UserAddress {
  id?: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  is_default?: boolean;
}

interface AppState {
  // Auth state
  user: { id: string; email: string; name?: string } | null;
  token: string | null;
  setAuth: (user: { id: string; email: string; name?: string } | null, token: string | null) => void;
  logout: () => void;

  // Delivery Address
  selectedAddress: UserAddress | null;
  deliveryEstimate: { serviceable: boolean; estimated_days: number; message?: string } | null;
  setSelectedAddress: (address: UserAddress) => void;
  setDeliveryEstimate: (estimate: { serviceable: boolean; estimated_days: number; message?: string } | null) => void;

  // Cart
  cart: CartItem[];
  addToCart: (product: { id: string; name: string; price: number; image_url?: string; unit?: string }) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
}

export const useStore = create<AppState>((set: any, get: any) => ({
  user: null,
  token: null,
  setAuth: (user: any, token: any) => set({ user, token }),
  logout: () => set({ user: null, token: null, cart: [] }),

  selectedAddress: {
    street: '123 Park Avenue',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
  },
  deliveryEstimate: {
    serviceable: true,
    estimated_days: 2,
    message: 'Express Nationwide Delivery (2-3 business days)',
  },
  setSelectedAddress: (address: UserAddress) => set({ selectedAddress: address }),
  setDeliveryEstimate: (deliveryEstimate: any) => set({ deliveryEstimate }),

  cart: [],
  addToCart: (product: any) => {
    const existing = get().cart.find((item: CartItem) => item.id === product.id);
    if (existing) {
      set({
        cart: get().cart.map((item: CartItem) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        ),
      });
    } else {
      set({ cart: [...get().cart, { ...product, quantity: 1 }] });
    }
  },
  removeFromCart: (productId: string) => {
    set({ cart: get().cart.filter((item: CartItem) => item.id !== productId) });
  },
  updateQuantity: (productId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeFromCart(productId);
    } else {
      set({
        cart: get().cart.map((item: CartItem) =>
          item.id === productId ? { ...item, quantity } : item
        ),
      });
    }
  },
  clearCart: () => set({ cart: [] }),
  getCartTotal: () =>
    get().cart.reduce((sum: number, item: CartItem) => sum + item.price * item.quantity, 0),
}));
