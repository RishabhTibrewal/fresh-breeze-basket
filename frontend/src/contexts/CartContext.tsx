
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { Product } from '@/data/productData';
import { toast } from '@/hooks/use-toast';

// Define cart item type
export interface CartItem {
  id: string;
  name: string;
  price: number;
  salePrice?: number;
  image: string;
  quantity: number;
  unit: string;
  slug: string;
}

// Define cart state
interface CartState {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
}

// Define cart actions
type CartAction =
  | { type: 'ADD_ITEM'; payload: { product: Product; quantity: number } }
  | { type: 'REMOVE_ITEM'; payload: { id: string } }
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
  setIsCartOpen: React.Dispatch<React.SetStateAction<boolean>>;
}>({
  state: initialState,
  dispatch: () => null,
  addToCart: () => null,
  removeFromCart: () => null,
  updateQuantity: () => null,
  clearCart: () => null,
  isCartOpen: false,
  setIsCartOpen: () => null,
});

// Calculate the cart totals
const calculateCartTotals = (items: CartItem[]): { totalItems: number; subtotal: number } => {
  const totalItems = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = items.reduce(
    (total, item) => total + (item.salePrice || item.price) * item.quantity,
    0
  );
  return { totalItems, subtotal };
};

// Create the cart reducer
const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const { product, quantity } = action.payload;
      const existingItemIndex = state.items.findIndex((item) => item.id === product.id);

      let updatedItems: CartItem[];

      if (existingItemIndex > -1) {
        // Item exists, update quantity
        updatedItems = state.items.map((item, index) =>
          index === existingItemIndex
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        // Item doesn't exist, add new item
        const newItem: CartItem = {
          id: product.id,
          name: product.name,
          price: product.price,
          salePrice: product.salePrice,
          image: product.images[0],
          quantity,
          unit: product.unit,
          slug: product.slug,
        };
        updatedItems = [...state.items, newItem];
      }

      const { totalItems, subtotal } = calculateCartTotals(updatedItems);

      return {
        ...state,
        items: updatedItems,
        totalItems,
        subtotal,
      };
    }

    case 'REMOVE_ITEM': {
      const updatedItems = state.items.filter((item) => item.id !== action.payload.id);
      const { totalItems, subtotal } = calculateCartTotals(updatedItems);

      return {
        ...state,
        items: updatedItems,
        totalItems,
        subtotal,
      };
    }

    case 'UPDATE_QUANTITY': {
      const { id, quantity } = action.payload;
      
      // Don't allow negative quantities
      if (quantity <= 0) {
        return state;
      }

      const updatedItems = state.items.map((item) =>
        item.id === id ? { ...item, quantity } : item
      );
      
      const { totalItems, subtotal } = calculateCartTotals(updatedItems);

      return {
        ...state,
        items: updatedItems,
        totalItems,
        subtotal,
      };
    }

    case 'CLEAR_CART': {
      return initialState;
    }

    default:
      return state;
  }
};

// Create the cart provider component
export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState, () => {
    // Load cart from localStorage on initial render
    if (typeof window !== 'undefined') {
      const savedCart = localStorage.getItem('cart');
      return savedCart ? JSON.parse(savedCart) : initialState;
    }
    return initialState;
  });

  const [isCartOpen, setIsCartOpen] = React.useState(false);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(state));
  }, [state]);

  // Helper functions for cart operations
  const addToCart = (product: Product, quantity: number) => {
    dispatch({ type: 'ADD_ITEM', payload: { product, quantity } });
    toast({
      title: "Added to cart",
      description: `${quantity} × ${product.name} added to your cart`,
    });
  };

  const removeFromCart = (id: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { id } });
  };

  const updateQuantity = (id: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

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
