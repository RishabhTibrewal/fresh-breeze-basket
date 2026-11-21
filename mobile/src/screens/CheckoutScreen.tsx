import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../theme/theme';
import { useStore } from '../store/useStore';
import {
  MapPin,
  CreditCard,
  Smartphone,
  CheckCircle,
  ShieldCheck,
  Lock,
  Clock,
  Banknote,
  ArrowRight,
  ArrowLeft,
  User,
} from 'lucide-react-native';
import { useStripe } from '../utils/stripe';
import { apiClient } from '../api/client';
import { formatCurrency, getCompanyCurrency } from '../utils/currency';
import { sendLocalOrderNotification } from '../utils/notifications';

const DELIVERY_SLOTS = [
  { id: '1', title: '🌅 Morning Express', time: '07:00 AM - 10:00 AM', tag: 'Fastest' },
  { id: '2', title: '☀️ Midday Prime', time: '11:00 AM - 02:00 PM', tag: 'Popular' },
  { id: '3', title: '🌤️ Afternoon', time: '03:00 PM - 06:00 PM', tag: 'Standard' },
  { id: '4', title: '🌙 Evening Harvest', time: '07:00 PM - 10:00 PM', tag: 'Fresh Batch' },
];

export const CheckoutScreen = ({ route, navigation }: any) => {
  const { total = 0 } = route.params || {};
  const { selectedAddress, cart, clearCart, user, token } = useStore();
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'upi' | 'cod'>('cod');
  const [selectedSlot, setSelectedSlot] = useState<string>('07:00 AM - 10:00 AM');
  const [loading, setLoading] = useState(false);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const handlePlaceOrder = async () => {
    console.log('🔘 [Checkout] handlePlaceOrder clicked! token:', !!token, 'cart:', cart.length, 'total:', total, 'paymentMethod:', paymentMethod);

    if (!token) {
      console.log('⚠️ [Checkout] User is not signed in. Navigating to Login.');
      navigation.navigate('Login');
      return;
    }

    if (cart.length === 0) {
      Alert.alert('Empty Basket', 'Your shopping basket is empty. Please add items to place an order.');
      navigation.navigate('HomeTab');
      return;
    }

    setLoading(true);
    let paymentIntentId: string | undefined = undefined;

    try {
      const isOnline = paymentMethod === 'online' || paymentMethod === 'upi';
      const currencyCode = getCompanyCurrency().toLowerCase();

      // Check minimum transaction amount for Stripe (requires minimum ~200 fils / ~₹50 INR)
      if (isOnline) {
        if (total < 50 && currencyCode === 'inr') {
          Alert.alert(
            'Minimum Online Order Value',
            'Card / UPI payment gateway requires a minimum basket value of ₹50. Please select "Pay on Delivery" (COD) or add items to your basket to proceed with online card checkout.',
            [
              { text: 'Switch to Pay on Delivery', onPress: () => setPaymentMethod('cod') },
              { text: 'OK' },
            ]
          );
          setLoading(false);
          return;
        }

        try {
          const response = await apiClient.post('/payments/create-payment-intent', {
            amount: total,
            currency: currencyCode,
          });

          if (response.data && response.data.clientSecret) {
            paymentIntentId = response.data.paymentIntentId || response.data.id;

            // Only invoke native Stripe sheet on real iOS/Android devices
            if (Platform.OS !== 'web') {
              const { error: initError } = await initPaymentSheet({
                paymentIntentClientSecret: response.data.clientSecret,
                merchantDisplayName: 'FreshBasket Farm Direct',
                defaultBillingDetails: {
                  address: {
                    postalCode: selectedAddress?.pincode || '400050',
                    country: 'IN',
                  },
                },
              });

              if (!initError) {
                const { error: paymentError } = await presentPaymentSheet();
                if (paymentError) {
                  if (paymentError.code !== 'Canceled') {
                    Alert.alert('Payment Incomplete', paymentError.message);
                  }
                  setLoading(false);
                  return;
                }
              }
            }
          }
        } catch (paymentErr: any) {
          const errMsg =
            paymentErr?.response?.data?.message ||
            paymentErr?.response?.data?.error?.message ||
            paymentErr?.response?.data?.error ||
            paymentErr?.message ||
            'Payment gateway error';
          Alert.alert(
            'Payment Gateway Notice',
            `${errMsg}\n\nTip: You can select "Pay on Delivery (Cash / UPI at Doorstep)" to place your order directly.`
          );
          setLoading(false);
          return;
        }
      }

      // Prepare order payload
      const isDbAddress = selectedAddress?.id && !selectedAddress.id.startsWith('addr-');
      const orderPayload: any = {
        items: cart.map((item) => ({
          product_id: item.id,
          variant_id: item.variant_id && item.variant_id !== 'default' ? item.variant_id : null,
          quantity: item.quantity,
          price: item.price,
          name: item.name,
        })),
        total_amount: total,
        payment_method: paymentMethod,
        payment_intent_id: paymentIntentId,
        delivery_slot: selectedSlot,
        delivery_date: new Date().toISOString().split('T')[0],
      };

      if (isDbAddress) {
        orderPayload.shipping_address_id = selectedAddress.id;
      } else {
        orderPayload.shipping_address = {
          address_line1: selectedAddress?.street || '123 Palm Grove Avenue',
          city: selectedAddress?.city || 'Mumbai',
          state: selectedAddress?.state || 'Maharashtra',
          postal_code: selectedAddress?.pincode || '400050',
          country: 'India',
        };
      }

      console.log('📦 [Checkout] Submitting order payload to backend...');

      // Create live order in database
      const createRes = await apiClient.post('/orders', orderPayload);
      console.log('✅ [Checkout] Order created response:', createRes.data);
      const createdOrder = createRes.data?.data || createRes.data;
      const realOrderId = createdOrder?.order_id || createdOrder?.id;

      if (!realOrderId) {
        throw new Error('Order creation did not return a valid order ID');
      }

      // Order created successfully! Now clear cart and notify
      clearCart();

      sendLocalOrderNotification(
        'Order Placed Successfully! 🥦',
        `Your order ${realOrderId} has been confirmed. FreshBasket is packing your harvest!`,
        realOrderId
      );

      // On Web & Native, navigate directly to live order tracking with the real ID
      navigation.replace('OrderTracking', { orderId: realOrderId });
    } catch (err: any) {
      console.error('❌ [Checkout] Checkout failed:', err?.response?.data || err?.message || err);
      const serverError =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Unable to process order. Please try again.';
      Alert.alert('Checkout Failed', serverError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Cart');
            }
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft color={COLORS.primaryDark} size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Express Checkout</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Sign In Required Notice (if guest/unauthenticated) */}
        {!token && (
          <TouchableOpacity
            style={styles.signInBanner}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.88}
          >
            <View style={styles.signInBannerIcon}>
              <User color={COLORS.primaryDark} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.signInBannerTitle}>Sign In to Complete Order</Text>
              <Text style={styles.signInBannerSubtitle}>
                Live tracking and order history require an account. Tap to sign in!
              </Text>
            </View>
            <ArrowRight color={COLORS.primaryDark} size={18} />
          </TouchableOpacity>
        )}

        {/* Delivery Address Review */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <MapPin color={COLORS.primaryDark} size={18} />
              <Text style={styles.cardHeaderTitle}>Delivery Address</Text>
            </View>
            <Text style={styles.tagDefault}>Default</Text>
          </View>
          <Text style={styles.addressLine}>{selectedAddress.street}</Text>
          <Text style={styles.addressCity}>
            {selectedAddress.city}, {selectedAddress.state} - {selectedAddress.pincode}
          </Text>
        </View>

        {/* Delivery Slot Selection */}
        <View style={styles.card}>
          <View style={styles.cardHeaderLeft}>
            <Clock color={COLORS.primaryDark} size={18} />
            <Text style={styles.cardHeaderTitle}>Select Delivery Slot</Text>
          </View>
          <View style={styles.slotsList}>
            {DELIVERY_SLOTS.map((slot) => {
              const isSelected = selectedSlot === slot.time;
              return (
                <TouchableOpacity
                  key={slot.id}
                  style={[styles.slotItem, isSelected && styles.slotItemSelected]}
                  onPress={() => setSelectedSlot(slot.time)}
                >
                  <View style={styles.slotRadio}>
                    {isSelected && <View style={styles.slotRadioInner} />}
                  </View>
                  <View style={styles.slotContent}>
                    <Text style={[styles.slotTitle, isSelected && styles.slotTitleSelected]}>
                      {slot.title}
                    </Text>
                    <Text style={styles.slotTime}>{slot.time}</Text>
                  </View>
                  <View style={styles.slotTag}>
                    <Text style={styles.slotTagText}>{slot.tag}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Payment Methods */}
        <View style={styles.card}>
          <View style={styles.cardHeaderLeft}>
            <CreditCard color={COLORS.primaryDark} size={18} />
            <Text style={styles.cardHeaderTitle}>Payment Method</Text>
          </View>

          {/* Pay on Delivery (Default & Recommended) */}
          <TouchableOpacity
            style={[styles.paymentOption, paymentMethod === 'cod' && styles.paymentOptionSelected]}
            onPress={() => setPaymentMethod('cod')}
          >
            <View style={styles.paymentRadio}>
              {paymentMethod === 'cod' && <View style={styles.slotRadioInner} />}
            </View>
            <View style={styles.paymentIconBox}>
              <Banknote color={COLORS.primary} size={20} />
            </View>
            <View style={styles.paymentTextCol}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.paymentTitle}>Pay on Delivery (Cash / UPI)</Text>
                <Text style={styles.tagDefault}>Recommended</Text>
              </View>
              <Text style={styles.paymentSubtitle}>Inspect fresh produce at your doorstep before paying</Text>
            </View>
          </TouchableOpacity>

          {/* Instant UPI */}
          <TouchableOpacity
            style={[styles.paymentOption, paymentMethod === 'upi' && styles.paymentOptionSelected]}
            onPress={() => setPaymentMethod('upi')}
          >
            <View style={styles.paymentRadio}>
              {paymentMethod === 'upi' && <View style={styles.slotRadioInner} />}
            </View>
            <View style={styles.paymentIconBox}>
              <Smartphone color="#FF9800" size={20} />
            </View>
            <View style={styles.paymentTextCol}>
              <Text style={styles.paymentTitle}>Instant UPI (Google Pay, PhonePe)</Text>
              <Text style={styles.paymentSubtitle}>One-tap seamless payment approval (Min ₹50)</Text>
            </View>
          </TouchableOpacity>

          {/* Online Cards / Apple Pay */}
          <TouchableOpacity
            style={[styles.paymentOption, paymentMethod === 'online' && styles.paymentOptionSelected]}
            onPress={() => setPaymentMethod('online')}
          >
            <View style={styles.paymentRadio}>
              {paymentMethod === 'online' && <View style={styles.slotRadioInner} />}
            </View>
            <View style={styles.paymentIconBox}>
              <CreditCard color={COLORS.primaryDark} size={20} />
            </View>
            <View style={styles.paymentTextCol}>
              <Text style={styles.paymentTitle}>Credit / Debit Cards & Apple Pay</Text>
              <Text style={styles.paymentSubtitle}>Secured with 256-bit Stripe Encryption (Min ₹50)</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Security Assurance */}
        <View style={styles.secureRow}>
          <Lock color={COLORS.primaryDark} size={16} />
          <Text style={styles.secureText}>
            Guaranteed safe checkout. 100% refund on unfulfilled items.
          </Text>
        </View>
      </ScrollView>

      {/* Place Order CTA Footer */}
      <View style={styles.footer}>
        <View style={styles.footerPriceCol}>
          <Text style={styles.footerLabel}>TOTAL PAYABLE</Text>
          <Text style={styles.footerValue}>{formatCurrency(total)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.placeOrderBtn, !token && styles.signInCtaBtn]}
          onPress={handlePlaceOrder}
          disabled={loading}
          activeOpacity={0.88}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : !token ? (
            <>
              <Text style={styles.placeOrderText}>Sign In to Place Order</Text>
              <ArrowRight color="#FFF" size={18} />
            </>
          ) : cart.length === 0 ? (
            <>
              <Text style={styles.placeOrderText}>Add Items to Basket</Text>
              <ArrowRight color="#FFF" size={18} />
            </>
          ) : (
            <>
              <Text style={styles.placeOrderText}>Place Order Now</Text>
              <ArrowRight color="#FFF" size={18} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgCanvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.bgWhite,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.card,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderGreen,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 110,
  },
  card: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm + 4,
    borderWidth: 1,
    borderColor: COLORS.borderGreen,
    ...SHADOWS.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  tagDefault: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primaryDark,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  addressLine: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  addressCity: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  slotsList: {
    gap: SPACING.sm,
  },
  slotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm + 4,
    backgroundColor: COLORS.bgCanvas,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.borderGreen,
  },
  slotItemSelected: {
    borderColor: COLORS.primaryDark,
    backgroundColor: COLORS.primaryLight,
  },
  slotRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm + 2,
  },
  slotRadioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: COLORS.primaryDark,
  },
  slotContent: {
    flex: 1,
  },
  slotTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  slotTitleSelected: {
    color: COLORS.primaryDark,
  },
  slotTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  slotTag: {
    backgroundColor: COLORS.bgWhite,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    borderColor: COLORS.borderGreen,
  },
  slotTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm + 4,
    backgroundColor: COLORS.bgCanvas,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.borderGreen,
    marginBottom: SPACING.sm,
  },
  paymentOptionSelected: {
    borderColor: COLORS.primaryDark,
    backgroundColor: COLORS.primaryLight,
  },
  paymentRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  paymentIconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgWhite,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm + 2,
    borderWidth: 1,
    borderColor: COLORS.borderGreen,
  },
  paymentTextCol: {
    flex: 1,
  },
  paymentTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  paymentSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
  },
  secureText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  signInBanner: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 2,
    ...SHADOWS.card,
  },
  signInBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgWhite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  signInBannerSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.bgWhite,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...SHADOWS.cardElevated,
    zIndex: 9999,
    elevation: 20,
  },
  footerPriceCol: {
    justifyContent: 'center',
  },
  footerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  footerValue: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  placeOrderBtn: {
    backgroundColor: COLORS.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg + 4,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    zIndex: 10000,
  },
  signInCtaBtn: {
    backgroundColor: '#E65100',
  },
  placeOrderText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
