import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Leaf,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Lock,
  ShoppingBag,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyCurrency } from '@/hooks/useCompanyCurrency';
import { CartTrustPillars } from '@/components/cart/CartTrustPillars';
import { CartBottomBanner } from '@/components/cart/CartBottomBanner';

const Cart = () => {
  const { state, removeFromCart, updateQuantity, clearCart, loadBackendCart } = useCart();
  const { user } = useAuth();
  const { formatCurrency } = useCompanyCurrency();
  const { items, subtotal } = state;

  const isEligibleForFreeShipping = subtotal >= 100;
  const shippingCost = isEligibleForFreeShipping || items.length === 0 ? 0 : 10;
  const taxAmount = 0; // Tax is inclusive or ₹0 if applicable
  const totalAmount = subtotal + shippingCost + taxAmount;

  // Load cart from backend when page mounts (for logged-in users)
  useEffect(() => {
    if (user) {
      loadBackendCart();
    }
  }, [user, loadBackendCart]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      <main className="flex-grow py-6 sm:py-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          {/* Decorative Corner Leaves */}
          <div className="hidden lg:block absolute -top-4 left-2 pointer-events-none opacity-85 z-10">
            <svg
              className="w-20 h-24 text-[#4C8C2B]"
              viewBox="0 0 100 120"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 0C15 25 35 45 60 50C40 60 15 50 10 0Z"
                fill="#4C8C2B"
                fillOpacity="0.85"
              />
              <path
                d="M5 25C20 45 45 65 75 65C50 78 20 65 5 25Z"
                fill="#3B7A23"
                fillOpacity="0.9"
              />
              <path
                d="M0 60C18 75 35 95 55 105C35 110 15 95 0 60Z"
                fill="#68A83E"
                fillOpacity="0.75"
              />
            </svg>
          </div>
          <div className="hidden lg:block absolute -top-4 right-4 pointer-events-none opacity-85 z-10">
            <svg
              className="w-20 h-24 text-[#4C8C2B] transform scale-x-[-1]"
              viewBox="0 0 100 120"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 0C15 25 35 45 60 50C40 60 15 50 10 0Z"
                fill="#4C8C2B"
                fillOpacity="0.85"
              />
              <path
                d="M5 25C20 45 45 65 75 65C50 78 20 65 5 25Z"
                fill="#3B7A23"
                fillOpacity="0.9"
              />
            </svg>
          </div>

          {/* Heading Header */}
          <div className="mb-8 pl-1 sm:pl-2">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-9 h-9 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32]">
                <Leaf className="w-5 h-5" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1E502B] tracking-tight">
                Your Cart
              </h1>
            </div>
            <p className="text-sm sm:text-base font-medium text-[#2E7D32]/85">
              Good food. Better choices.
            </p>
            <div className="mt-2">
              <svg
                className="w-36 h-3.5 text-[#2E7D32]"
                viewBox="0 0 150 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 11C45 4 100 3 146 5"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="bg-[#f4f8f1] rounded-3xl border border-[#e2ede0] p-10 sm:p-14 text-center max-w-2xl mx-auto shadow-sm">
              <div className="w-20 h-20 bg-[#e2eed8] rounded-full flex items-center justify-center mx-auto mb-5 text-[#1E502B]">
                <ShoppingCart className="h-10 w-10" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1E502B] mb-2">
                Your cart is empty
              </h2>
              <p className="text-gray-600 text-sm sm:text-base mb-8 max-w-md mx-auto">
                Looks like you haven't added any fresh, organic goodness to your cart yet.
              </p>
              <Link
                to="/products"
                className="inline-flex items-center gap-2 bg-[#1E502B] hover:bg-[#276B3C] text-white font-bold py-3.5 px-8 rounded-full shadow-md transition-all text-sm sm:text-base"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Browse Fresh Produce</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
              {/* Products Table Card (Left Column) */}
              <div className="lg:col-span-8">
                <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm p-4 sm:p-7">
                  {/* Table Header Row (Desktop) */}
                  <div className="hidden sm:grid grid-cols-12 text-xs font-bold text-gray-500 uppercase tracking-wider pb-3 border-b border-gray-100">
                    <div className="col-span-6">Product</div>
                    <div className="col-span-2 text-center">Price</div>
                    <div className="col-span-2 text-center">Quantity</div>
                    <div className="col-span-1 text-right">Total</div>
                    <div className="col-span-1 text-right"></div>
                  </div>

                  {/* Cart Items List */}
                  <div className="divide-y divide-gray-100">
                    {items.map((item) => {
                      const itemPrice = item.sale_price ?? item.price;
                      const lineTotal = itemPrice * item.quantity;
                      const unitDisplay = item.unit
                        ? `${item.unit} ${item.unit_type || ''}`
                        : item.variant_name || '1 unit';

                      return (
                        <div
                          key={`${item.id}|${item.variant_id}`}
                          className="py-5 sm:py-6 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center"
                        >
                          {/* Product Info */}
                          <div className="sm:col-span-6 flex items-center gap-4">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
                              <img
                                src={item.image || '/placeholder.svg'}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <Link
                                to={`/products/${item.id}`}
                                className="font-bold text-sm sm:text-base text-gray-900 hover:text-[#2E7D32] transition-colors line-clamp-1"
                              >
                                {item.name}
                              </Link>
                              <div className="text-xs text-gray-500 mt-0.5">{unitDisplay}</div>
                              <div className="mt-1.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#E8F5E9] text-[#2E7D32] border border-green-200/60 italic">
                                  In Stock
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Price */}
                          <div className="sm:col-span-2 sm:text-center text-sm font-bold text-gray-800">
                            <span className="sm:hidden text-xs text-gray-500 mr-2">Price:</span>
                            {formatCurrency(itemPrice)}
                          </div>

                          {/* Quantity Pill */}
                          <div className="sm:col-span-2 flex sm:justify-center items-center">
                            <div className="inline-flex items-center border border-gray-200 rounded-full px-2 py-1 bg-white shadow-2xs">
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuantity(item.id, item.variant_id, item.quantity - 1)
                                }
                                disabled={item.quantity <= 1}
                                className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-800 disabled:opacity-40"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="px-2.5 font-bold text-xs text-gray-800 min-w-[20px] text-center">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuantity(item.id, item.variant_id, item.quantity + 1)
                                }
                                className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-800"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          {/* Line Total */}
                          <div className="sm:col-span-1 sm:text-right font-extrabold text-sm sm:text-base text-gray-900">
                            <span className="sm:hidden text-xs text-gray-500 mr-2">Total:</span>
                            {formatCurrency(lineTotal)}
                          </div>

                          {/* Delete Item */}
                          <div className="sm:col-span-1 flex sm:justify-end">
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.id, item.variant_id)}
                              className="text-gray-400 hover:text-red-600 transition-colors p-1"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions Bottom Bar inside Card */}
                  <div className="mt-6 pt-5 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <Link
                      to="/products"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#E8F5E9] hover:bg-[#d8eed6] text-[#2E7D32] text-xs sm:text-sm font-bold transition-all shadow-2xs"
                    >
                      <span>← Continue Shopping</span>
                    </Link>

                    <button
                      type="button"
                      onClick={clearCart}
                      className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-gray-500 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Clear Cart</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Order Summary Card (Right Column) */}
              <div className="lg:col-span-4">
                <div className="bg-[#f4f8f1] rounded-3xl p-6 sm:p-7 border border-[#e2ede0] shadow-sm">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-[#1E502B] mb-5">
                    Order Summary
                  </h2>

                  <div className="space-y-3.5 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal ({items.length} items)</span>
                      <span className="font-bold text-gray-900">{formatCurrency(subtotal)}</span>
                    </div>

                    <div className="flex justify-between text-gray-600">
                      <span>Shipping Charges</span>
                      <span className="font-semibold text-gray-800">
                        {isEligibleForFreeShipping ? (
                          <span className="text-[#2E7D32] font-bold">Free</span>
                        ) : (
                          formatCurrency(shippingCost)
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between text-gray-600">
                      <span>Tax (if applicable)</span>
                      <span className="font-semibold text-gray-800">
                        {taxAmount === 0 ? '₹0' : formatCurrency(taxAmount)}
                      </span>
                    </div>

                    <div className="pt-4 border-t border-[#d8e8ce]">
                      <div className="flex justify-between items-baseline">
                        <span className="text-base sm:text-lg font-extrabold text-[#1E502B]">
                          Total
                        </span>
                        <span className="text-2xl sm:text-3xl font-extrabold text-[#1E502B]">
                          {formatCurrency(totalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Free shipping banner if not eligible */}
                  {!isEligibleForFreeShipping && (
                    <div className="mt-5 flex items-start gap-2.5 p-3 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-xs text-amber-800">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        Add <strong>{formatCurrency(100 - subtotal)}</strong> more for free
                        shipping!
                      </div>
                    </div>
                  )}

                  {/* Buttons */}
                  <div className="mt-6 space-y-3">
                    <Link
                      to="/checkout"
                      className="w-full bg-[#1E502B] hover:bg-[#276B3C] text-white font-bold py-3.5 px-6 rounded-full flex items-center justify-center gap-2 shadow-sm transition text-sm sm:text-base"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Proceed to Checkout → →</span>
                    </Link>

                    <Link
                      to="/products"
                      className="w-full bg-white hover:bg-[#ebf4e6] border-2 border-[#2E7D32] text-[#2E7D32] font-bold py-2.5 px-6 rounded-full flex items-center justify-center gap-2 transition text-sm sm:text-base"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>Continue Shopping</span>
                    </Link>
                  </div>

                  {/* Security Assurance Badge */}
                  <div className="mt-6 flex items-start gap-3 p-4 bg-white/85 rounded-2xl border border-green-100 shadow-2xs">
                    <div className="w-9 h-9 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32] shrink-0 mt-0.5">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#1E502B]">
                        Secure Checkout
                      </h4>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Your information is safe with us.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5 Value Pillars Strip */}
          <CartTrustPillars />

          {/* Bottom Landscape Hero Banner */}
          <CartBottomBanner />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Cart;
