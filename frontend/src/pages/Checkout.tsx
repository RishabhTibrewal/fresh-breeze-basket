import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckCircle, Plus, MapPin, CreditCard, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { PaymentForm } from "@/components/PaymentForm";
import { StripeProvider } from "@/components/StripeProvider";

import { addressApi } from "@/api/addresses";
import { ordersService } from "@/api/orders";
import { useCart } from "@/contexts/CartContext";
import { Address } from "@/types/database";
import AddressForm from "./account/AddressForm";
import { API_BASE_URL } from "@/config";
import { paymentsService } from '@/api/payments';
import  apiClient  from '@/lib/apiClient';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { state: cartState, clearCart } = useCart();
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [isInitializingPayment, setIsInitializingPayment] = useState(false);

  // Fetch user's addresses
  const { 
    data: addresses = [], 
    isLoading: isLoadingAddresses,
    isError: addressError,
    refetch: refetchAddresses
  } = useQuery({
    queryKey: ["addresses"],
    queryFn: addressApi.getAddresses,
  });

  // Set default address as selected if available
  useEffect(() => {
    if (addresses.length > 0) {
      const defaultAddress = addresses.find(addr => addr.is_default);
      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
      } else {
        setSelectedAddressId(addresses[0].id);
      }
    }
  }, [addresses]);

  // Create order mutation
  const createOrder = useMutation({
    mutationFn: ordersService.create,
    onSuccess: (data) => {
      toast.success("Order placed successfully!");
      clearCart();
      setIsProcessing(false);
      navigate("/thank-you");
    },
    onError: (error: any) => {
      let message = "Failed to place order. Please try again.";
      if (error?.response?.data?.error) {
        message = error.response.data.error;
      }
      toast.error(message);
      setIsProcessing(false);
    }
  });

  const handleProceedToPayment = async () => {
    if (!selectedAddressId) {
      toast.error("Please select a delivery address");
      return;
    }

    if (cartState.items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    try {
      setIsProcessing(true);
      setIsInitializingPayment(true);
      
      // Get the selected address details
      const selectedAddress = addresses.find(addr => addr.id === selectedAddressId);
      
      if (!selectedAddress) {
        toast.error("Selected address not found");
        setIsProcessing(false);
        setIsInitializingPayment(false);
        return;
      }
      
      // Build order items directly from cart — variant prices are already accurate
      // (loaded from product_prices via the backend cart sync)
      const items = cartState.items.map(cartItem => ({
          product_id: cartItem.id,
        variant_id: cartItem.variant_id,                 // send the selected variant
          quantity: cartItem.quantity,
        price: cartItem.sale_price ?? cartItem.price,   // use variant's sale_price, fall back to MRP
      }));
      
      // Calculate total amount from cart prices
      const subtotal = items.reduce((total, item) => total + (item.price * item.quantity), 0);
      const shippingCost = subtotal >= 100 ? 0 : 10;
      const taxRate = 0.05; // 5% tax rate
      const taxAmount = subtotal * taxRate;
      const totalAmount = subtotal + shippingCost + taxAmount;
      
      // Store order data for payment step (don't create order yet)
      const orderDataToSave = {
        items,
        shipping_address_id: selectedAddressId,
        billing_address_id: selectedAddressId,
        payment_method: 'card',
        total_amount: totalAmount,
        tax_amount: taxAmount,
        tax_rate: taxRate,
        status: 'pending',
        payment_status: 'pending'
      };

      console.log('Preparing order data for payment:', orderDataToSave);
      
      // Create payment intent first (without order ID)
      const { data } = await apiClient.post('/payments/create-payment-intent', {
        amount: totalAmount
      });
      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);
      
      // Store order data for after payment (include payment intent ID)
      setOrderData({
        ...orderDataToSave,
        payment_intent_id: data.paymentIntentId
      });
      setShowPayment(true);
      setIsProcessing(false);
      setIsInitializingPayment(false);
      
    } catch (error) {
      console.error("Error preparing payment:", error);
      toast.error("Failed to prepare payment");
      setIsProcessing(false);
      setIsInitializingPayment(false);
    }
  };

  const handlePaymentSuccess = async () => {
    if (!orderData) {
      toast.error("Order data not found");
      return;
    }

    try {
      setIsProcessing(true);
      
      console.log('Creating order with data:', orderData);
      console.log('Payment intent ID in orderData:', orderData.payment_intent_id);
      
      // Create the order after successful payment
      const orderResult = await createOrder.mutateAsync(orderData);
      const orderId = orderResult.order_id;
      
      console.log('Order created after payment with ID:', orderId);
      
      toast.success("Order placed successfully!");
      clearCart();
      setIsProcessing(false);
      navigate("/thank-you");
      
    } catch (error) {
      console.error("Error creating order after payment:", error);
      toast.error("Payment successful but order creation failed. Please contact support.");
      setIsProcessing(false);
    }
  };

  const handlePaymentFailure = () => {
    // Reset payment state and go back to checkout
    setShowPayment(false);
    setOrderData(null);
    setClientSecret(null);
    setPaymentIntentId(null);
    toast.error("Payment failed. Please try again.");
  };

  const handleBackToCheckout = () => {
    setShowPayment(false);
    setOrderData(null);
    setClientSecret(null);
    setPaymentIntentId(null);
  };

  // Handle address added
  const handleAddressAdded = (newAddress: Address) => {
    if (editingAddressId) {
      refetchAddresses();
    } else {
      refetchAddresses();
      // Select the newly added address
      setSelectedAddressId(newAddress.id);
    }
    setShowAddressForm(false);
    setEditingAddressId(null);
  };

  // Calculate totals
  const subtotal = cartState.subtotal;
  const shippingCost = subtotal >= 100 ? 0 : 10;
  const taxAmount = subtotal * 0.05;
  const totalAmount = subtotal + shippingCost + taxAmount;

  // Handle loading state
  if (isLoadingAddresses) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <Spinner className="h-8 w-8 mx-auto mb-4" />
            <p className="text-gray-600">Loading checkout information...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // If there's an error fetching addresses
  if (addressError) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center max-w-md p-6">
            <h2 className="text-2xl font-bold mb-4 text-red-600">Something went wrong</h2>
            <p className="mb-6">We couldn't load your addresses. Please try again later.</p>
            <Button onClick={() => refetchAddresses()}>Retry</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Payment step
  if (showPayment) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow bg-gray-50 py-8">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="mb-6">
              <Button 
                variant="ghost" 
                onClick={handleBackToCheckout}
                className="mb-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Checkout
              </Button>
              <h1 className="text-2xl md:text-3xl font-bold">Complete Payment</h1>
              <p className="text-gray-600 mt-2">Secure payment powered by Stripe</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Payment Form */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-6">Payment Details</h2>
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
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-gray-600">Initializing payment...</p>
                  </div>
                )}
              </div>

              {/* Order Summary */}
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle>Order Summary</CardTitle>
                    <CardDescription>Review your order details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Products */}
                    <div className="space-y-3">
                      {cartState.items.map((item) => (
                        <div key={item.id} className="flex justify-between">
                          <div className="flex-1">
                            <div className="font-medium">{item.name}</div>
                            <div className="text-sm text-gray-500">
                              {item.quantity} x {item.sale_price ? (
                                <>
                                  <span className="text-red-500">₹ {item.sale_price.toFixed(2)}</span>
                                  <span className="line-through ml-1 text-gray-400">₹ {item.price.toFixed(2)}</span>
                                </>
                              ) : (
                                <span>₹ {item.price.toFixed(2)}</span>
                              )}
                              <span className="ml-1">/{item.unit} {item.unit_type}</span>
                            </div>
                          </div>
                          <div className="text-right font-medium">
                            ₹ {((item.sale_price || item.price) * item.quantity).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    {/* Totals */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="font-medium">₹ {subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Shipping</span>
                        <span className="font-medium">
                          {shippingCost === 0 ? "Free" : `₹ ${shippingCost.toFixed(2)}`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tax (5%)</span>
                        <span className="font-medium">₹ {taxAmount.toFixed(2)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span>₹ {totalAmount.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Security Notice */}
                    <div className="mt-4 p-3 bg-green-50 rounded-md">
                      <h4 className="text-sm font-medium text-green-800 mb-1">Secure Payment</h4>
                      <p className="text-xs text-green-700">
                        • Your payment information is encrypted and secure
                      </p>
                      <p className="text-xs text-green-700">
                        • We never store your card details
                      </p>
                      <p className="text-xs text-green-700">
                        • Powered by Stripe for maximum security
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Main checkout step
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl md:text-3xl font-bold mb-8">Checkout</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Delivery Address */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Delivery Address</h2>
                  <Button 
                    variant="ghost" 
                    className="inline-flex items-center text-primary hover:bg-primary/5"
                    onClick={() => {
                      setEditingAddressId(null);
                      setShowAddressForm(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add New Address
                  </Button>
                </div>

                {addresses.length === 0 ? (
                  <div className="text-center py-6 border border-dashed rounded-md">
                    <MapPin className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 mb-4">You don't have any saved addresses yet</p>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setEditingAddressId(null);
                        setShowAddressForm(true);
                      }}
                    >
                      Add Address
                    </Button>
                  </div>
                ) : (
                  <RadioGroup 
                    value={selectedAddressId || undefined} 
                    onValueChange={setSelectedAddressId}
                    className="grid gap-4"
                  >
                    {addresses.map((address: Address) => (
                      <div 
                        key={address.id} 
                        className={`p-4 border rounded-md ${selectedAddressId === address.id ? 'border-primary bg-primary/5' : 'border-gray-200'}`}
                      >
                        <div className="flex items-start space-x-3">
                          <RadioGroupItem value={address.id} id={`address-${address.id}`} className="mt-1" />
                          <div className="flex-1">
                            <Label 
                              htmlFor={`address-${address.id}`}
                              className="flex items-center text-base font-medium cursor-pointer"
                            >
                              Address {address.address_type}
                              {address.is_default && (
                                <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                  Default
                                </span>
                              )}
                            </Label>
                            <div className="text-sm text-gray-500 mt-1">
                              <div>{address.address_line1}</div>
                              {address.address_line2 && <div>{address.address_line2}</div>}
                              <div>
                                {address.city}, {address.state} {address.postal_code}
                              </div>
                              <div>{address.country}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                )}
              </div>

              {/* Payment Method */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-6">Payment Method</h2>
                <RadioGroup defaultValue="card" className="grid gap-4">
                  <div className="flex items-center space-x-3 p-4 border rounded-md border-primary bg-primary/5">
                    <RadioGroupItem value="card" id="payment-card" checked={true} />
                    <Label htmlFor="payment-card" className="flex items-center cursor-pointer">
                      <CreditCard className="h-5 w-5 mr-2" />
                      <span>Pay with Card (Secure payment via Stripe)</span>
                    </Label>
                  </div>
                </RadioGroup>
                <p className="text-sm text-gray-500 mt-4">
                  Your card will be charged securely through Stripe. All transactions are encrypted and secure.
                </p>
              </div>
            </div>

            {/* Right Column - Order Summary */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                  <CardDescription>Review your order before payment</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Products */}
                  <div className="space-y-3">
                    {cartState.items.map((item) => (
                      <div key={item.id} className="flex justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{item.name}</div>
                          <div className="text-sm text-gray-500">
                            {item.quantity} x {item.sale_price ? (
                              <>
                                <span className="text-red-500">₹ {item.sale_price.toFixed(2)}</span>
                                <span className="line-through ml-1 text-gray-400">₹ {item.price.toFixed(2)}</span>
                              </>
                            ) : (
                              <span>₹ {item.price.toFixed(2)}</span>
                            )}
                            <span className="ml-1">/{item.unit} {item.unit_type}</span>
                          </div>
                        </div>
                        <div className="text-right font-medium">
                          ₹ {((item.sale_price || item.price) * item.quantity).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Totals */}
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-medium">₹ {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Shipping</span>
                      <span className="font-medium">
                        {shippingCost === 0 ? "Free" : `₹ ${shippingCost.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tax (5%)</span>
                      <span className="font-medium">₹ {taxAmount.toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>₹ {totalAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Order Processing Information */}
                  <div className="mt-4 p-3 bg-blue-50 rounded-md">
                    <h4 className="text-sm font-medium text-blue-800 mb-1">Order Processing</h4>
                    <p className="text-xs text-blue-700">
                      • Orders can be cancelled within 5 minutes of placing
                    </p>
                    <p className="text-xs text-blue-700">
                      • After 5 minutes, your order status changes to "Processing"
                    </p>
                    <p className="text-xs text-blue-700">
                      • Products are reserved and delivery is scheduled for 3 days later
                    </p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full"
                    onClick={handleProceedToPayment}
                    disabled={isProcessing || !selectedAddressId || cartState.items.length === 0}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Proceed to Payment'
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />

      {/* Address Form Modal */}
      {showAddressForm && (
        <div 
          className="fixed inset-0 bg-black/5 backdrop-blur-sm z-50 flex items-center justify-center overflow-auto"
          onClick={() => setShowAddressForm(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto m-4"
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