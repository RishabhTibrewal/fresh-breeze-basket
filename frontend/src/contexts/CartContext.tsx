import React, { createContext, useContext, useReducer, useState, useEffect, useCallback, useRef } from 'react';
import { Product, ProductVariant } from '@/api/products';
import { toast } from 'sonner';
import { cartService } from '@/api/cart';
import { useAuth } from '@/contexts/AuthContext';

// Define cart item type
interface CartItem {
  id: string; // Product ID
  variant_id: string; // REQUIRED: Variant ID
  name: string; // Product name
  variant_name: string; // Variant name
  variant_sku?: string | null; // Variant SKU
  price: number; // MRP price
  sale_price?: number; // Sale price
  unit: number;
  unit_type?: string;
  image?: string; // Variant image or product image
  quantity: number;
}

// Define cart state
interface CartState {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
}

// Define cart actions
type CartAction =
  | { type: 'ADD_ITEM'; payload: { product: Product; variant: ProductVariant; quantity: number; cartItemId: string } }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; variant_id: string; quantity: number } }
  | { type: 'CLEAR_CART' };

// Create the initial state
const initialState: CartState = {
  items: [],
  totalItems: 0,
  subtotal: 0,
};

// Create the cart context
const CartContext = createContext<{
  state: CartState;
  dispatch: React.Dispatch<CartAction>;
  addToCart: (product: Product, variant: ProductVariant, quantity: number) => void;
  removeFromCart: (id: string, variant_id: string) => void;
  updateQuantity: (id: string, variant_id: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
  isSyncing: boolean;
  syncCartWithBackend: () => Promise<void>;
  loadBackendCart: () => Promise<void>;
}>({
  state: initialState,
  dispatch: () => null,
  addToCart: () => null,
  removeFromCart: () => null,
  updateQuantity: () => null,
  clearCart: () => null,
  isCartOpen: false,
  setIsCartOpen: () => null,
  isSyncing: false,
  syncCartWithBackend: async () => {},
  loadBackendCart: async () => {},
});

// Calculate the cart totals
const calculateCartTotals = (items: CartItem[]): { totalItems: number; subtotal: number } => {
  const totalItems = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = items.reduce(
    (total, item) => total + (item.sale_price || item.price) * item.quantity,
    0
  );
  return { totalItems, subtotal };
};

// Create the cart reducer
const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const { product, variant, quantity, cartItemId } = action.payload;
      
      if (!variant || !variant.id) {
        toast.error('Variant selection is required');
        return state;
      }

      const qty = typeof quantity === 'string' ? parseInt(quantity, 10) : quantity;
      // Find existing item by product ID AND variant ID
      const existingItem = state.items.find(
        item => item.id === product.id && item.variant_id === variant.id
      );

      // Use variant price, fallback to product price
      const variantPrice = variant.price;
      const mrpPrice = variantPrice?.mrp_price || product.price || 0;
      const salePrice = variantPrice?.sale_price || product.sale_price || null;
      
      // Use variant image, fallback to product image
      const image = variant.image_url || product.image_url || undefined;
      
      // Use variant unit info
      const unit = variant.unit && Number(variant.unit) > 0 ? Number(variant.unit) : 1;
      const unitType = variant.unit_type || product.unit_type;
      
      if (existingItem) {
        const updatedItems = state.items.map(item =>
          item.id === product.id && item.variant_id === variant.id
            ? { ...item, quantity: item.quantity + qty }
            : item
        );
        return {
          ...state,
          items: updatedItems,
          totalItems: updatedItems.reduce((sum, item) => sum + item.quantity, 0),
          subtotal: updatedItems.reduce((sum, item) => sum + (item.sale_price || item.price) * item.quantity, 0),
        };
      }

      const newItem: CartItem = {
        id: product.id,
        variant_id: variant.id,
        name: product.name,
        variant_name: variant.name,
        variant_sku: variant.sku,
        price: mrpPrice,
        sale_price: salePrice,
        unit: unit,
        unit_type: unitType,
        image: image,
        quantity: Number(qty),
      };
      
      const updatedItems = [...state.items, newItem];
      return {
        ...state,
        items: updatedItems,
        totalItems: updatedItems.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: updatedItems.reduce((sum, item) => sum + (item.sale_price || item.price) * item.quantity, 0),
      };
    }

    case 'REMOVE_ITEM': {
      // Remove item by product ID and variant ID combination
      const [productId, variantId] = action.payload.split('|');
      const updatedItems = state.items.filter(
        item => !(item.id === productId && item.variant_id === variantId)
      );
      return {
        ...state,
        items: updatedItems,
        totalItems: updatedItems.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: updatedItems.reduce((sum, item) => sum + (item.sale_price || item.price) * item.quantity, 0),
      };
    }

    case 'UPDATE_QUANTITY': {
      const { id, variant_id, quantity } = action.payload;
      if (quantity <= 0) {
        return cartReducer(state, { type: 'REMOVE_ITEM', payload: `${id}|${variant_id}` });
      }

      const updatedItems = state.items.map(item =>
        item.id === id && item.variant_id === variant_id
          ? { ...item, quantity }
          : item
      );
      return {
        ...state,
        items: updatedItems,
        totalItems: updatedItems.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: updatedItems.reduce((sum, item) => sum + (item.sale_price || item.price) * item.quantity, 0),
      };
    }

    case 'CLEAR_CART':
      return {
        items: [],
        totalItems: 0,
        subtotal: 0,
      };

    default:
      return state;
  }
};

// Create the cart provider component
export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [cartItemIds, setCartItemIds] = useState<Record<string, string>>({});
  const [pendingChanges, setPendingChanges] = useState(false);
  const [cartLoaded, setCartLoaded] = useState(false); // Track if cart has been loaded from backend
  
  // Create a ref to track previous user state
  const previousUserRef = useRef<boolean>();

  // Helper to load cart from localStorage
  const loadLocalCart = useCallback(() => {
    const local = localStorage.getItem('cart');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (parsed && parsed.items) {
          dispatch({ type: 'CLEAR_CART' });
          parsed.items.forEach((item: any) => {
            // Skip old cart items without variant_id (migration from old format)
            if (!item.variant_id) {
              console.warn('Skipping old cart item without variant_id:', item);
              return;
            }

            const quantity = typeof item.quantity === 'string' ? parseInt(item.quantity, 10) : item.quantity;
            
            // Create minimal Product object from cart item
            const product: Product = {
              id: item.id,
              name: item.name,
              description: null,
              category_id: null,
              slug: '',
              is_active: true,
              nutritional_info: null,
              origin: null,
              brand_id: null,
              product_code: null,
              created_at: '',
              updated_at: '',
            };

            // Create minimal ProductVariant from cart item
            const variant: ProductVariant = {
              id: item.variant_id,
              product_id: item.id,
              name: item.variant_name || item.name,
              sku: item.variant_sku || null,
              is_default: false,
              is_active: true,
              is_featured: false,
              image_url: item.image || null,
              unit: item.unit || null,
              unit_type: item.unit_type || null,
              best_before: null,
              hsn: null,
              badge: null,
              brand_id: null,
              tax_id: null,
              price_id: '',
              price: item.price || item.sale_price ? {
                id: '',
                product_id: null,
                variant_id: item.variant_id,
                outlet_id: null,
                price_type: 'default',
                mrp_price: item.price || 0,
                sale_price: item.sale_price || item.price || 0,
                brand_id: null,
                valid_from: new Date().toISOString(),
                valid_until: null,
                company_id: '',
                created_at: '',
                updated_at: '',
              } : undefined,
              company_id: '',
              created_at: '',
              updated_at: '',
            };
            
            dispatch({ type: 'ADD_ITEM', payload: { product, variant, quantity, cartItemId: item.id } });
          });
        }
      } catch (e) {
        console.error("Error loading cart from localStorage:", e);
      }
    }
  }, [dispatch]);

  // Helper to save cart to localStorage
  useEffect(() => {
    if (!user) {
    localStorage.setItem('cart', JSON.stringify(state));
    }
  }, [state, user]);

  // Helper to load cart from backend
  const loadBackendCart = useCallback(async () => {
    // Skip if cart is already loaded
    if (cartLoaded) {
      console.log('Cart already loaded, skipping...');
      return;
    }
    
    try {
      setIsSyncing(true);
      console.log('Loading cart from backend...');
      const backendCart = await cartService.getCart();
      
      // Check for empty cart response
      if (!backendCart || !backendCart.success) {
        console.error("Invalid cart response:", backendCart);
        return;
      }
      
      // Check if data exists and is array
      const cartItems = backendCart.data || [];
      
      dispatch({ type: 'CLEAR_CART' });
      
      // Process cart items
      cartItems.forEach((item: any) => {
        if (!item || !item.products) return;
        
        // Key is variant_id (preferred) so the same product with two variants
        // gets two separate entries in the cartItemIds map
        const itemKey = item.variant_id
          ? `${item.products.id}|${item.variant_id}`
          : item.products.id;

        setCartItemIds(prev => ({ ...prev, [itemKey]: item.id }));
        
        const quantity = typeof item.quantity === 'string' ? parseInt(item.quantity, 10) : item.quantity;
        
        // Use the joined variant object returned by the new backend query
        const backendVariant = item.variant;
        const backendPrice = backendVariant?.price;

        const product: Product = {
          id: item.products.id,
          name: item.products.name || 'Unknown Product',
          description: item.products.description || null,
          category_id: item.products.category_id || null,
          slug: item.products.slug || '',
          is_active: item.products.is_active ?? true,
          nutritional_info: null,
          origin: null,
          brand_id: null,
          product_code: null,
          created_at: '',
          updated_at: '',
        };

        const variant: ProductVariant = {
          id: backendVariant?.id || item.variant_id || item.products.id,
          product_id: item.products.id,
          name: backendVariant?.name || 'Default Variant',
          sku: backendVariant?.sku || null,
          is_default: backendVariant?.is_default ?? true,
          is_active: true,
          is_featured: false,
          // Prefer variant image, then product image
          image_url: backendVariant?.image_url || item.products.image_url || null,
          unit: backendVariant?.unit ?? null,
          unit_type: backendVariant?.unit_type || null,
          best_before: null,
          hsn: null,
          badge: null,
          brand_id: null,
          tax_id: null,
          price_id: backendPrice?.id || '',
          // Real variant price from product_prices table
          price: backendPrice ? {
            id: backendPrice.id,
            product_id: null,
            variant_id: backendVariant?.id || item.variant_id,
            outlet_id: null,
            price_type: backendPrice.price_type || 'default',
            mrp_price: Number(backendPrice.mrp_price) || 0,
            sale_price: Number(backendPrice.sale_price) || 0,
            brand_id: null,
            valid_from: new Date().toISOString(),
            valid_until: null,
            company_id: '',
            created_at: '',
            updated_at: '',
          } : undefined,
          company_id: '',
          created_at: '',
          updated_at: '',
        };
        
        dispatch({ type: 'ADD_ITEM', payload: { 
          product,
          variant, 
          quantity,
          cartItemId: item.id
        } });
      });
      
      setCartLoaded(true); // Mark cart as loaded
    } catch (e) {
      console.error("Full error:", e.response?.data || e);
      
      // Check if error is auth-related
      if (e.response?.status === 401 || e.response?.status === 403) {
        toast.error('Authentication Error: Please login again to access your cart');
      } else {
        toast.error('Failed to load cart from server');
      }
    } finally {
      setIsSyncing(false);
    }
  }, [dispatch, cartLoaded]);

  // Helper to merge local cart into backend cart
  const mergeLocalToBackend = useCallback(async () => {
    const local = localStorage.getItem('cart');
    if (local) {
      try {
        console.log("Merging local cart to backend...");
        const parsed = JSON.parse(local);
        if (parsed && parsed.items) {
          for (const item of parsed.items) {
            // Skip old cart items without variant_id (migration from old format)
            if (!item.variant_id) {
              console.warn('Skipping old cart item without variant_id during merge:', item);
              continue;
            }
            
            console.log(`Adding item ${item.id} (variant: ${item.variant_id}) with quantity ${item.quantity} to backend cart`);
            // Ensure quantity is a number and use correct productId
            const quantity = typeof item.quantity === 'string' ? parseInt(item.quantity, 10) : item.quantity;
            // Product ID is stored in id field, variant_id is required
            await cartService.addItem(item.id, quantity, item.variant_id);
          }
        }
        localStorage.removeItem('cart');
      } catch (error) {
        console.error("Error merging cart:", error);
      }
    }
  }, []);

  // On mount or auth change: handle cart appropriately
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      // On login: merge local cart to backend (no GET call)
      // Cart will be loaded lazily when user opens cart drawer or navigates to cart page
      mergeLocalToBackend().then(() => {
        // Reset cart loaded flag when user changes, so cart can be loaded on demand
        setCartLoaded(false);
      });
    } else {
      // On logout or guest: load local cart
      dispatch({ type: 'CLEAR_CART' });
      loadLocalCart();
      setCartLoaded(false); // Reset flag for logged out users
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  // Load cart when cart drawer opens (lazy loading)
  useEffect(() => {
    if (user && isCartOpen && !cartLoaded) {
      loadBackendCart();
    }
  }, [user, isCartOpen, cartLoaded, loadBackendCart]);

  // Replace this function to handle syncing at critical moments
  const syncCartWithBackend = async () => {
    if (!user) return;
    
    try {
      setIsSyncing(true);
      console.log('Synchronizing cart with backend...');
      
      // Get current backend cart state
      const backendCart = await cartService.getCart();
      
      if (!backendCart || !backendCart.success) {
        console.error("Invalid cart response:", backendCart);
        return;
      }
      
      const backendItems = backendCart.data || [];
      
      // Create maps for easier lookups
      const backendProductMap = new Map();
      backendItems.forEach(item => {
        if (item && item.products) {
          backendProductMap.set(item.products.id, {
            cartItemId: item.id,
            quantity: item.quantity
          });
        }
      });
      
      // Synchronize each local item with backend
      for (const item of state.items) {
        const productId = item.id;
        const variantId = item.variant_id;
        const quantity = item.quantity;
        
        // Skip items without variant_id (shouldn't happen, but safety check)
        if (!variantId) {
          console.warn('Skipping cart item without variant_id during sync:', item);
          continue;
        }
        
        // Check if this product+variant combination exists in backend cart
        // Note: Backend might not support variant-based lookup, so we check by product_id
        // This is a simplified sync - full variant-aware sync would require backend support
        if (backendProductMap.has(productId)) {
          const backendItem = backendProductMap.get(productId);
          
          // Update quantity if different
          if (backendItem.quantity !== quantity) {
            console.log(`Updating quantity for ${productId} (variant: ${variantId}) from ${backendItem.quantity} to ${quantity}`);
            await cartService.updateItemQuantity(backendItem.cartItemId, quantity);
          }
          
          // Remove from map to track what's been processed
          backendProductMap.delete(productId);
        } else {
          // Product doesn't exist in backend, add it with variant
          console.log(`Adding new product ${productId} (variant: ${variantId}) with quantity ${quantity} to backend`);
          await cartService.addItem(productId, quantity, variantId);
        }
      }
      
      // Remove any backend items that aren't in local cart
      for (const [productId, itemData] of backendProductMap.entries()) {
        console.log(`Removing product ${productId} from backend cart`);
        await cartService.removeItem(itemData.cartItemId);
      }
      
      // Finally, refresh the cart from backend to ensure consistent state
      await loadBackendCart();
      setPendingChanges(false);
      console.log('Cart synchronized with backend successfully');
    } catch (error) {
      console.error('Error syncing cart with backend:', error);
      toast.error('Failed to sync cart with server');
    } finally {
      setIsSyncing(false);
    }
  };

  // Modify cart operations to work locally for logged-in users too
  const addToCart = async (product: Product, variant: ProductVariant, quantity: number) => {
    if (!variant || !variant.id) {
      toast.error('Please select a variant before adding to cart');
      return;
    }

    if (user) {
      try {
        // Start syncing immediately
        setIsSyncing(true);
        
        // Add locally first (for immediate feedback)
        dispatch({ type: 'ADD_ITEM', payload: { product, variant, quantity, cartItemId: '' } });
        
        // Send to backend immediately - backend API should accept variant_id
        await cartService.addItem(product.id, quantity, variant.id);
        
        // Backend and local state are now consistent for this operation,
        // so avoid an extra GET /cart here to reduce network chatter.
        setPendingChanges(false);
        toast.success(`${quantity} × ${product.name} (${variant.name}) added to your cart`);
      } catch (e: any) {
        toast.error(e.message || 'Failed to add to cart');
      } finally {
        setIsSyncing(false);
      }
    } else {
      // Local cart for guests
      dispatch({ type: 'ADD_ITEM', payload: { product, variant, quantity, cartItemId: '' } });
      toast.success(`${quantity} × ${product.name} (${variant.name}) added to your cart`);
    }
  };

  const removeFromCart = async (id: string, variant_id: string) => {
    if (user) {
      try {
        // Start syncing immediately
        setIsSyncing(true);
        
        // Remove locally first (for immediate feedback)
        dispatch({ type: 'REMOVE_ITEM', payload: `${id}|${variant_id}` });
        
        // Find the cart item ID from product ID and variant ID combination
        const itemKey = `${id}|${variant_id}`;
        const cartItemId = cartItemIds[itemKey];
        if (cartItemId) {
          // Remove from backend immediately
          await cartService.removeItem(cartItemId);
          
          // Remove from cartItemIds mapping
          setCartItemIds(prev => {
            const newMapping = {...prev};
            delete newMapping[itemKey];
            return newMapping;
          });
        }
        
        // Local state and backend are now consistent for this item,
        // so skip a full cart reload to prevent extra GET /cart calls.
        setPendingChanges(false);
        toast.success('Item removed from your cart');
      } catch (e: any) {
        toast.error(e.message || 'Failed to remove item from cart');
      } finally {
        setIsSyncing(false);
      }
    } else {
      dispatch({ type: 'REMOVE_ITEM', payload: `${id}|${variant_id}` });
    }
  };

  const updateQuantity = async (id: string, variant_id: string, quantity: number) => {
    if (user) {
      try {
        // Start syncing immediately
        setIsSyncing(true);
        
        // Update locally first (for immediate feedback)
        dispatch({ type: 'UPDATE_QUANTITY', payload: { id, variant_id, quantity } });
        
        // Find the cart item ID from product ID and variant ID combination
        const itemKey = `${id}|${variant_id}`;
        const cartItemId = cartItemIds[itemKey];
        if (cartItemId) {
          // If quantity is 0, remove the item
          if (quantity <= 0) {
            await cartService.removeItem(cartItemId);
            
            // Remove from cartItemIds mapping
            setCartItemIds(prev => {
              const newMapping = {...prev};
              delete newMapping[itemKey];
              return newMapping;
            });
          } else {
            // Otherwise update the quantity
            await cartService.updateItemQuantity(cartItemId, quantity);
          }
        }
        
        // We know the backend update succeeded, and local state already
        // reflects the new quantity, so avoid an extra GET /cart here.
        setPendingChanges(false);
      } catch (e: any) {
        toast.error(e.message || 'Failed to update item quantity');
      } finally {
        setIsSyncing(false);
      }
    } else {
      dispatch({ type: 'UPDATE_QUANTITY', payload: { id, variant_id, quantity } });
    }
  };

  const clearCart = async () => {
    if (user) {
      try {
        // Start syncing immediately
        setIsSyncing(true);
        
        // Clear locally first (for immediate feedback)
        dispatch({ type: 'CLEAR_CART' });
        
        // Clear the backend cart
        await cartService.clearCart();
        
        // Reset the cart item IDs mapping
        setCartItemIds({});
        
        setPendingChanges(false);
        toast.success('Your cart has been cleared');
      } catch (e) {
        toast.error('Failed to clear cart');
      } finally {
        setIsSyncing(false);
      }
    } else {
      dispatch({ type: 'CLEAR_CART' });
    }
  };

  // Update the logout effect to track previous login state
  useEffect(() => {
    // Only clear if we know the user was previously logged in and is now logged out
    if (!user && !authLoading && previousUserRef.current) {
      console.log('User logged out - clearing cart data from localStorage');
      dispatch({ type: 'CLEAR_CART' });
      localStorage.removeItem('cart');
      setCartItemIds({});
      setPendingChanges(false);
      setCartLoaded(false); // Reset cart loaded flag on logout
    }
    
    // Update the ref to track previous login state
    previousUserRef.current = !!user;
  }, [user, authLoading]);

  return (
    <CartContext.Provider
      value={{
        state,
        dispatch,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        isCartOpen,
        setIsCartOpen,
        isSyncing,
        syncCartWithBackend,
        loadBackendCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

// Create a custom hook to use the cart context
export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
