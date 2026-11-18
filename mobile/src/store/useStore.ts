import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';
import { registerForPushNotificationsAsync } from '../utils/notifications';

export interface CartItem {
  id: string; // product_id
  backend_cart_item_id?: string;
  name: string;
  price: number;
  original_price?: number;
  image_url?: string;
  quantity: number;
  unit?: string;
  category?: string;
  variant_id?: string;
  description?: string;
}

export interface UserAddress {
  id: string;
  title: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  is_default?: boolean;
}

export interface ProductVariantItem {
  id: string;
  name: string;
  unit: string;
  price: number;
  original_price?: number;
  in_stock: boolean;
}

export interface MobileProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  original_price?: number;
  unit: string;
  image: string;
  description?: string;
  rating?: number;
  reviews_count?: number;
  badge?: string;
  origin?: string;
  storage_tips?: string;
  variants?: ProductVariantItem[];
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role?: string;
}

interface AppState {
  // Persistence state
  isHydrated: boolean;
  setHydrated: (hydrated: boolean) => void;

  // Auth state
  user: AppUser | null;
  token: string | null;
  setAuth: (user: AppUser | null, token: string | null) => void;
  logout: () => void;

  // Saved Addresses
  savedAddresses: UserAddress[];
  selectedAddress: UserAddress;
  deliveryEstimate: { serviceable: boolean; estimated_days: number; message?: string; eta_text?: string } | null;
  setSelectedAddress: (address: UserAddress) => void;
  setDeliveryEstimate: (estimate: { serviceable: boolean; estimated_days: number; message?: string; eta_text?: string } | null) => void;
  addAddress: (address: Omit<UserAddress, 'id'>) => void;
  selectAddress: (id: string) => void;
  deleteAddress: (id: string) => void;
  fetchUserAddresses: () => Promise<void>;

  // Wishlist
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;

  // Cart
  cart: CartItem[];
  addToCart: (product: {
    id: string;
    name: string;
    price: number;
    original_price?: number;
    image_url?: string;
    unit?: string;
    category?: string;
    variant_id?: string;
    description?: string;
  }) => void;
  removeFromCart: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  syncCartWithBackend: () => Promise<void>;
  getCartTotal: () => number;
  getCartSavings: () => number;
  getCartItemsCount: () => number;
}

const DEFAULT_ADDRESSES: UserAddress[] = [
  {
    id: 'addr-default-1',
    title: 'Home',
    street: '123 Palm Grove Avenue, Bandra West',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400050',
    is_default: true,
  },
];

export const useStore = create<AppState>()(
  persist(
    (set: any, get: any): AppState => ({
      isHydrated: false,
      setHydrated: (hydrated: boolean) => set({ isHydrated: hydrated }),

      user: null,
      token: null,
      setAuth: (user: any, token: any) => {
        set({ user, token });
        if (token) {
          get().fetchUserAddresses();
          get().syncCartWithBackend();
          registerForPushNotificationsAsync().catch(() => {});
        }
      },
      logout: () => {
        set({
          user: null,
          token: null,
          cart: [],
          savedAddresses: DEFAULT_ADDRESSES,
          selectedAddress: DEFAULT_ADDRESSES[0],
        });
      },

      savedAddresses: DEFAULT_ADDRESSES,
      selectedAddress: DEFAULT_ADDRESSES[0],
      deliveryEstimate: {
        serviceable: true,
        estimated_days: 1,
        eta_text: '20-30 MINS',
        message: 'Instant Fresh Express Delivery available to your location',
      },
      setSelectedAddress: (address: UserAddress) => set({ selectedAddress: address }),
      setDeliveryEstimate: (deliveryEstimate: any) => set({ deliveryEstimate }),

      fetchUserAddresses: async () => {
        const token = get().token;
        if (!token) return;

        try {
          const response = await apiClient.get('/auth/addresses');
          const data = response.data?.data;
          if (Array.isArray(data) && data.length > 0) {
            const mapped: UserAddress[] = data.map((a: any) => ({
              id: a.id,
              title: a.address_type === 'billing' ? 'Billing' : (a.address_type === 'shipping' ? 'Home' : 'My Address'),
              street: [a.address_line1, a.address_line2].filter(Boolean).join(', '),
              city: a.city || 'Mumbai',
              state: a.state || 'Maharashtra',
              pincode: a.postal_code || '400050',
              is_default: Boolean(a.is_default),
            }));

            const defaultAddr = mapped.find((a) => a.is_default) || mapped[0];
            set({
              savedAddresses: mapped,
              selectedAddress: defaultAddr,
            });
          }
        } catch (err: any) {
          if (err?.response?.status !== 401) {
            console.log('Error fetching backend addresses:', err?.message || err);
          }
        }
      },

      addAddress: async (newAddr: Omit<UserAddress, 'id'>) => {
        const token = get().token;
        let createdId = 'addr-' + Date.now();

        if (token) {
          try {
            const payload = {
              address_line1: newAddr.street,
              city: newAddr.city,
              state: newAddr.state,
              postal_code: newAddr.pincode,
              country: 'India',
              address_type: 'shipping',
              is_default: Boolean(newAddr.is_default),
            };
            const res = await apiClient.post('/auth/addresses', payload);
            if (res.data?.data?.id) {
              createdId = res.data.data.id;
            }
          } catch (e) {
            console.log('Failed to save address to backend, storing locally:', e);
          }
        }

        const created: UserAddress = { ...newAddr, id: createdId };
        const current = get().savedAddresses;
        if (created.is_default) {
          const updated = current.map((a: UserAddress) => ({ ...a, is_default: false }));
          set({ savedAddresses: [created, ...updated], selectedAddress: created });
        } else {
          set({ savedAddresses: [...current, created] });
        }
      },

      selectAddress: (id: string) => {
        const addr = get().savedAddresses.find((a: UserAddress) => a.id === id);
        if (addr) {
          set({
            selectedAddress: addr,
            savedAddresses: get().savedAddresses.map((a: UserAddress) => ({
              ...a,
              is_default: a.id === id,
            })),
          });
        }
      },

      deleteAddress: async (id: string) => {
        const token = get().token;
        if (token && !id.startsWith('addr-')) {
          try {
            await apiClient.delete(`/auth/addresses/${id}`);
          } catch (err) {
            console.log('Failed to delete address from backend:', err);
          }
        }

        const remaining = get().savedAddresses.filter((a: UserAddress) => a.id !== id);
        set({ savedAddresses: remaining.length > 0 ? remaining : DEFAULT_ADDRESSES });
        if (get().selectedAddress.id === id) {
          set({ selectedAddress: remaining.length > 0 ? remaining[0] : DEFAULT_ADDRESSES[0] });
        }
      },

      // Wishlist
      wishlist: [],
      toggleWishlist: (productId: string) => {
        const list = get().wishlist;
        if (list.includes(productId)) {
          set({ wishlist: list.filter((id: string) => id !== productId) });
        } else {
          set({ wishlist: [...list, productId] });
        }
      },
      isWishlisted: (productId: string) => get().wishlist.includes(productId),

      // Cross-Device Cart Sync with Backend
      syncCartWithBackend: async () => {
        const token = get().token;
        if (!token) return;

        try {
          const res = await apiClient.get('/cart');
          const serverItems = res.data?.data;

          if (Array.isArray(serverItems)) {
            const mapped: CartItem[] = serverItems.map((s: any) => {
              const product = s.products || {};
              const variant = s.variant || {};
              const salePrice = Number(variant.price?.sale_price || product.price || 0);
              const mrpPrice = Number(variant.price?.mrp_price || 0);

              return {
                id: product.id || s.product_id,
                backend_cart_item_id: s.id,
                name: product.name || 'Fresh Item',
                price: salePrice > 0 ? salePrice : 3.99,
                original_price: mrpPrice > salePrice ? mrpPrice : undefined,
                image_url: variant.image_url || product.image_url,
                quantity: s.quantity || 1,
                unit: variant.unit ? `${variant.unit} ${variant.unit_type || ''}`.trim() : '1 pack',
                category: product.category_id || 'general',
                variant_id: s.variant_id,
                description: product.description,
              };
            });

            // If server has items, use them; if server is empty but local has items, upload local items
            const localCart = get().cart;
            if (mapped.length > 0) {
              set({ cart: mapped });
            } else if (localCart.length > 0) {
              for (const item of localCart) {
                if (item.variant_id && item.variant_id !== 'default') {
                  try {
                    await apiClient.post('/cart', {
                      product_id: item.id,
                      variant_id: item.variant_id,
                      quantity: item.quantity,
                    });
                  } catch (e) {
                    console.log('Error syncing local item to server cart:', e);
                  }
                }
              }
            }
          }
        } catch (err: any) {
          if (err?.response?.status !== 401) {
            console.log('Error syncing cart with backend:', err?.message || err);
          }
        }
      },

      // Cart Management
      cart: [],
      addToCart: (product: any) => {
        const variantKey = product.variant_id || 'default';
        const currentCart = get().cart;
        const existing = currentCart.find(
          (item: CartItem) => item.id === product.id && (item.variant_id || 'default') === variantKey
        );

        let updatedCart: CartItem[];
        if (existing) {
          updatedCart = currentCart.map((item: CartItem) =>
            item.id === product.id && (item.variant_id || 'default') === variantKey
              ? { ...item, quantity: item.quantity + 1 }
              : item
          );
        } else {
          updatedCart = [...currentCart, { ...product, quantity: 1 }];
        }
        set({ cart: updatedCart });

        // Background sync to backend if authenticated and variant_id is a valid UUID
        const token = get().token;
        if (token && product.variant_id && product.variant_id !== 'default') {
          apiClient
            .post('/cart', {
              product_id: product.id,
              variant_id: product.variant_id,
              quantity: 1,
            })
            .then((res) => {
              if (res.data?.data?.id) {
                set({
                  cart: get().cart.map((it: CartItem) =>
                    it.id === product.id && it.variant_id === product.variant_id
                      ? { ...it, backend_cart_item_id: res.data.data.id }
                      : it
                  ),
                });
              }
            })
            .catch((e) => console.log('Cart background sync error:', e?.message));
        }
      },

      removeFromCart: (productId: string, variantId?: string) => {
        const variantKey = variantId || 'default';
        const itemToRemove = get().cart.find(
          (item: CartItem) => item.id === productId && (item.variant_id || 'default') === variantKey
        );

        set({
          cart: get().cart.filter(
            (item: CartItem) => !(item.id === productId && (item.variant_id || 'default') === variantKey)
          ),
        });

        // Background delete on server
        const token = get().token;
        if (token && itemToRemove?.backend_cart_item_id) {
          apiClient
            .delete(`/cart/${itemToRemove.backend_cart_item_id}`)
            .catch((e) => console.log('Cart delete sync error:', e?.message));
        }
      },

      updateQuantity: (productId: string, quantity: number, variantId?: string) => {
        const variantKey = variantId || 'default';
        if (quantity <= 0) {
          get().removeFromCart(productId, variantId);
          return;
        }

        const updated = get().cart.map((item: CartItem) =>
          item.id === productId && (item.variant_id || 'default') === variantKey
            ? { ...item, quantity }
            : item
        );
        set({ cart: updated });

        const token = get().token;
        const currentItem = updated.find(
          (item: CartItem) => item.id === productId && (item.variant_id || 'default') === variantKey
        );
        if (token && currentItem?.backend_cart_item_id) {
          apiClient
            .put(`/cart/${currentItem.backend_cart_item_id}`, { quantity })
            .catch((e) => console.log('Cart update quantity sync error:', e?.message));
        }
      },

      clearCart: () => {
        set({ cart: [] });
        const token = get().token;
        if (token) {
          apiClient.delete('/cart').catch((e) => console.log('Cart clear sync error:', e?.message));
        }
      },

      getCartTotal: () =>
        get().cart.reduce((sum: number, item: CartItem) => sum + item.price * item.quantity, 0),

      getCartSavings: () =>
        get().cart.reduce((sum: number, item: CartItem) => {
          const orig = item.original_price || item.price;
          return sum + (orig > item.price ? (orig - item.price) * item.quantity : 0);
        }, 0),

      getCartItemsCount: () =>
        get().cart.reduce((sum: number, item: CartItem) => sum + item.quantity, 0),
    }),
    {
      name: 'freshbasket-mobile-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        savedAddresses: state.savedAddresses,
        selectedAddress: state.selectedAddress,
        wishlist: state.wishlist,
        cart: state.cart,
        deliveryEstimate: state.deliveryEstimate,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
        if (state?.token) {
          state.fetchUserAddresses();
          state.syncCartWithBackend();
        }
      },
    }
  )
);
