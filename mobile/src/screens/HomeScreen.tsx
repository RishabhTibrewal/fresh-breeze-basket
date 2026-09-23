import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  FlatList,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { COLORS, SPACING, RADIUS } from '../theme/theme';
import { useStore } from '../store/useStore';
import { Search, MapPin, ShoppingBag, Plus, Minus, Truck } from 'lucide-react-native';
import { formatCurrency, fetchCompanyCurrency } from '../utils/currency';

const DEMO_CATEGORIES = [
  { id: '1', name: 'Fresh Fruits', icon: '🍎' },
  { id: '2', name: 'Vegetables', icon: '🥦' },
  { id: '3', name: 'Beverages', icon: '🥤' },
  { id: '4', name: 'Bakery', icon: '🍞' },
  { id: '5', name: 'Dairy & Eggs', icon: '🧀' },
];

const DEMO_PRODUCTS = [
  {
    id: 'p1',
    name: 'Organic Honeycrisp Apples',
    price: 4.99,
    unit: '1 kg',
    image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500&auto=format&fit=crop&q=60',
    category: 'Fresh Fruits',
  },
  {
    id: 'p2',
    name: 'Fresh Hass Avocados',
    price: 3.49,
    unit: '3 pcs',
    image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=500&auto=format&fit=crop&q=60',
    category: 'Fresh Fruits',
  },
  {
    id: 'p3',
    name: 'Farm Fresh Whole Milk',
    price: 2.79,
    unit: '1 L',
    image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=500&auto=format&fit=crop&q=60',
    category: 'Dairy & Eggs',
  },
  {
    id: 'p4',
    name: 'Artisanal Sourdough Bread',
    price: 3.99,
    unit: '500g',
    image: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=500&auto=format&fit=crop&q=60',
    category: 'Bakery',
  },
];

export const HomeScreen = ({ navigation }: any) => {
  const { cart, addToCart, updateQuantity, selectedAddress, deliveryEstimate, getCartTotal } = useStore();
  const [selectedCategory, setSelectedCategory] = useState('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [, setCurrencyTick] = useState(0);

  React.useEffect(() => {
    fetchCompanyCurrency().then(() => setCurrencyTick((prev) => prev + 1));
  }, []);

  const cartItemCount = cart.reduce((sum: number, item: any) => sum + item.quantity, 0);

  const getProductQuantity = (productId: string) => {
    const item = cart.find((i: any) => i.id === productId);
    return item ? item.quantity : 0;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bgDark} />
      
      {/* Header & Location */}
      <View style={styles.header}>
        <View style={styles.locationContainer}>
          <MapPin color={COLORS.primary} size={20} />
          <View style={styles.locationTextContainer}>
            <Text style={styles.deliveringLabel}>Delivering Nationwide</Text>
            <Text style={styles.addressText} numberOfLines={1}>
              {selectedAddress?.street ? `${selectedAddress.street}, ${selectedAddress.pincode}` : 'Select Delivery Location'}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.shippingBadge}>
          <Truck color={COLORS.accent} size={16} />
          <Text style={styles.shippingText}>
            {deliveryEstimate?.estimated_days ? `${deliveryEstimate.estimated_days} Days Express` : 'Nationwide'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search color={COLORS.textDarkSecondary} size={18} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search fresh products..."
          placeholderTextColor={COLORS.textDarkSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Hero Banner */}
        <View style={styles.banner}>
          <View style={styles.bannerTextContainer}>
            <Text style={styles.bannerTag}>FLASH SALE • UP TO 30% OFF</Text>
            <Text style={styles.bannerTitle}>Fresh Harvest Delivered Nationwide</Text>
            <TouchableOpacity
              style={styles.bannerButton}
              onPress={() => navigation.navigate('Categories')}
            >
              <Text style={styles.bannerButtonText}>Shop Now</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Categories Bar */}
        <Text style={styles.sectionTitle}>Categories</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
          {DEMO_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryCard,
                selectedCategory === cat.id && styles.categoryCardSelected,
              ]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text style={styles.categoryIcon}>{cat.icon}</Text>
              <Text
                style={[
                  styles.categoryName,
                  selectedCategory === cat.id && styles.categoryNameSelected,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Featured Products */}
        <Text style={styles.sectionTitle}>Popular Products</Text>
        <View style={styles.productGrid}>
          {DEMO_PRODUCTS.map((product) => {
            const qty = getProductQuantity(product.id);
            return (
              <View key={product.id} style={styles.productCard}>
                <Image source={{ uri: product.image }} style={styles.productImage} />
                <Text style={styles.productName} numberOfLines={2}>
                  {product.name}
                </Text>
                <Text style={styles.productUnit}>{product.unit}</Text>
                <View style={styles.productFooter}>
                  <Text style={styles.productPrice}>{formatCurrency(product.price)}</Text>
                  
                  {qty === 0 ? (
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => addToCart(product)}
                    >
                      <Plus color="#FFF" size={16} />
                      <Text style={styles.addButtonText}>ADD</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.quantityStepper}>
                      <TouchableOpacity
                        onPress={() => updateQuantity(product.id, qty - 1)}
                        style={styles.stepperButton}
                      >
                        <Minus color="#FFF" size={14} />
                      </TouchableOpacity>
                      <Text style={styles.stepperText}>{qty}</Text>
                      <TouchableOpacity
                        onPress={() => updateQuantity(product.id, qty + 1)}
                        style={styles.stepperButton}
                      >
                        <Plus color="#FFF" size={14} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Floating Cart Drawer Bar */}
      {cartItemCount > 0 && (
        <View style={styles.floatingCartContainer}>
          <TouchableOpacity
            style={styles.floatingCart}
            onPress={() => navigation.navigate('Cart')}
          >
            <View style={styles.cartInfo}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{cartItemCount}</Text>
              </View>
              <Text style={styles.cartTotalText}>{formatCurrency(getCartTotal())}</Text>
            </View>
            <View style={styles.viewCartButton}>
              <Text style={styles.viewCartText}>View Cart</Text>
              <ShoppingBag color="#FFF" size={18} />
            </View>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationTextContainer: {
    marginLeft: SPACING.sm,
    flex: 1,
  },
  deliveringLabel: {
    color: COLORS.textDarkSecondary,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  addressText: {
    color: COLORS.textDarkPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  shippingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  shippingText: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCardDark,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  searchIcon: {
    marginRight: SPACING.xs,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textDarkPrimary,
    fontSize: 14,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  banner: {
    backgroundColor: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginVertical: SPACING.sm,
    overflow: 'hidden',
  },
  bannerTextContainer: {
    width: '80%',
  },
  bannerTag: {
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: SPACING.md,
  },
  bannerButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  bannerButtonText: {
    color: COLORS.primaryDark,
    fontWeight: '700',
    fontSize: 12,
  },
  sectionTitle: {
    color: COLORS.textDarkPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  categoriesScroll: {
    paddingLeft: SPACING.md,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCardDark,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  categoryCardSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryName: {
    color: COLORS.textDarkSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  categoryNameSelected: {
    color: '#FFFFFF',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md - 4,
  },
  productCard: {
    width: '50%',
    padding: 4,
  },
  productImage: {
    width: '100%',
    height: 120,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgCardDark,
  },
  productName: {
    color: COLORS.textDarkPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: SPACING.xs,
  },
  productUnit: {
    color: COLORS.textDarkSecondary,
    fontSize: 11,
    marginBottom: 4,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  productPrice: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 2,
  },
  quantityStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 2,
  },
  stepperButton: {
    padding: 4,
  },
  stepperText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 6,
  },
  floatingCartContainer: {
    position: 'absolute',
    bottom: SPACING.md,
    left: SPACING.md,
    right: SPACING.md,
  },
  floatingCart: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md - 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cartInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.full,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  badgeText: {
    color: COLORS.primaryDark,
    fontWeight: '800',
    fontSize: 12,
  },
  cartTotalText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  viewCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewCartText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 6,
  },
});
