
import React from 'react';
import { Link } from 'react-router-dom';
import { X, ShoppingCart, Trash, Plus, Minus } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';

const CartDrawer = () => {
  const { state, removeFromCart, updateQuantity, isCartOpen, setIsCartOpen } = useCart();

  return (
    <>
      {/* Backdrop */}
      {isCartOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsCartOpen(false)}
        />
      )}
      
      {/* Cart drawer */}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-white shadow-lg z-50 transform transition-transform duration-300 ease-in-out ${
        isCartOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center">
              <ShoppingCart className="h-5 w-5 text-primary mr-2" />
              <h2 className="text-lg font-semibold">Your Cart ({state.totalItems})</h2>
            </div>
            <button 
              onClick={() => setIsCartOpen(false)}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Cart items */}
          <div className="flex-grow overflow-y-auto py-4 px-4">
            {state.items.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">Your cart is empty</p>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="text-primary hover:underline"
                >
                  Continue Shopping
                </button>
              </div>
            ) : (
              <ul className="space-y-4">
                {state.items.map((item) => (
                  <li key={item.id} className="flex gap-4 pb-4 border-b">
                    <div className="w-20 h-20 rounded-md overflow-hidden bg-gray-50 flex-shrink-0">
                      <img 
                        src={item.image} 
                        alt={item.name}
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    
                    <div className="flex-grow min-w-0">
                      <Link 
                        to={`/products/${item.slug}`}
                        onClick={() => setIsCartOpen(false)}
                        className="font-medium text-gray-800 hover:text-primary line-clamp-2"
                      >
                        {item.name}
                      </Link>
                      
                      <div className="flex items-center mt-1 text-sm">
                        <span className="font-semibold">
                          AED {(item.salePrice || item.price).toFixed(2)}
                        </span>
                        <span className="text-gray-500 ml-1">/{item.unit}</span>
                      </div>
                      
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center border rounded-md">
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="p-1 text-gray-600 hover:bg-gray-100"
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="px-2 text-sm">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="p-1 text-gray-600 hover:bg-gray-100"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        
                        <button 
                          onClick={() => removeFromCart(item.id)}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          {/* Footer with summary and checkout */}
          {state.items.length > 0 && (
            <div className="border-t p-4">
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">AED {state.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Shipping</span>
                  <span>{state.subtotal >= 100 ? 'Free' : 'Calculated at checkout'}</span>
                </div>
              </div>
              
              <Link 
                to="/cart"
                onClick={() => setIsCartOpen(false)}
                className="block w-full bg-primary text-white py-3 text-center rounded-md hover:bg-opacity-90 transition-colors mb-2"
              >
                View Cart
              </Link>
              
              <Link 
                to="/checkout"
                onClick={() => setIsCartOpen(false)}
                className="block w-full bg-accent text-white py-3 text-center rounded-md hover:bg-opacity-90 transition-colors"
              >
                Checkout
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CartDrawer;
