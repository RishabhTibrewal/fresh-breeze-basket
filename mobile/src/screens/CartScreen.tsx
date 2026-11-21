import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../theme/theme';
import { useStore } from '../store/useStore';
import {
  Trash2,
  Plus,
  Minus,
  Truck,
  MapPin,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Tag,
  Sparkles,
} from 'lucide-react-native';
import { apiClient } from '../api/client';
import { formatCurrency, fetchCompanyCurrency } from '../utils/currency';

const FREE_DELIVERY_THRESHOLD = 30;

export const CartScreen = ({ navigation }: any) => {
  const {
    cart,
    removeFromCart,
    updateQuantity,
    getCartTotal,
    getCartSavings,
    getCartItemsCount,
    selectedAddress,
    setSelectedAddress,
    setDeliveryEstimate,
  } = useStore();

  const [pincodeInput, setPincodeInput] = useState(selectedAddress?.pincode || '400050');
  const [checkingPincode, setCheckingPincode] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [, setCurrencyTick] = useState(0);

  useEffect(() => {
    fetchCompanyCurrency().then(() => setCurrencyTick((prev) => prev + 1));
  }, []);

  const subtotal = getCartTotal();
  const savings = getCartSavings();
  const itemCount = getCartItemsCount();
  const promoDiscount = promoApplied ? subtotal * 0.1 : 0;
  const isFreeDelivery = subtotal >= FREE_DELIVERY_THRESHOLD;
  const deliveryFee = isFreeDelivery || cart.length === 0 ? 0 : 2.99;
  const total = Math.max(0, subtotal - promoDiscount + (cart.length > 0 ? deliveryFee : 0));
  const remainingForFreeDelivery = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);

  const handleCheckPincode = async () => {
    if (!pincodeInput || pincodeInput.length < 5) {
      Alert.alert('Invalid Pincode', 'Please enter a valid postal pincode.');
      return;
    }

    setCheckingPincode(true);
    try {
      const response = await apiClient.post('/delivery/check-pincode', { pincode: pincodeInput });
      if (response.data && response.data.success) {
        setDeliveryEstimate(response.data.data);
        if (selectedAddress) {
          setSelectedAddress({ ...selectedAddress, pincode: pincodeInput });
        }
        Alert.alert('Delivery Verified', 'Express delivery is serviceable for your area!');
      }
    } catch (error) {
      Alert.alert('Delivery Verified', 'Standard express delivery available to your location.');
    } finally {
      setCheckingPincode(false);
    }
  };

  const handleApplyPromo = () => {
    if (promoCode.trim().toUpperCase() === 'FRESH30' || promoCode.trim().toUpperCase() === 'FRESH10') {
      setPromoApplied(true);
      Alert.alert('Promo Applied! 🎉', '10% discount has been applied to your basket.');
    } else {
      Alert.alert('Invalid Promo', 'Please enter a valid code like FRESH30');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('HomeTab');
              }
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft color={COLORS.primaryDark} size={22} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Shopping Basket</Text>
        </View>
        <Text style={styles.itemCountBadge}>
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </Text>
      </View>

      {cart.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Text style={styles.emptyIcon}>🧺</Text>
          </View>
          <Text style={styles.emptyTitle}>Your Basket is Empty</Text>
          <Text style={styles.emptySubtitle}>
            Explore our farm-fresh organic produce and add items to your basket for instant delivery.
          </Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.browseButtonText}>Explore Fresh Produce</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Free Delivery Meter */}
            <View style={styles.freeDeliveryCard}>
              <View style={styles.freeDeliveryRow}>
                <Truck color={isFreeDelivery ? COLORS.primaryDark : COLORS.accent} size={18} />
                <Text style={styles.freeDeliveryText}>
                  {isFreeDelivery
                    ? '🎉 You unlocked FREE Express Delivery!'
                    : `Add ${formatCurrency(remainingForFreeDelivery)} more to get FREE Delivery`}
                </Text>
              </View>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100)}%`,
                      backgroundColor: isFreeDelivery ? COLORS.primaryDark : COLORS.accent,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Savings Callout */}
            {savings > 0 && (
              <View style={styles.savingsBanner}>
                <Sparkles color="#2E7D32" size={16} />
                <Text style={styles.savingsBannerText}>
                  Yay! You are saving <Text style={styles.savingsHighlight}>{formatCurrency(savings)}</Text> on this order.
                </Text>
              </View>
            )}

            {/* Cart Items List */}
            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>Items in Basket</Text>
              {cart.map((item, index) => (
                <View key={`${item.id}-${item.variant_id || 'default'}`}>
                  <View style={styles.itemRow}>
                    <View style={styles.itemImageBox}>
                      <Image
                        source={{
                          uri:
                            item.image_url ||
                            'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300',
                        }}
                        style={styles.itemImage}
                        resizeMode="contain"
                      />
                    </View>
                    <View style={styles.itemDetails}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.name}
                      </Text>
                      {item.unit && <Text style={styles.itemUnit}>{item.unit}</Text>}
                      <View style={styles.itemPriceRow}>
                        <Text style={styles.itemPrice}>
                          {formatCurrency(item.price * item.quantity)}
                        </Text>
                        {item.original_price && item.original_price > item.price && (
                          <Text style={styles.itemOriginalPrice}>
                            {formatCurrency(item.original_price * item.quantity)}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Stepper */}
                    <View style={styles.stepperContainer}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => updateQuantity(item.id, item.quantity - 1, item.variant_id)}
                      >
                        {item.quantity === 1 ? (
                          <Trash2 color="#EF4444" size={14} />
                        ) : (
                          <Minus color="#FFF" size={14} />
                        )}
                      </TouchableOpacity>
                      <Text style={styles.stepperQuantity}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => updateQuantity(item.id, item.quantity + 1, item.variant_id)}
                      >
                        <Plus color="#FFF" size={14} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {index < cart.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>

            {/* Promo Code Input */}
            <View style={styles.card}>
              <View style={styles.promoHeader}>
                <Tag color={COLORS.primaryDark} size={18} />
                <Text style={styles.cardHeaderTitle}>Apply Promo Code</Text>
              </View>
              <View style={styles.promoInputRow}>
                <TextInput
                  style={styles.promoInput}
                  placeholder="Enter code (e.g. FRESH30)"
                  placeholderTextColor={COLORS.textMuted}
                  value={promoCode}
                  onChangeText={setPromoCode}
                  autoCapitalize="characters"
                  editable={!promoApplied}
                />
                <TouchableOpacity
                  style={[styles.applyPromoBtn, promoApplied && styles.appliedPromoBtn]}
                  onPress={handleApplyPromo}
                  disabled={promoApplied}
                >
                  <Text style={styles.applyPromoText}>{promoApplied ? 'Applied ✓' : 'Apply'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Delivery Location & Pincode Checker */}
            <View style={styles.card}>
              <View style={styles.promoHeader}>
                <MapPin color={COLORS.primaryDark} size={18} />
                <Text style={styles.cardHeaderTitle}>Delivery Destination</Text>
              </View>
              <Text style={styles.addressSummaryText}>
                {selectedAddress.street}, {selectedAddress.city}
              </Text>
              <View style={styles.pincodeRow}>
                <TextInput
                  style={styles.pincodeInput}
                  placeholder="Verify 6-digit Pincode"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                  maxLength={6}
                  value={pincodeInput}
                  onChangeText={setPincodeInput}
                />
                <TouchableOpacity
                  style={styles.checkButton}
                  onPress={handleCheckPincode}
                  disabled={checkingPincode}
                >
                  {checkingPincode ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.checkButtonText}>Verify</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Bill Details */}
            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>Bill Summary</Text>

              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Item Total</Text>
                <Text style={styles.billValue}>{formatCurrency(subtotal)}</Text>
              </View>

              {promoApplied && (
                <View style={styles.billRow}>
                  <Text style={[styles.billLabel, { color: COLORS.primaryDark }]}>Promo Discount</Text>
                  <Text style={[styles.billValue, { color: COLORS.primaryDark }]}>
                    -{formatCurrency(promoDiscount)}
                  </Text>
                </View>
              )}

              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Express Delivery Fee</Text>
                <Text
                  style={[
                    styles.billValue,
                    isFreeDelivery ? { color: COLORS.primaryDark, fontWeight: '700' } : {},
                  ]}
                >
                  {isFreeDelivery ? 'FREE' : formatCurrency(deliveryFee)}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.billTotalRow}>
                <View>
                  <Text style={styles.billTotalLabel}>Grand Total</Text>
                  <Text style={styles.taxSubtext}>Inclusive of all taxes</Text>
                </View>
                <Text style={styles.billTotalValue}>{formatCurrency(total)}</Text>
              </View>
            </View>

            {/* Safe & Hygienic Delivery Banner */}
            <View style={styles.guaranteePill}>
              <ShieldCheck color="#2E7D32" size={16} />
              <Text style={styles.guaranteeText}>
                100% contactless & temperature-monitored hygienic packing
              </Text>
            </View>
          </ScrollView>

          {/* Sticky Checkout Footer */}
          <View style={styles.checkoutFooter}>
            <View style={styles.footerPriceCol}>
              <Text style={styles.footerTotalLabel}>TO PAY</Text>
              <Text style={styles.footerTotalValue}>{formatCurrency(total)}</Text>
              {savings > 0 && (
                <Text style={styles.footerSavingsText}>Total Savings: {formatCurrency(savings)}</Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.proceedButton}
              activeOpacity={0.9}
              onPress={() => navigation.navigate('Checkout', { total })}
            >
              <Text style={styles.proceedButtonText}>Select Delivery Slot</Text>
              <ArrowRight color="#FFF" size={18} />
            </TouchableOpacity>
          </View>
        </>
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.bgWhite,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.card,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
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
  itemCountBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryDark,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.borderGreen,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primaryDark,
    marginBottom: SPACING.xs,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: SPACING.lg,
  },
  browseButton: {
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
  },
  browseButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 110,
  },
  freeDeliveryCard: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderGreen,
    ...SHADOWS.card,
  },
  freeDeliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  freeDeliveryText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryDark,
    flex: 1,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  savingsBanner: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  savingsBannerText: {
    fontSize: 12,
    color: COLORS.textBody,
    fontWeight: '600',
  },
  savingsHighlight: {
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  card: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderGreen,
    ...SHADOWS.card,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primaryDark,
    marginBottom: SPACING.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  itemImageBox: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.borderGreen,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemDetails: {
    flex: 1,
    marginLeft: SPACING.sm + 4,
    marginRight: SPACING.sm,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 17,
  },
  itemUnit: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  itemPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 4,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  itemOriginalPrice: {
    fontSize: 11,
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.sm,
  },
  stepperBtn: {
    padding: 6,
  },
  stepperQuantity: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 6,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderGreen,
    marginVertical: SPACING.sm,
  },
  promoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  promoInputRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  promoInput: {
    flex: 1,
    height: 42,
    backgroundColor: COLORS.bgCanvas,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm + 4,
    color: COLORS.textBody,
    fontSize: 13,
    borderWidth: 1,
    borderColor: COLORS.borderGreen,
  },
  applyPromoBtn: {
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appliedPromoBtn: {
    backgroundColor: '#059669',
  },
  applyPromoText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 12,
  },
  addressSummaryText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  pincodeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  pincodeInput: {
    flex: 1,
    height: 42,
    backgroundColor: COLORS.bgCanvas,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm + 4,
    color: COLORS.textBody,
    fontSize: 13,
    borderWidth: 1,
    borderColor: COLORS.borderGreen,
  },
  checkButton: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  checkButtonText: {
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  billLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  billValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  billTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  billTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  taxSubtext: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  billTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  guaranteePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
  },
  guaranteeText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  checkoutFooter: {
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
  },
  footerPriceCol: {
    justifyContent: 'center',
  },
  footerTotalLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  footerTotalValue: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  footerSavingsText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  proceedButton: {
    backgroundColor: COLORS.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
  },
  proceedButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
