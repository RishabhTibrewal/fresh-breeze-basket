import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../theme/theme';
import {
  CheckCircle2,
  Clock,
  PackageCheck,
  Truck,
  Home,
  ArrowLeft,
  MapPin,
  CreditCard,
  ShoppingBag,
  ChevronRight,
  Package,
} from 'lucide-react-native';
import { apiClient } from '../api/client';
import { useStore } from '../store/useStore';
import { formatCurrency } from '../utils/currency';

interface BackendOrderItem {
  id: string;
  quantity: number;
  unit_price?: number;
  price?: number;
  total_price?: number;
  product?: { name: string; image_url?: string };
  variant?: { name: string };
  name?: string;
}

interface BackendOrder {
  id: string;
  status: string;
  payment_status: string;
  payment_method?: string;
  total_amount: number;
  delivery_slot?: string;
  delivery_date?: string;
  created_at: string;
  shipping_address?: {
    address_line1?: string;
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    pincode?: string;
  };
  order_items?: BackendOrderItem[];
}

export const OrderTrackingScreen = ({ route, navigation }: any) => {
  const { orderId: paramOrderId } = route.params || {};
  const { token, user } = useStore();

  const [currentOrderId, setCurrentOrderId] = useState<string | null>(paramOrderId || null);
  const [order, setOrder] = useState<BackendOrder | null>(null);
  const [ordersList, setOrdersList] = useState<BackendOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchOrderData = useCallback(async (idToFetch?: string | null) => {
    const targetId = idToFetch !== undefined ? idToFetch : currentOrderId;

    try {
      if (targetId) {
        const res = await apiClient.get(`/orders/${targetId}`);
        const data = res.data?.data || res.data;
        if (data && data.id) {
          setOrder(data);
          setCurrentOrderId(data.id);
        }
      } else if (token) {
        const myOrdersRes = await apiClient.get('/orders/my-orders');
        const list = Array.isArray(myOrdersRes.data?.data) ? myOrdersRes.data.data : [];
        setOrdersList(list);
        setOrder(null);
      } else {
        setOrdersList([]);
        setOrder(null);
      }
    } catch (err: any) {
      console.log('Error fetching order from backend:', err?.response?.data || err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentOrderId, token]);

  useEffect(() => {
    setLoading(true);
    setCurrentOrderId(paramOrderId || null);
    fetchOrderData(paramOrderId || null);
  }, [paramOrderId, token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrderData(currentOrderId);
  };

  const handleSelectOrder = async (selected: BackendOrder) => {
    setCurrentOrderId(selected.id);
    setOrder(selected);
    setLoading(true);
    await fetchOrderData(selected.id);
  };

  const handleBack = () => {
    if (order && !paramOrderId) {
      setOrder(null);
      setCurrentOrderId(null);
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('HomeTab');
    }
  };

  // Determine timeline progress based on real order status
  const normalizedStatus = (order?.status || 'confirmed').toLowerCase();
  const isDelivered = normalizedStatus === 'delivered' || normalizedStatus === 'completed';
  const isDispatched = isDelivered || normalizedStatus === 'dispatched' || normalizedStatus === 'in_transit' || normalizedStatus === 'shipped';
  const isPacked = isDispatched || normalizedStatus === 'processing' || normalizedStatus === 'harvested' || normalizedStatus === 'packed';
  const isConfirmed = isPacked || normalizedStatus === 'confirmed' || normalizedStatus === 'paid' || normalizedStatus === 'pending';

  const steps = [
    {
      title: 'Order Placed & Confirmed',
      time: order?.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Confirmed',
      done: isConfirmed,
      active: !isPacked,
      icon: CheckCircle2,
    },
    {
      title: 'Harvest Packed at Farm Facility',
      time: isPacked ? 'Packaged Cold-Chain' : 'Estimated 15 mins',
      done: isPacked,
      active: isPacked && !isDispatched,
      icon: PackageCheck,
    },
    {
      title: 'Dispatched with Chilled Courier',
      time: isDispatched ? 'Out for Delivery' : 'In Transit Soon',
      done: isDispatched,
      active: isDispatched && !isDelivered,
      icon: Truck,
    },
    {
      title: 'Delivered Fresh to your Doorstep',
      time: isDelivered ? 'Delivered' : (order?.delivery_slot || 'Estimated in 25-30 Mins'),
      done: isDelivered,
      active: isDelivered,
      icon: Home,
    },
  ];

  const address = order?.shipping_address;
  const addressText = address
    ? [address.address_line1 || address.street, address.city, address.postal_code || address.pincode].filter(Boolean).join(', ')
    : 'Default Delivery Address';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <ArrowLeft color={COLORS.primaryDark} size={20} />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>
            {order ? 'Live Order Tracking' : 'My Orders & Deliveries'}
          </Text>
          <Text style={styles.orderId} numberOfLines={1}>
            {order
              ? currentOrderId || 'Order Details'
              : `${ordersList.length} ${ordersList.length === 1 ? 'order' : 'orders'}`}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primaryDark]}
            tintColor={COLORS.primaryDark}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primaryDark} />
            <Text style={styles.loadingText}>
              {currentOrderId ? 'Fetching real-time shipment updates...' : 'Loading your orders...'}
            </Text>
          </View>
        ) : !order ? (
          ordersList.length === 0 ? (
            <View style={styles.emptyOrdersBox}>
              <Package color={COLORS.textMuted} size={36} />
              <Text style={styles.emptyOrdersTitle}>
                {token ? 'No orders placed yet' : 'Sign in to view your orders'}
              </Text>
              <Text style={styles.emptyOrdersSubtitle}>
                {token
                  ? 'Order farm-fresh seasonal harvest to track your deliveries here.'
                  : 'Log in from your Account tab to see your order history and live delivery tracking.'}
              </Text>
              <TouchableOpacity
                style={styles.continueShoppingBtn}
                onPress={() => navigation.navigate(token ? 'HomeTab' : 'Login')}
              >
                <Text style={styles.continueShoppingBtnText}>
                  {token ? 'Start Shopping' : 'Sign In'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.ordersListContainer}>
              {ordersList.map((ord) => {
                const status = (ord.status || 'confirmed').toLowerCase();
                const isDone = status === 'delivered' || status === 'completed';
                const dateStr = ord.created_at
                  ? new Date(ord.created_at).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Recent';
                const itemCount = Array.isArray(ord.order_items)
                  ? ord.order_items.reduce((sum, item) => sum + (item.quantity || 1), 0)
                  : 0;

                return (
                  <TouchableOpacity
                    key={ord.id}
                    style={styles.orderListCard}
                    activeOpacity={0.85}
                    onPress={() => handleSelectOrder(ord)}
                  >
                    <View style={styles.orderListTop}>
                      <View style={styles.orderListIdCol}>
                        <Text style={styles.orderListId} numberOfLines={1}>
                          #{ord.id}
                        </Text>
                        <Text style={styles.orderListDate}>
                          {dateStr}
                          {itemCount > 0 ? ` • ${itemCount} ${itemCount === 1 ? 'item' : 'items'}` : ''}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.orderStatusPill,
                          isDone ? styles.orderStatusPillDone : styles.orderStatusPillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.orderStatusPillText,
                            isDone ? styles.orderStatusPillTextDone : styles.orderStatusPillTextActive,
                          ]}
                        >
                          {status.toUpperCase().replace('_', ' ')}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.summaryDivider} />

                    <View style={styles.orderListBottom}>
                      <Text style={styles.orderListTotal}>{formatCurrency(ord.total_amount)}</Text>
                      <View style={styles.viewDetailsRow}>
                        <Text style={styles.viewDetailsText}>View Details</Text>
                        <ChevronRight color={COLORS.primaryDark} size={15} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )
        ) : (
          <>
            {/* Status Card */}
            <View style={styles.card}>
              <View style={styles.etaContainer}>
                <View style={styles.clockIconCircle}>
                  <Clock color={COLORS.primaryDark} size={22} />
                </View>
                <View style={styles.etaTextContainer}>
                  <Text style={styles.etaLabel}>CURRENT ORDER STATUS</Text>
                  <Text style={styles.etaValue}>
                    {normalizedStatus.toUpperCase().replace('_', ' ')}
                  </Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>
                    {isDelivered ? 'DELIVERED' : 'LIVE'}
                  </Text>
                </View>
              </View>
              <View style={styles.courierTag}>
                <Text style={styles.courierTagText}>
                  ⚡ {order?.delivery_slot ? `Slot: ${order.delivery_slot}` : 'Cold-Chain Harvest Delivery'}
                </Text>
              </View>
            </View>

            {/* Timeline */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Shipment Status</Text>

              <View style={styles.timeline}>
                {steps.map((step, index) => {
                  const IconComp = step.icon;
                  return (
                    <View key={index} style={styles.stepRow}>
                      <View style={styles.stepLeft}>
                        <View
                          style={[
                            styles.iconCircle,
                            step.done && styles.iconCircleDone,
                            step.active && styles.iconCircleActive,
                          ]}
                        >
                          <IconComp
                            color={
                              step.done ? '#FFF' : step.active ? COLORS.primaryDark : COLORS.textMuted
                            }
                            size={17}
                          />
                        </View>

                        {index < steps.length - 1 && (
                          <View
                            style={[
                              styles.line,
                              step.done && styles.lineDone,
                            ]}
                          />
                        )}
                      </View>

                      <View style={styles.stepRight}>
                        <Text
                          style={[
                            styles.stepTitle,
                            step.active && styles.stepTitleActive,
                            step.done && styles.stepTitleDone,
                          ]}
                        >
                          {step.title}
                        </Text>
                        <Text style={styles.stepTime}>{step.time}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Order Items & Summary */}
            {order && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Order Summary</Text>

                {order.order_items && order.order_items.length > 0 ? (
                  <View style={styles.itemsList}>
                    {order.order_items.map((it, idx) => {
                      const itemName = it.product?.name || it.name || it.variant?.name || 'Fresh Item';
                      const itemPrice = it.unit_price || it.price || 0;
                      return (
                        <View key={idx} style={styles.itemRow}>
                          <View style={styles.itemBullet} />
                          <Text style={styles.itemName} numberOfLines={1}>
                            {itemName} x {it.quantity}
                          </Text>
                          <Text style={styles.itemPrice}>
                            {formatCurrency(itemPrice * it.quantity)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                <View style={styles.summaryDivider} />

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Paid / Due</Text>
                  <Text style={styles.summaryTotalAmount}>
                    {formatCurrency(order.total_amount)}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <CreditCard color={COLORS.textSecondary} size={14} />
                  <Text style={styles.infoText}>
                    Payment: {(order.payment_method || 'Online').toUpperCase()} ({order.payment_status || 'Paid'})
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <MapPin color={COLORS.textSecondary} size={14} />
                  <Text style={styles.infoText} numberOfLines={2}>
                    {addressText}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.continueShoppingBtn}
              onPress={() => navigation.navigate('HomeTab')}
            >
              <Text style={styles.continueShoppingBtnText}>Continue Shopping</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
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
    padding: 6,
    marginRight: SPACING.sm,
  },
  headerTitleBox: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  orderId: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  loadingBox: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  card: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderGreen,
    ...SHADOWS.card,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primaryDark,
    marginBottom: SPACING.md,
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  clockIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  etaTextContainer: {
    flex: 1,
  },
  etaLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  etaValue: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primaryDark,
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  courierTag: {
    backgroundColor: COLORS.cream,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  courierTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E65100',
  },
  timeline: {
    paddingTop: SPACING.xs,
  },
  stepRow: {
    flexDirection: 'row',
    minHeight: 65,
  },
  stepLeft: {
    alignItems: 'center',
    width: 32,
    marginRight: SPACING.sm + 4,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.bgCanvas,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleDone: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primaryDark,
  },
  iconCircleActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primaryDark,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  lineDone: {
    backgroundColor: COLORS.primaryDark,
  },
  stepRight: {
    flex: 1,
    paddingTop: 4,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  stepTitleActive: {
    color: COLORS.primaryDark,
    fontWeight: '800',
  },
  stepTitleDone: {
    color: COLORS.textPrimary,
  },
  stepTime: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  itemsList: {
    marginBottom: SPACING.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  itemBullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginRight: 8,
  },
  itemName: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  summaryTotalAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  continueShoppingBtn: {
    backgroundColor: COLORS.primaryDark,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  continueShoppingBtnText: {
    color: COLORS.textWhite,
    fontSize: 15,
    fontWeight: '800',
  },
  emptyOrdersBox: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderGreen,
    marginTop: SPACING.md,
    ...SHADOWS.card,
  },
  emptyOrdersTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primaryDark,
    marginTop: SPACING.md,
  },
  emptyOrdersSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: SPACING.md,
    lineHeight: 19,
  },
  ordersListContainer: {
    gap: SPACING.sm,
  },
  orderListCard: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderGreen,
    ...SHADOWS.card,
  },
  orderListTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  orderListIdCol: {
    flex: 1,
  },
  orderListId: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  orderListDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginTop: 3,
  },
  orderStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  orderStatusPillActive: {
    backgroundColor: COLORS.primaryLight,
  },
  orderStatusPillDone: {
    backgroundColor: '#DCFCE7',
  },
  orderStatusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  orderStatusPillTextActive: {
    color: COLORS.primaryDark,
  },
  orderStatusPillTextDone: {
    color: '#15803D',
  },
  orderListBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderListTotal: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewDetailsText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
});
