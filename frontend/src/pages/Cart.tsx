import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Trash, Plus, Minus, ChevronLeft, AlertCircle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useCart } from '@/contexts/CartContext';

const Cart = () => {
  const { state, removeFromCart, updateQuantity } = useCart();
  const { items, subtotal } = state;
  
  const isEligibleForFreeShipping = subtotal >= 100;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl md:text-3xl font-bold mb-8">Shopping Cart</h1>
          
          {items.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Your cart is empty</h2>
              <p className="text-gray-600 mb-6">
                Looks like you haven't added any products to your cart yet.
              </p>
              <Link 
                to="/products" 
                className="inline-block bg-primary text-white py-3 px-6 rounded-md hover:bg-opacity-90 transition-colors"
              >
                Browse Products
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Cart Items */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                  <ul className="divide-y divide-gray-200">
                    {items.map((item) => (
                      <li key={item.id} className="p-6">
                        <div className="flex gap-4">
                          <div className="w-24 h-24 rounded-md overflow-hidden bg-gray-50 flex-shrink-0">
                            <img 
                              src={item.image} 
                              alt={item.name}
                              className="w-full h-full object-cover" 
                            />
                          </div>
                          
                          <div className="flex-grow min-w-0">
                            <Link 
                              to={`/products/${item.id}`}
                              className="font-semibold text-lg text-gray-800 hover:text-primary line-clamp-1"
                            >
                              {item.name}
                            </Link>
                            
                            <div className="mt-1 text-gray-600">
                              <span className="text-sm">Price: </span>
                              {item.sale_price ? (
                                <>
                                  <span className="font-medium text-red-500">
                                    AED {item.sale_price.toFixed(2)}
                                  </span>
                                  <span className="text-gray-500 text-sm line-through ml-1">
                                    AED {item.price.toFixed(2)}
                                  </span>
                                </>
                              ) : (
                                <span className="font-medium">
                                  AED {item.price.toFixed(2)}
                                </span>
                              )}
                              <span className="text-gray-500 ml-1">
                                /{item.unit} {item.unit_type}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between mt-4">
                              <div className="flex items-center border rounded-md">
                                <button 
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                  className="px-3 py-1 text-gray-600 hover:bg-gray-100"
                                  disabled={item.quantity <= 1}
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <span className="px-4 py-1 text-center min-w-[40px]">{item.quantity}</span>
                                <button 
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                  className="px-3 py-1 text-gray-600 hover:bg-gray-100"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                              
                              <div className="flex items-end flex-col">
                                <div className="font-bold">
                                  AED {((item.sale_price || item.price) * item.quantity).toFixed(2)}
                                </div>
                                <button 
                                  onClick={() => removeFromCart(item.id)}
                                  className="mt-2 flex items-center text-red-600 hover:text-red-800 text-sm"
                                >
                                  <Trash className="h-4 w-4 mr-1" />
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="mt-6">
                  <Link 
                    to="/products" 
                    className="inline-flex items-center text-primary hover:underline"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Continue Shopping
                  </Link>
                </div>
              </div>
              
              {/* Order Summary */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
                  
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-semibold">AED {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Shipping</span>
                      <span>{isEligibleForFreeShipping ? 'Free' : 'Calculated at checkout'}</span>
                    </div>
                    <div className="pt-3 border-t border-gray-200">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span>AED {subtotal.toFixed(2)}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        (excluding shipping & taxes)
                      </div>
                    </div>
                  </div>
                  
                  {/* Free shipping notification */}
                  {!isEligibleForFreeShipping && (
                    <div className="flex items-start p-3 mb-6 bg-accent bg-opacity-10 text-sm rounded-md">
                      <AlertCircle className="h-5 w-5 text-accent mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Add AED {(100 - subtotal).toFixed(2)} more</strong> to qualify for free shipping!
                      </div>
                    </div>
                  )}
                  
                  <Link 
                    to="/checkout" 
                    className="block w-full bg-accent text-white py-3 text-center rounded-md hover:bg-opacity-90 transition-colors mb-3"
                  >
                    Proceed to Checkout
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Cart;
