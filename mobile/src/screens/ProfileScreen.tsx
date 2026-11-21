import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Modal,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../theme/theme';
import { useStore, UserAddress } from '../store/useStore';
import {
  ArrowLeft,
  User,
  MapPin,
  Plus,
  Trash2,
  CheckCircle2,
  Package,
  Heart,
  HelpCircle,
  LogOut,
  X,
  Phone,
  Mail,
  ShieldCheck,
  FileText,
  Building,
  Home as HomeIcon,
  ChevronRight,
  Clock,
} from 'lucide-react-native';
import { apiClient } from '../api/client';
import { formatCurrency } from '../utils/currency';

export const ProfileScreen = ({ navigation }: any) => {
  const {
    user,
    token,
    logout,
    savedAddresses,
    selectedAddress,
    selectAddress,
    addAddress,
    deleteAddress,
    fetchUserAddresses,
    wishlist,
    cart,
  } = useStore();

  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [newStreet, setNewStreet] = useState('');
  const [newCity, setNewCity] = useState('Mumbai');
  const [newState, setNewState] = useState('Maharashtra');
  const [newPincode, setNewPincode] = useState('');
  const [isDefault, setIsDefault] = useState(true);

  const fetchUserOrders = useCallback(async () => {
    if (!token) {
      setOrders([]);
      return;
    }
    setLoadingOrders(true);
    try {
      const res = await apiClient.get('/orders/my-orders');
      const list = res.data?.data || [];
      if (Array.isArray(list)) {
        setOrders(list);
      }
    } catch (e: any) {
      if (e?.response?.status !== 401) {
        console.log('Error fetching user orders in mobile:', e?.message || e);
      }
    } finally {
      setLoadingOrders(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchUserAddresses();
      fetchUserOrders();
    }
  }, [token, fetchUserAddresses, fetchUserOrders]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchUserAddresses(),
      fetchUserOrders(),
    ]);
    setRefreshing(false);
  };

  const handleSaveAddress = () => {
    if (!newStreet.trim() || !newPincode.trim()) {
      Alert.alert('Incomplete Address', 'Please provide a street address and pincode.');
      return;
    }

    addAddress({
      title: newTitle,
      street: newStreet.trim(),
      city: newCity.trim(),
      state: newState.trim(),
      pincode: newPincode.trim(),
      is_default: isDefault,
    });

    setNewStreet('');
    setNewPincode('');
    setIsAddModalOpen(false);
    Alert.alert('Address Saved 🎉', `Your ${newTitle} address has been added.`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgWhite} />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft color={COLORS.primaryDark} size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Account</Text>
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
        {/* User Card - Logged in vs Logged out */}
        {!user ? (
          <View style={styles.loginPromptCard}>
            <View style={styles.loginPromptHeader}>
              <View style={styles.loginPromptIconCircle}>
                <User color={COLORS.primaryDark} size={22} />
              </View>
              <View style={styles.loginPromptTextCol}>
                <Text style={styles.loginPromptTitle}>Sign in to FreshBasket</Text>
                <Text style={styles.loginPromptSubtitle}>
                  Access your orders, saved addresses & exclusive farm harvest discounts.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.signInActionBtn}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.9}
            >
              <Text style={styles.signInActionBtnText}>Sign In or Create Account</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.userCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {user.name
                  ? user.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .substring(0, 2)
                      .toUpperCase()
                  : 'RT'}
              </Text>
            </View>

            <View style={styles.userInfoCol}>
              <View style={styles.userNameRow}>
                <Text style={styles.userName}>{user.name}</Text>
                <View style={styles.memberBadge}>
                  <ShieldCheck color="#2E7D32" size={12} />
                  <Text style={styles.memberBadgeText}>Fresh Club</Text>
                </View>
              </View>

              <View style={styles.userContactRow}>
                <Mail color={COLORS.textSecondary} size={13} />
                <Text style={styles.userContactText}>{user.email}</Text>
              </View>

              {user.phone && (
                <View style={styles.userContactRow}>
                  <Phone color={COLORS.textSecondary} size={13} />
                  <Text style={styles.userContactText}>{user.phone}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Quick Menu Shortcuts */}
        <View style={styles.menuCard}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('OrderTracking')}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: '#E8F5E9' }]}>
              <Package color={COLORS.primaryDark} size={18} />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>My Orders & Deliveries</Text>
              <Text style={styles.menuSubtitle}>Track live orders and view purchase history</Text>
            </View>
            <Text style={styles.menuChevron}>→</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('HomeTab')}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: '#FFF3E0' }]}>
              <Heart color="#FF9800" size={18} />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Saved Wishlist</Text>
              <Text style={styles.menuSubtitle}>
                {wishlist.length} {wishlist.length === 1 ? 'item saved' : 'items saved'}
              </Text>
            </View>
            <Text style={styles.menuChevron}>→</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => Alert.alert('Customer Care', 'GoFreshCo Support: support@gofreshco.com')}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: '#E0F2FE' }]}>
              <HelpCircle color="#0284C7" size={18} />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Help & Support</Text>
              <Text style={styles.menuSubtitle}>FAQs, return policies & instant agent chat</Text>
            </View>
            <Text style={styles.menuChevron}>→</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('PrivacyPolicy')}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: '#F3E8FF' }]}>
              <ShieldCheck color="#7C3AED" size={18} />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Privacy Policy</Text>
              <Text style={styles.menuSubtitle}>How we collect, use & protect your data</Text>
            </View>
            <Text style={styles.menuChevron}>→</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('TermsOfService')}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: '#FEF3C7' }]}>
              <FileText color="#D97706" size={18} />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Terms of Service</Text>
              <Text style={styles.menuSubtitle}>Rules, ordering terms & usage guidelines</Text>
            </View>
            <Text style={styles.menuChevron}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Live Recent Orders from Backend */}
        {user && (
          <View style={styles.ordersSection}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>My Recent Orders</Text>
                {orders.length > 0 && (
                  <View style={styles.orderCountPill}>
                    <Text style={styles.orderCountText}>{orders.length}</Text>
                  </View>
                )}
              </View>
              {loadingOrders && <ActivityIndicator size="small" color={COLORS.primaryDark} />}
            </View>

            {orders.length === 0 && !loadingOrders ? (
              <View style={styles.emptyOrdersCard}>
                <Package color={COLORS.textMuted} size={24} />
                <Text style={styles.emptyOrdersTitle}>No orders placed yet</Text>
                <Text style={styles.emptyOrdersSubtitle}>
                  Order farm-fresh seasonal harvest to track live deliveries here.
                </Text>
              </View>
            ) : (
              <View style={styles.ordersList}>
                {orders.slice(0, 3).map((ord) => {
                  const status = (ord.status || 'confirmed').toLowerCase();
                  const isDone = status === 'delivered';
                  const dateStr = ord.created_at
                    ? new Date(ord.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Recent';

                  return (
                    <TouchableOpacity
                      key={ord.id}
                      style={styles.orderCard}
                      onPress={() => navigation.navigate('OrderTracking', { orderId: ord.id })}
                      activeOpacity={0.8}
                    >
                      <View style={styles.orderCardTop}>
                        <View style={styles.orderIdCol}>
                          <Text style={styles.orderCardId} numberOfLines={1}>
                            {ord.id}
                          </Text>
                          <Text style={styles.orderCardDate}>{dateStr}</Text>
                        </View>
                        <View style={[styles.statusPill, isDone ? styles.statusPillDone : styles.statusPillActive]}>
                          <Text style={[styles.statusPillText, isDone ? styles.statusPillTextDone : styles.statusPillTextActive]}>
                            {status.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.orderCardDivider} />

                      <View style={styles.orderCardBottom}>
                        <Text style={styles.orderTotalAmount}>
                          {formatCurrency(ord.total_amount)}
                        </Text>
                        <View style={styles.trackOrderLink}>
                          <Text style={styles.trackOrderLinkText}>Track Live</Text>
                          <ChevronRight color={COLORS.primaryDark} size={14} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Saved Addresses Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Saved Addresses</Text>
          <TouchableOpacity
            style={styles.addAddressPill}
            onPress={() => setIsAddModalOpen(true)}
          >
            <Plus color={COLORS.primaryDark} size={15} />
            <Text style={styles.addAddressPillText}>Add New</Text>
          </TouchableOpacity>
        </View>

        {/* Addresses List */}
        <View style={styles.addressesList}>
          {savedAddresses.map((addr) => {
            const isSelected = selectedAddress.id === addr.id;
            const IconComponent =
              addr.title.toLowerCase() === 'home'
                ? HomeIcon
                : addr.title.toLowerCase() === 'work'
                ? Building
                : MapPin;

            return (
              <TouchableOpacity
                key={addr.id}
                style={[styles.addressCard, isSelected && styles.addressCardActive]}
                onPress={() => selectAddress(addr.id)}
                activeOpacity={0.9}
              >
                <View style={styles.addressCardTop}>
                  <View style={styles.addressTitleRow}>
                    <View
                      style={[
                        styles.addressIconCircle,
                        isSelected && styles.addressIconCircleActive,
                      ]}
                    >
                      <IconComponent
                        color={isSelected ? COLORS.primaryDark : COLORS.textSecondary}
                        size={16}
                      />
                    </View>
                    <Text style={[styles.addressTitle, isSelected && styles.addressTitleActive]}>
                      {addr.title}
                    </Text>
                    {isSelected && (
                      <View style={styles.activeTag}>
                        <CheckCircle2 color="#2E7D32" size={12} />
                        <Text style={styles.activeTagText}>Active</Text>
                      </View>
                    )}
                  </View>

                  {savedAddresses.length > 1 && (
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => deleteAddress(addr.id)}
                    >
                      <Trash2 color="#9CA3AF" size={16} />
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.addressStreet}>{addr.street}</Text>
                <Text style={styles.addressCity}>
                  {addr.city}, {addr.state} - {addr.pincode}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Logout or Login Button */}
        {user ? (
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => {
              Alert.alert('Sign Out', 'Are you sure you want to log out?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Log Out',
                  style: 'destructive',
                  onPress: () => {
                    logout();
                    Alert.alert('Logged Out', 'You have been signed out.');
                  },
                },
              ]);
            }}
          >
            <LogOut color="#EF4444" size={17} />
            <Text style={styles.logoutText}>Log Out from Account</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.guestLoginBtn}
            onPress={() => navigation.navigate('Login')}
          >
            <User color={COLORS.primaryDark} size={17} />
            <Text style={styles.guestLoginText}>Sign In to Account</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Add Address Modal */}
      <Modal
        visible={isAddModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAddModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Delivery Address</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsAddModalOpen(false)}
              >
                <X color={COLORS.textSecondary} size={20} />
              </TouchableOpacity>
            </View>

            {/* Address Type Selector */}
            <Text style={styles.inputLabel}>Address Tag</Text>
            <View style={styles.tagSelector}>
              {(['Home', 'Work', 'Other'] as const).map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tagOption, newTitle === tag && styles.tagOptionActive]}
                  onPress={() => setNewTitle(tag)}
                >
                  <Text
                    style={[
                      styles.tagOptionText,
                      newTitle === tag && styles.tagOptionTextActive,
                    ]}
                  >
                    {tag === 'Home' ? '🏠 Home' : tag === 'Work' ? '🏢 Work' : '📍 Other'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Street Input */}
            <Text style={styles.inputLabel}>Complete Street Address</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Flat / House no, Building name, Street..."
              placeholderTextColor={COLORS.textMuted}
              value={newStreet}
              onChangeText={setNewStreet}
            />

            {/* City & Pincode */}
            <View style={styles.inputRow}>
              <View style={styles.inputCol}>
                <Text style={styles.inputLabel}>City</Text>
                <TextInput
                  style={styles.textInput}
                  value={newCity}
                  onChangeText={setNewCity}
                />
              </View>
              <View style={styles.inputCol}>
                <Text style={styles.inputLabel}>Pincode</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 400050"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                  maxLength={6}
                  value={newPincode}
                  onChangeText={setNewPincode}
                />
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity style={styles.saveAddressBtn} onPress={handleSaveAddress}>
              <Text style={styles.saveAddressBtnText}>Save & Set as Active</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 50,
  },
  userCard: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderGreen,
    marginBottom: SPACING.md,
    ...SHADOWS.card,
  },
  loginPromptCard: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.borderGreen,
    marginBottom: SPACING.md,
    ...SHADOWS.card,
  },
  loginPromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  loginPromptIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.primaryBorder,
  },
  loginPromptTextCol: {
    flex: 1,
  },
  loginPromptTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  loginPromptSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 16,
    marginTop: 2,
  },
  signInActionBtn: {
    backgroundColor: COLORS.primaryDark,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  signInActionBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  guestLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.bgWhite,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.borderGreen,
    ...SHADOWS.card,
  },
  guestLoginText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    ...SHADOWS.card,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },
  userInfoCol: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  memberBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  userContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  userContactText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  menuCard: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderGreen,
    marginBottom: SPACING.lg,
    ...SHADOWS.card,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
  },
  menuIconCircle: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm + 4,
  },
  menuTextCol: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  menuSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  menuChevron: {
    fontSize: 16,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderSubtle,
    marginHorizontal: SPACING.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingHorizontal: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderCountPill: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  orderCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  ordersSection: {
    marginBottom: SPACING.lg,
  },
  ordersList: {
    gap: SPACING.sm,
  },
  orderCard: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderGreen,
    ...SHADOWS.card,
  },
  orderCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderIdCol: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  orderCardId: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  orderCardDate: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  statusPillActive: {
    backgroundColor: '#E8F5E9',
  },
  statusPillDone: {
    backgroundColor: '#E0F2FE',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusPillTextActive: {
    color: COLORS.primaryDark,
  },
  statusPillTextDone: {
    color: '#0284C7',
  },
  orderCardDivider: {
    height: 1,
    backgroundColor: COLORS.borderSubtle,
    marginVertical: SPACING.sm,
  },
  orderCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTotalAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  trackOrderLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trackOrderLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  emptyOrdersCard: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderGreen,
    borderStyle: 'dashed',
  },
  emptyOrdersTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.sm,
  },
  emptyOrdersSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  addAddressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  addAddressPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  addressesList: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  addressCard: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.borderGreen,
    ...SHADOWS.card,
  },
  addressCardActive: {
    borderColor: COLORS.primaryDark,
    backgroundColor: COLORS.bgCard,
  },
  addressCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  addressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.bgCanvas,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressIconCircleActive: {
    backgroundColor: COLORS.primaryLight,
  },
  addressTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textBody,
  },
  addressTitleActive: {
    color: COLORS.primaryDark,
  },
  activeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
  },
  activeTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  deleteBtn: {
    padding: 4,
  },
  addressStreet: {
    fontSize: 13,
    color: COLORS.textBody,
    lineHeight: 18,
    marginTop: 2,
  },
  addressCity: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.bgWhite,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    ...SHADOWS.card,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#EF4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.bgWhite,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  modalCloseBtn: {
    padding: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textBody,
    marginBottom: 6,
    marginTop: SPACING.sm,
  },
  tagSelector: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: 6,
  },
  tagOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgCanvas,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  tagOptionActive: {
    borderColor: COLORS.primaryDark,
    backgroundColor: COLORS.primaryLight,
  },
  tagOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  tagOptionTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '800',
  },
  textInput: {
    height: 44,
    backgroundColor: COLORS.bgCanvas,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    fontSize: 13,
    color: COLORS.textBody,
    borderWidth: 1.5,
    borderColor: COLORS.borderGreen,
  },
  inputRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  inputCol: {
    flex: 1,
  },
  saveAddressBtn: {
    backgroundColor: COLORS.primaryDark,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.md,
    ...SHADOWS.cardElevated,
  },
  saveAddressBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
});

