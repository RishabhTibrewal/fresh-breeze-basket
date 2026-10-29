import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Leaf,
  CheckCircle,
  Plus,
  MapPin,
  CreditCard,
  Loader2,
  ArrowLeft,
  Lock,
  Pencil,
  Trash2,
  ShieldCheck,
  ShoppingCart,
  Clock,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Spinner } from "@/components/ui/spinner";
import { PaymentForm } from "@/components/PaymentForm";
import { StripeProvider } from "@/components/StripeProvider";

import { addressApi } from "@/api/addresses";
import { ordersService } from "@/api/orders";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Address } from "@/types/database";
import AddressForm from "./account/AddressForm";
import apiClient from "@/lib/apiClient";
import { useCompanyCurrency } from "@/hooks/useCompanyCurrency";
import { getCompanyCurrency } from "@/lib/utils";
import { CartTrustPillars } from "@/components/cart/CartTrustPillars";
import { CartBottomBanner } from "@/components/cart/CartBottomBanner";

export default function CheckoutPage() {
  const { formatCurrency } = useCompanyCurrency();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { state: cartState, clearCart, removeFromCart } = useCart();
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [isInitializingPayment, setIsInitializingPayment] = useState(false);

  // Shipping & Billing Options
  const [shippingMethod, setShippingMethod] = useState<'standard' | 'express'>('standard');
  const [sameAsShipping, setSameAsShipping] = useState(true);
  const [billingDetails, setBillingDetails] = useState({
    fullName: (user?.user_metadata as any)?.full_name || (user?.user_metadata as any)?.name || '',
    email: user?.email || '',
    phone: '',
    gstNumber: '',
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const [deliveryDate, setDeliveryDate] = useState<string>(todayStr);
  const [selectedSlot, setSelectedSlot] = useState<string>('Morning (07:00 AM - 10:00 AM)');

  const TIME_SLOTS = [
    { id: 'slot-1', title: 'Morning', time: '07:00 AM - 10:00 AM', icon: '🌅', full: 'Morning (07:00 AM - 10:00 AM)' },
    { id: 'slot-2', title: 'Midday', time: '10:00 AM - 01:00 PM', icon: '☀️', full: 'Midday (10:00 AM - 01:00 PM)' },
    { id: 'slot-3', title: 'Afternoon', time: '02:00 PM - 05:00 PM', icon: '🌤️', full: 'Afternoon (02:00 PM - 05:00 PM)' },
    { id: 'slot-4', title: 'Evening', time: '06:00 PM - 09:00 PM', icon: '🌙', full: 'Evening (06:00 PM - 09:00 PM)' },
  ];

  // Fetch user's addresses
  const {
    data: addresses = [],
    isLoading: isLoadingAddresses,
    isError: addressError,
    refetch: refetchAddresses,
  } = useQuery({
    queryKey: ['addresses'],
    queryFn: addressApi.getAddresses,
  });

  // Set default address as selected if available
  useEffect(() => {
    if (addresses.length > 0) {
      const defaultAddress = addresses.find((addr) => addr.is_default);
      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
      } else if (!selectedAddressId) {
        setSelectedAddressId(addresses[0].id);
      }
    }
  }, [addresses, selectedAddressId]);

  // Create order mutation
  const createOrder = useMutation({
    mutationFn: ordersService.create,
    onSuccess: () => {
      toast.success('Order placed successfully!');
      clearCart();
      setIsProcessing(false);
      navigate('/thank-you');
    },
    onError: (error: any) => {
      let message = 'Failed to place order. Please try again.';
      if (error?.response?.data?.error) {
        message = error.response.data.error;
      }
      toast.error(message);
      setIsProcessing(false);
    },
  });

  // Calculations
  const subtotal = cartState.subtotal;
  const isStandardFree = subtotal >= 100;
  const standardFee = isStandardFree ? 0 : 10;
  const expressFee = 99;
  const shippingCost = shippingMethod === 'standard' ? standardFee : expressFee;
  const taxAmount = 0; // Tax is inclusive
  const totalAmount = subtotal + shippingCost + taxAmount;

  const handleProceedToPayment = async () => {
    if (!selectedAddressId) {
      toast.error('Please select a delivery address');
      return;
    }

    if (!selectedSlot) {
      toast.error('Please select a delivery time slot');
      return;
    }

    if (cartState.items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    try {
      setIsProcessing(true);
      setIsInitializingPayment(true);

      const selectedAddress = addresses.find((addr) => addr.id === selectedAddressId);
      if (!selectedAddress) {
        toast.error('Selected address not found');
        setIsProcessing(false);
        setIsInitializingPayment(false);
        return;
      }

      const items = cartState.items.map((cartItem) => ({
        product_id: cartItem.id,
        variant_id: cartItem.variant_id,
        quantity: cartItem.quantity,
        price: cartItem.sale_price ?? cartItem.price,
      }));

      const orderDataToSave = {
        items,
        shipping_address_id: selectedAddressId,
        billing_address_id: selectedAddressId,
        payment_method: 'card',
        total_amount: totalAmount,
        tax_amount: taxAmount,
        tax_rate: 0,
        status: 'pending',
        payment_status: 'pending',
        delivery_slot: selectedSlot,
        delivery_date: deliveryDate,
        shipping_method: shippingMethod,
        billing_details: sameAsShipping ? null : billingDetails,
      };

      console.log('Preparing order data for payment:', orderDataToSave);

      const { data } = await apiClient.post('/payments/create-payment-intent', {
        amount: totalAmount,
        currency: getCompanyCurrency().toLowerCase(),
      });
      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);

      setOrderData({
        ...orderDataToSave,
        payment_intent_id: data.paymentIntentId,
      });
      setShowPayment(true);
      setIsProcessing(false);
      setIsInitializingPayment(false);
    } catch (error) {
      console.error('Error preparing payment:', error);
      toast.error('Failed to prepare payment');
      setIsProcessing(false);
      setIsInitializingPayment(false);
    }
  };

  const handlePaymentSuccess = async () => {
    if (!orderData) {
      toast.error('Order data not found');
      return;
    }

    try {
      setIsProcessing(true);
      console.log('Creating order with data:', orderData);
      await createOrder.mutateAsync(orderData);
      toast.success('Order placed successfully!');
      clearCart();
      setIsProcessing(false);
      navigate('/thank-you');
    } catch (error) {
      console.error('Error creating order after payment:', error);
      toast.error('Payment successful but order creation failed. Please contact support.');
      setIsProcessing(false);
    }
  };

  const handlePaymentFailure = () => {
    setShowPayment(false);
    setOrderData(null);
    setClientSecret(null);
    setPaymentIntentId(null);
    toast.error('Payment failed. Please try again.');
  };

  const handleBackToCheckout = () => {
    setShowPayment(false);
    setOrderData(null);
    setClientSecret(null);
    setPaymentIntentId(null);
  };

  const handleAddressAdded = (newAddress: Address) => {
    refetchAddresses();
    if (!editingAddressId) {
      setSelectedAddressId(newAddress.id);
    }
    setShowAddressForm(false);
    setEditingAddressId(null);
  };

  const handleDeleteAddress = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this address?')) {
      try {
        await addressApi.deleteAddress(id);
        toast.success('Address deleted');
        refetchAddresses();
        if (selectedAddressId === id) {
          setSelectedAddressId(null);
        }
      } catch (err) {
        toast.error('Failed to delete address');
      }
    }
  };

  const handleEditAddress = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAddressId(id);
    setShowAddressForm(true);
  };

  // Loading state
  if (isLoadingAddresses) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Navbar />
        <main className="flex-grow flex items-center justify-center py-20">
          <div className="text-center">
            <Spinner className="h-8 w-8 mx-auto mb-4 text-[#1E502B]" />
            <p className="text-gray-600 font-medium">Loading checkout information...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Address fetch error
  if (addressError) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Navbar />
        <main className="flex-grow flex items-center justify-center py-20">
          <div className="text-center max-w-md p-6 bg-red-50 rounded-2xl border border-red-100">
            <h2 className="text-xl font-bold mb-2 text-red-700">Something went wrong</h2>
            <p className="mb-6 text-sm text-red-600">
              We couldn't load your addresses. Please try again later.
            </p>
            <button
              onClick={() => refetchAddresses()}
              className="bg-[#1E502B] text-white px-6 py-2.5 rounded-full font-bold text-sm"
            >
              Retry
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

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

          {/* Checkout Header */}
          <div className="mb-6 pl-1 sm:pl-2">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-9 h-9 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32]">
                <Leaf className="w-5 h-5" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1E502B] tracking-tight">
                Checkout
              </h1>
            </div>
            <p className="text-sm sm:text-base font-medium text-gray-600">
              Complete your order and get ready to enjoy nature’s goodness.
            </p>
          </div>

          {/* 3-Step Progress Indicator */}
          <div className="max-w-xl mb-10 pl-1 sm:pl-2">
            <div className="flex items-center justify-between relative">
              {/* Step 1 */}
              <div className="flex flex-col items-center relative z-10">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                    !showPayment
                      ? 'bg-[#1E502B] text-white shadow-sm ring-4 ring-green-100'
                      : 'bg-[#2E7D32] text-white'
                  }`}
                >
                  1
                </div>
                <span className="text-xs sm:text-sm font-bold text-[#1E502B] mt-1.5">
                  Shipping Address
                </span>
              </div>

              {/* Connector line 1-2 */}
              <div
                className={`flex-1 h-0.5 mx-2 -mt-5 ${
                  showPayment ? 'bg-[#2E7D32]' : 'bg-gray-200'
                }`}
              />

              {/* Step 2 */}
              <div className="flex flex-col items-center relative z-10">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                    showPayment
                      ? 'bg-[#1E502B] text-white shadow-sm ring-4 ring-green-100'
                      : 'border-2 border-gray-300 text-gray-500 bg-white'
                  }`}
                >
                  2
                </div>
                <span
                  className={`text-xs sm:text-sm font-semibold mt-1.5 ${
                    showPayment ? 'text-[#1E502B]' : 'text-gray-500'
                  }`}
                >
                  Payment
                </span>
              </div>

              {/* Connector line 2-3 */}
              <div className="flex-1 h-0.5 mx-2 -mt-5 bg-gray-200" />

              {/* Step 3 */}
              <div className="flex flex-col items-center relative z-10">
                <div className="w-9 h-9 rounded-full border-2 border-gray-300 text-gray-500 bg-white flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <span className="text-xs sm:text-sm font-medium text-gray-400 mt-1.5">
                  Review & Place Order
                </span>
              </div>
            </div>
          </div>

          {/* Payment View (Step 2) */}
          {showPayment ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
              <div className="lg:col-span-8">
                <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm p-6 sm:p-8">
                  <button
                    onClick={handleBackToCheckout}
                    className="inline-flex items-center text-xs sm:text-sm font-bold text-[#2E7D32] hover:underline mb-6"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1.5" />
                    Back to Shipping & Details
                  </button>

                  <div className="flex items-center gap-2.5 text-[#1E502B] font-bold text-xl mb-2">
                    <CreditCard className="w-6 h-6 text-[#2E7D32]" />
                    <h2>Complete Secure Payment</h2>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-6">
                    Enter your card information below. Secured and encrypted powered by Stripe.
                  </p>

                  {clientSecret ? (
                    <StripeProvider clientSecret={clientSecret}>
                      <PaymentForm
                        amount={totalAmount}
                        clientSecret={clientSecret}
                        onSuccess={handlePaymentSuccess}
                        onFailure={handlePaymentFailure}
                      />
                    </StripeProvider>
                  ) : (
                    <div className="py-12 text-center">
                      <Spinner className="h-8 w-8 mx-auto mb-3 text-[#1E502B]" />
                      <p className="text-sm text-gray-600">Initializing secure payment...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Order Summary */}
              <div className="lg:col-span-4">
                <div className="bg-[#f4f8f1] rounded-3xl p-6 sm:p-7 border border-[#e2ede0] shadow-sm">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2 text-[#1E502B]">
                      <ShoppingCart className="w-5 h-5 text-[#2E7D32]" />
                      <h2 className="text-xl sm:text-2xl font-extrabold">Order Summary</h2>
                    </div>
                    <span className="text-xs font-semibold bg-[#e1eed8] text-[#1E502B] px-2.5 py-0.5 rounded-full">
                      {cartState.items.length} items
                    </span>
                  </div>

                  {/* Items Mini List */}
                  <div className="space-y-3.5 mb-5 max-h-72 overflow-y-auto pr-1">
                    {cartState.items.map((item) => {
                      const itemPrice = item.sale_price ?? item.price;
                      return (
                        <div
                          key={`${item.id}|${item.variant_id}`}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={item.image || '/placeholder.svg'}
                              alt={item.name}
                              className="w-12 h-12 rounded-xl object-cover bg-white border border-gray-100 shrink-0"
                            />
                            <div className="min-w-0">
                              <h4 className="font-bold text-gray-900 text-xs sm:text-sm line-clamp-1">
                                {item.name}
                              </h4>
                              <p className="text-[11px] text-gray-500">
                                Qty: {item.quantity} • {formatCurrency(itemPrice)}
                              </p>
                            </div>
                          </div>
                          <div className="font-bold text-gray-900 text-xs sm:text-sm shrink-0">
                            {formatCurrency(itemPrice * item.quantity)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-3 text-sm pt-4 border-t border-[#d8e8ce]">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span>
                      <span className="font-bold text-gray-900">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Shipping ({shippingMethod === 'standard' ? 'Standard' : 'Express'})</span>
                      <span className="font-semibold text-gray-800">
                        {shippingCost === 0 ? (
                          <span className="text-[#2E7D32] font-bold">Free</span>
                        ) : (
                          formatCurrency(shippingCost)
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Tax (if applicable)</span>
                      <span className="font-semibold text-gray-800">₹0</span>
                    </div>
                    <div className="pt-3 border-t border-[#d8e8ce]">
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

                  <div className="mt-6 flex items-start gap-3 p-4 bg-white/85 rounded-2xl border border-green-100 shadow-2xs">
                    <ShieldCheck className="w-5 h-5 text-[#2E7D32] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#1E502B]">
                        100% Secure Checkout
                      </h4>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Your payment is encrypted and completely safe.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Main Checkout Step 1 View */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
              {/* Left Column (Sections 1, 2, 3) */}
              <div className="lg:col-span-8 space-y-7">
                {/* 1. Shipping Address */}
                <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm p-6 sm:p-8">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2 text-[#1E502B] font-bold text-lg sm:text-xl">
                      <Leaf className="w-5 h-5 text-[#2E7D32]" />
                      <span>1. Shipping Address</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAddressId(null);
                        setShowAddressForm(true);
                      }}
                      className="text-xs sm:text-sm font-bold text-[#2E7D32] hover:underline"
                    >
                      + Add New Address
                    </button>
                  </div>

                  {addresses.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-2xl">
                      <MapPin className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500 mb-4">
                        You don't have any saved delivery addresses yet.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAddressId(null);
                          setShowAddressForm(true);
                        }}
                        className="bg-[#1E502B] hover:bg-[#276B3C] text-white text-xs sm:text-sm font-bold py-2.5 px-6 rounded-full"
                      >
                        Add Address
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {addresses.map((address: Address) => {
                        const isSelected = selectedAddressId === address.id;
                        return (
                          <div
                            key={address.id}
                            onClick={() => setSelectedAddressId(address.id)}
                            className={`p-4 sm:p-5 rounded-2xl cursor-pointer transition-all border ${
                              isSelected
                                ? 'bg-[#f4f8f1] border-[#2E7D32] shadow-2xs'
                                : 'bg-white border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                {/* Radio Indicator */}
                                <div
                                  className={`w-5 h-5 rounded-full mt-0.5 border flex items-center justify-center shrink-0 ${
                                    isSelected
                                      ? 'border-[#2E7D32] bg-[#2E7D32]'
                                      : 'border-gray-300 bg-white'
                                  }`}
                                >
                                  {isSelected && (
                                    <div className="w-2 h-2 rounded-full bg-white" />
                                  )}
                                </div>

                                <div>
                                  <div className="font-bold text-sm sm:text-base text-gray-900">
                                    {(address as any).recipient_name ||
                                      (user?.user_metadata as any)?.full_name ||
                                      `${address.address_type === 'shipping' ? 'Shipping' : 'Delivery'} Address`}
                                  </div>
                                  <div className="text-xs sm:text-sm text-gray-600 mt-1 leading-relaxed">
                                    {address.address_line1}
                                    {address.address_line2 && `, ${address.address_line2}`}
                                    {address.city && `, ${address.city}`}
                                    {address.postal_code && ` - ${address.postal_code}`}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {address.country || 'India'}
                                  </div>
                                </div>
                              </div>

                              {/* Edit & Delete Action Buttons */}
                              <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => handleEditAddress(address.id, e)}
                                  className="inline-flex items-center gap-1 hover:text-[#2E7D32] p-1"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>
                                <span>|</span>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteAddress(address.id, e)}
                                  className="inline-flex items-center gap-1 hover:text-red-600 p-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Add New Address Radio Box Option */}
                      <div
                        onClick={() => {
                          setEditingAddressId(null);
                          setShowAddressForm(true);
                        }}
                        className="p-4 rounded-2xl cursor-pointer border border-dashed border-gray-300 hover:border-[#2E7D32] flex items-center gap-3 text-sm text-gray-600 hover:text-[#2E7D32] transition-colors"
                      >
                        <div className="w-5 h-5 rounded-full border border-gray-300 bg-white flex items-center justify-center shrink-0" />
                        <span className="font-semibold">+ Add a new address</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Shipping Method */}
                <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm p-6 sm:p-8">
                  <div className="flex items-center gap-2 text-[#1E502B] font-bold text-lg sm:text-xl mb-5">
                    <Leaf className="w-5 h-5 text-[#2E7D32]" />
                    <span>2. Shipping Method</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Standard Delivery */}
                    <div
                      onClick={() => setShippingMethod('standard')}
                      className={`p-4 sm:p-5 rounded-2xl cursor-pointer transition-all border flex items-center justify-between ${
                        shippingMethod === 'standard'
                          ? 'bg-[#f4f8f1] border-[#2E7D32] shadow-2xs'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            shippingMethod === 'standard'
                              ? 'border-[#2E7D32] bg-[#2E7D32]'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          {shippingMethod === 'standard' && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-sm sm:text-base text-gray-900">
                            Standard Delivery
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">3–5 business days</div>
                        </div>
                      </div>
                      <div className="font-bold text-sm sm:text-base text-[#1E502B]">
                        {isStandardFree ? 'Free' : formatCurrency(standardFee)}
                      </div>
                    </div>

                    {/* Express Delivery */}
                    <div
                      onClick={() => setShippingMethod('express')}
                      className={`p-4 sm:p-5 rounded-2xl cursor-pointer transition-all border flex items-center justify-between ${
                        shippingMethod === 'express'
                          ? 'bg-[#f4f8f1] border-[#2E7D32] shadow-2xs'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            shippingMethod === 'express'
                              ? 'border-[#2E7D32] bg-[#2E7D32]'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          {shippingMethod === 'express' && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-sm sm:text-base text-gray-900">
                            Express Delivery
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">1–2 business days</div>
                        </div>
                      </div>
                      <div className="font-bold text-sm sm:text-base text-[#1E502B]">
                        {formatCurrency(expressFee)}
                      </div>
                    </div>
                  </div>

                  {/* Delivery Schedule (Slot & Date) */}
                  <div className="mt-6 pt-5 border-t border-gray-100">
                    <h3 className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
                      Preferred Delivery Schedule
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#2E7D32]" />
                          <span>Delivery Date</span>
                        </label>
                        <input
                          type="date"
                          min={todayStr}
                          value={deliveryDate}
                          onChange={(e) => setDeliveryDate(e.target.value)}
                          className="w-full px-3.5 py-2 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#2E7D32]" />
                          <span>Time Slot</span>
                        </label>
                        <select
                          value={selectedSlot}
                          onChange={(e) => setSelectedSlot(e.target.value)}
                          className="w-full px-3.5 py-2 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E7D32] bg-white"
                        >
                          {TIME_SLOTS.map((slot) => (
                            <option key={slot.id} value={slot.full}>
                              {slot.icon} {slot.full}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Billing Details */}
                <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm p-6 sm:p-8">
                  <div className="flex items-center gap-2 text-[#1E502B] font-bold text-lg sm:text-xl mb-4">
                    <Leaf className="w-5 h-5 text-[#2E7D32]" />
                    <span>3. Billing Details</span>
                  </div>

                  {/* Same as shipping address checkbox */}
                  <div className="mb-6">
                    <label className="inline-flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sameAsShipping}
                        onChange={(e) => setSameAsShipping(e.target.checked)}
                        className="w-4 h-4 text-[#1E502B] rounded border-gray-300 focus:ring-[#2E7D32]"
                      />
                      <span className="text-xs sm:text-sm font-semibold text-gray-800">
                        Same as shipping address
                      </span>
                    </label>
                  </div>

                  {/* Billing Fields (2x2 Grid) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        placeholder="Enter your name"
                        value={billingDetails.fullName}
                        onChange={(e) =>
                          setBillingDetails({ ...billingDetails, fullName: e.target.value })
                        }
                        className="w-full px-4 py-2.5 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E7D32] bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        placeholder="you@example.com"
                        value={billingDetails.email}
                        onChange={(e) =>
                          setBillingDetails({ ...billingDetails, email: e.target.value })
                        }
                        className="w-full px-4 py-2.5 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E7D32] bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={billingDetails.phone}
                        onChange={(e) =>
                          setBillingDetails({ ...billingDetails, phone: e.target.value })
                        }
                        className="w-full px-4 py-2.5 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E7D32] bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        GST Number (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="Enter GST number"
                        value={billingDetails.gstNumber}
                        onChange={(e) =>
                          setBillingDetails({ ...billingDetails, gstNumber: e.target.value })
                        }
                        className="w-full px-4 py-2.5 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E7D32] bg-white"
                      />
                    </div>
                  </div>

                  {/* Continue Button */}
                  <div className="mt-8">
                    <button
                      type="button"
                      onClick={handleProceedToPayment}
                      disabled={isProcessing || !selectedAddressId || cartState.items.length === 0}
                      className="bg-[#1E502B] hover:bg-[#276B3C] text-white font-bold py-3.5 px-8 rounded-full shadow-md hover:shadow-lg transition-all text-xs sm:text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <span>Continue to Payment →→</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Order Summary Card */}
              <div className="lg:col-span-4">
                <div className="bg-[#f4f8f1] rounded-3xl p-6 sm:p-7 border border-[#e2ede0] shadow-sm sticky top-6">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2 text-[#1E502B]">
                      <ShoppingCart className="w-5 h-5 text-[#2E7D32]" />
                      <h2 className="text-xl sm:text-2xl font-extrabold">Order Summary</h2>
                    </div>
                    <span className="text-xs font-semibold bg-[#e1eed8] text-[#1E502B] px-2.5 py-0.5 rounded-full">
                      {cartState.items.length} items
                    </span>
                  </div>

                  {/* Compact Items List */}
                  <div className="space-y-3.5 mb-5 max-h-72 overflow-y-auto pr-1 divide-y divide-gray-100">
                    {cartState.items.map((item) => {
                      const itemPrice = item.sale_price ?? item.price;
                      const unitDisplay = item.unit
                        ? `${item.unit} ${item.unit_type || ''}`
                        : item.variant_name || '1 unit';

                      return (
                        <div
                          key={`${item.id}|${item.variant_id}`}
                          className="pt-3 first:pt-0 flex items-center justify-between gap-3 text-sm"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={item.image || '/placeholder.svg'}
                              alt={item.name}
                              className="w-14 h-14 rounded-2xl object-cover bg-white border border-gray-100 shrink-0"
                            />
                            <div className="min-w-0">
                              <h4 className="font-bold text-gray-900 text-xs sm:text-sm line-clamp-1">
                                {item.name}
                              </h4>
                              <p className="text-[11px] text-gray-500 mt-0.5">{unitDisplay}</p>
                              <p className="font-extrabold text-xs text-gray-800 mt-0.5">
                                {formatCurrency(itemPrice)}
                              </p>
                              <p className="text-[10px] text-gray-500">Qty: {item.quantity}</p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2 shrink-0">
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

                  {/* Calculations */}
                  <div className="space-y-3 text-sm pt-4 border-t border-[#d8e8ce]">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal ({cartState.items.length} items)</span>
                      <span className="font-bold text-gray-900">{formatCurrency(subtotal)}</span>
                    </div>

                    <div className="flex justify-between text-gray-600">
                      <span>Shipping Charges</span>
                      <span className="font-semibold text-gray-800">
                        {shippingCost === 0 ? (
                          <span className="text-[#2E7D32] font-bold">Free</span>
                        ) : (
                          formatCurrency(shippingCost)
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between text-gray-600">
                      <span>Tax (if applicable)</span>
                      <span className="font-semibold text-gray-800">₹0</span>
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

                  {/* Proceed to Payment Action Button */}
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={handleProceedToPayment}
                      disabled={isProcessing || !selectedAddressId || cartState.items.length === 0}
                      className="w-full bg-[#1E502B] hover:bg-[#276B3C] text-white font-bold py-3.5 px-6 rounded-full flex items-center justify-center gap-2 shadow-sm transition text-sm sm:text-base disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" />
                          <span>Proceed to Payment →</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Security Assurance Badge */}
                  <div className="mt-6 flex items-start gap-3 p-4 bg-white/85 rounded-2xl border border-green-100 shadow-2xs">
                    <div className="w-9 h-9 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32] shrink-0 mt-0.5">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#1E502B]">
                        100% Secure Checkout
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

      {/* Address Form Modal */}
      {showAddressForm && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center overflow-auto p-4"
          onClick={() => setShowAddressForm(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 border border-green-100"
            onClick={(e) => e.stopPropagation()}
          >
            <AddressForm
              editId={editingAddressId}
              onClose={() => {
                setShowAddressForm(false);
                setEditingAddressId(null);
              }}
              onAddressAdded={handleAddressAdded}
            />
          </div>
        </div>
      )}
    </div>
  );
}
