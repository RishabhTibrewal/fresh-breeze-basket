import React, { createContext, useContext, useReducer, useState, useEffect, useCallback, useRef } from 'react';
import { Product } from '@/api/products';
import { toast } from '@/hooks/use-toast';
import { cartService } from '@/api/cart';
import { useAuth } from '@/contexts/AuthContext';

// Define cart item type
interface CartItem {
  id: string;
  name: string;
  price: number;
  sale_price?: number;
  unit: number;
  unit_type?: string;
  image?: string;
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
  | { type: 'ADD_ITEM'; payload: { product: Product; quantity: number; cartItemId: string } }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
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
  addToCart: (product: Product, quantity: number) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
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
      const { product, quantity, cartItemId } = action.payload;
      
      const qty = typeof quantity === 'string' ? parseInt(quantity, 10) : quantity;
      const existingItem = state.items.find(item => item.id === product.id);

      // Map snake_case fields for CartItem
      const salePrice = product.sale_price && product.sale_price > 0 ? Number(product.sale_price) : null;
      const image = (product as any).image !== undefined ? (product as any).image : (product as any).image_url;
      
      // Make sure unit has a valid value
      const unit = product.unit && Number(product.unit) > 0 ? Number(product.unit) : 1;
      
      if (existingItem) {
        const updatedItems = state.items.map(item =>
          item.id === product.id
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
        name: product.name,
        price: product.price,
        sale_price: salePrice,
        unit: unit,
        unit_type: product.unit_type,
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
      const updatedItems = state.items.filter(item => item.id !== action.payload);
      return {
        ...state,
        items: updatedItems,
        totalItems: updatedItems.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: updatedItems.reduce((sum, item) => sum + (item.sale_price || item.price) * item.quantity, 0),
      };
    }

    case 'UPDATE_QUANTITY': {
      const { id, quantity } = action.payload;
      if (quantity <= 0) {
        return cartReducer(state, { type: 'REMOVE_ITEM', payload: id });
      }

      const updatedItems = state.items.map(item =>
        item.id === id ? { ...item, quantity } : item
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
            const quantity = typeof item.quantity === 'string' ? parseInt(item.quantity, 10) : item.quantity;
            
            // Fix the cart item before dispatching
            const fixedItem = {
              ...item,
              // Only set sale_price if it exists and is greater than 0
              sale_price: item.sale_price && Number(item.sale_price) > 0 ? Number(item.sale_price) : null,
              // Make sure unit has a valid value
              unit: item.unit && Number(item.unit) > 0 ? Number(item.unit) : 1
            };
            
            dispatch({ type: 'ADD_ITEM', payload: { product: fixedItem, quantity, cartItemId: item.id } });
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
        
        // Store the mapping of product ID to cart item ID
        setCartItemIds(prev => ({
          ...prev,
          [item.products.id]: item.id
        }));
        
        const quantity = typeof item.quantity === 'string' ? parseInt(item.quantity, 10) : item.quantity;
        dispatch({ type: 'ADD_ITEM', payload: { 
          product: {
            id: item.products.id,
            name: item.products.name || 'Unknown Product',
            price: Number(item.products.price),
            sale_price: item.products.sale_price && Number(item.products.sale_price) > 0 ? Number(item.products.sale_price) : null,
            unit: item.products.unit && Number(item.products.unit) > 0 ? Number(item.products.unit) : 1,
            unit_type: item.products.unit_type || '',
            image_url: item.products.image_url,
            description: item.products.description || '',
            category_id: item.products.category_id || '',
            slug: item.products.slug || '',
            is_featured: item.products.is_featured || false,
            is_active: item.products.is_active || false,
            created_at: '',
            updated_at: '',
            stock_count: 0,
            nutritional_info: '',
            origin: '',
            best_before: '',
            badge: '',
            additional_images: []
          }, 
          quantity,
          cartItemId: item.id
        } });
      });
      
      setCartLoaded(true); // Mark cart as loaded
    } catch (e) {
      console.error("Full error:", e.response?.data || e);
      
      // Check if error is auth-related
      if (e.response?.status === 401 || e.response?.status === 403) {
        toast({ 
          title: 'Authentication Error', 
          description: 'Please login again to access your cart' 
        });
      } else {
        toast({ 
          title: 'Error', 
          description: 'Failed to load cart from server' 
        });
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
            console.log(`Adding item ${item.id} with quantity ${item.quantity} to backend cart`);
            // Ensure quantity is a number and use correct productId
            const quantity = typeof item.quantity === 'string' ? parseInt(item.quantity, 10) : item.quantity;
            // Product ID is stored in id field in the local cart
            await cartService.addItem(item.id, quantity);
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
        const quantity = item.quantity;
        
        // Check if this product exists in backend cart
        if (backendProductMap.has(productId)) {
          const backendItem = backendProductMap.get(productId);
          
          // Update quantity if different
          if (backendItem.quantity !== quantity) {
            console.log(`Updating quantity for ${productId} from ${backendItem.quantity} to ${quantity}`);
            await cartService.updateItemQuantity(backendItem.cartItemId, quantity);
          }
          
          // Remove from map to track what's been processed
          backendProductMap.delete(productId);
        } else {
          // Product doesn't exist in backend, add it
          console.log(`Adding new product ${productId} with quantity ${quantity} to backend`);
          await cartService.addItem(productId, quantity);
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
    toast({
        title: 'Sync Error', 
        description: 'Failed to sync cart with server' 
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Modify cart operations to work locally for logged-in users too
  const addToCart = async (product: Product, quantity: number) => {
    if (user) {
      try {
        // Start syncing immediately
        setIsSyncing(true);
        
        // Add locally first (for immediate feedback)
        dispatch({ type: 'ADD_ITEM', payload: { product, quantity, cartItemId: '' } });
        
        // Send to backend immediately
        await cartService.addItem(product.id, quantity);
        
        // Backend and local state are now consistent for this operation,
        // so avoid an extra GET /cart here to reduce network chatter.
        setPendingChanges(false);
        toast({ title: 'Added to cart', description: `${quantity} × ${product.name} added to your cart` });
      } catch (e) {
        toast({ title: 'Error', description: 'Failed to add to cart' });
      } finally {
        setIsSyncing(false);
      }
    } else {
      // Local cart for guests (unchanged)
      dispatch({ type: 'ADD_ITEM', payload: { product, quantity, cartItemId: '' } });
      toast({ title: 'Added to cart', description: `${quantity} × ${product.name} added to your cart` });
    }
  };

  const removeFromCart = async (id: string) => {
    if (user) {
      try {
        // Start syncing immediately
        setIsSyncing(true);
        
        // Remove locally first (for immediate feedback)
        dispatch({ type: 'REMOVE_ITEM', payload: id });
        
        // Find the cart item ID from product ID
        const cartItemId = cartItemIds[id];
        if (cartItemId) {
          // Remove from backend immediately
          await cartService.removeItem(cartItemId);
          
          // Remove from cartItemIds mapping
          setCartItemIds(prev => {
            const newMapping = {...prev};
            delete newMapping[id];
            return newMapping;
          });
        }
        
        // Local state and backend are now consistent for this item,
        // so skip a full cart reload to prevent extra GET /cart calls.
        setPendingChanges(false);
        toast({ title: 'Removed from cart', description: 'Item removed from your cart' });
      } catch (e) {
        toast({ title: 'Error', description: 'Failed to remove item from cart' });
      } finally {
        setIsSyncing(false);
      }
    } else {
      dispatch({ type: 'REMOVE_ITEM', payload: id });
    }
  };

  const updateQuantity = async (id: string, quantity: number) => {
    if (user) {
      try {
        // Start syncing immediately
        setIsSyncing(true);
        
        // Update locally first (for immediate feedback)
        dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
        
        // Find the cart item ID from product ID
        const cartItemId = cartItemIds[id];
        if (cartItemId) {
          // If quantity is 0, remove the item
          if (quantity <= 0) {
            await cartService.removeItem(cartItemId);
            
            // Remove from cartItemIds mapping
            setCartItemIds(prev => {
              const newMapping = {...prev};
              delete newMapping[id];
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
      } catch (e) {
        toast({ title: 'Error', description: 'Failed to update item quantity' });
      } finally {
        setIsSyncing(false);
      }
    } else {
      dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
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
        toast({ title: 'Cart cleared', description: 'Your cart has been cleared' });
      } catch (e) {
        toast({ title: 'Error', description: 'Failed to clear cart' });
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
