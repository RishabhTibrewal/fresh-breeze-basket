import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  SafeAreaView,
  StatusBar,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../theme/theme';
import { useStore, MobileProduct, ProductVariantItem } from '../store/useStore';
import {
  Search,
  MapPin,
  ShoppingBag,
  Plus,
  Minus,
  Truck,
  Heart,
  Star,
  Leaf,
  ChevronDown,
  X,
  Sparkles,
  User,
} from 'lucide-react-native';
import { formatCurrency, fetchCompanyCurrency } from '../utils/currency';
import { apiClient } from '../api/client';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - SPACING.md * 2 - SPACING.sm) / 2;

export const CATEGORIES = [
  { id: 'all', name: 'All', icon: '🧺' },
  { id: 'fruits', name: 'Fruits', icon: '🍎' },
  { id: 'vegetables', name: 'Veggies', icon: '🥦' },
  { id: 'dairy', name: 'Dairy & Eggs', icon: '🥛' },
  { id: 'bakery', name: 'Bakery', icon: '🍞' },
  { id: 'beverages', name: 'Drinks', icon: '🧃' },
];

export const getCategoryEmoji = (name: string): string => {
  const n = (name || '').toLowerCase();
  if (n.includes('all')) return '🧺';
  if (n.includes('fruit')) return '🍎';
  if (n.includes('vegi') || n.includes('vegetable')) return '🥦';
  if (n.includes('rice') || n.includes('basmati')) return '🌾';
  if (n.includes('spice') || n.includes('masala')) return '🌶️';
  if (n.includes('seed')) return '🌻';
  if (n.includes('millet')) return '🌾';
  if (n.includes('dry fruit') || n.includes('nut')) return '🥜';
  if (n.includes('oil') || n.includes('ghee')) return '🧈';
  if (n.includes('milk') || n.includes('dairy') || n.includes('egg')) return '🥛';
  if (n.includes('bakery') || n.includes('bread')) return '🍞';
  if (n.includes('drink') || n.includes('beverage') || n.includes('juice')) return '🧃';
  if (n.includes('pulse') || n.includes('cereal') || n.includes('daal')) return '🥣';
  if (n.includes('sweet') || n.includes('honey')) return '🍯';
  return '🍃';
};

export const FALLBACK_PRODUCTS: MobileProduct[] = [
  {
    id: 'p1',
    name: 'Organic Honeycrisp Apples',
    category: 'fruits',
    price: 4.49,
    original_price: 5.99,
    unit: '1 kg',
    image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&auto=format&fit=crop&q=80',
    badge: '100% ORGANIC',
    rating: 4.9,
    reviews_count: 240,
    origin: 'Himachal Orchards',
    description: 'Crisp, exceptionally sweet with a hint of tartness. Freshly harvested and hand-graded.',
    variants: [
      { id: 'v1', name: 'Standard Pack', unit: '500 g', price: 2.49, original_price: 3.19, in_stock: true },
      { id: 'v2', name: 'Value Bag', unit: '1 kg', price: 4.49, original_price: 5.99, in_stock: true },
      { id: 'v3', name: 'Family Crate', unit: '2 kg', price: 8.29, original_price: 10.99, in_stock: true },
    ],
  },
  {
    id: 'p2',
    name: 'Fresh Hass Avocados',
    category: 'fruits',
    price: 3.99,
    original_price: 4.99,
    unit: '3 pcs',
    image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=600&auto=format&fit=crop&q=80',
    badge: 'READY TO EAT',
    rating: 4.8,
    reviews_count: 185,
    origin: 'Ooty High Valley',
    description: 'Creamy, rich in heart-healthy monounsaturated fats. Perfectly conditioned for guacamole and salads.',
    variants: [
      { id: 'v4', name: 'Pair', unit: '2 pcs', price: 2.79, original_price: 3.49, in_stock: true },
      { id: 'v5', name: 'Triple Pack', unit: '3 pcs', price: 3.99, original_price: 4.99, in_stock: true },
    ],
  },
  {
    id: 'p3',
    name: 'Farm Fresh A2 Whole Milk',
    category: 'dairy',
    price: 2.49,
    original_price: 2.99,
    unit: '1 L Bottle',
    image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&auto=format&fit=crop&q=80',
    badge: 'FARM FRESH',
    rating: 4.9,
    reviews_count: 512,
    origin: 'Gir Purebred Dairy',
    description: 'Pure, unadulterated pasteurized whole milk from grass-fed cows. Chilled instantly to 4°C.',
    variants: [
      { id: 'v6', name: 'Single Bottle', unit: '1 L', price: 2.49, original_price: 2.99, in_stock: true },
      { id: 'v7', name: 'Twin Pack', unit: '2 L', price: 4.69, original_price: 5.79, in_stock: true },
    ],
  },
  {
    id: 'p4',
    name: 'Artisanal Sourdough Boule',
    category: 'bakery',
    price: 3.89,
    original_price: 4.50,
    unit: '500 g Loaf',
    image: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=600&auto=format&fit=crop&q=80',
    badge: 'SLOW FERMENTED',
    rating: 4.7,
    reviews_count: 92,
    origin: 'Artisan Bakery',
    description: '36-hour slow fermented with organic heirloom flour. Crisp blistered crust and soft chewy crumb.',
  },
  {
    id: 'p5',
    name: 'Tender Baby Spinach Leaves',
    category: 'vegetables',
    price: 1.89,
    original_price: 2.49,
    unit: '250 g Box',
    image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&auto=format&fit=crop&q=80',
    badge: 'HYDROPONIC',
    rating: 4.8,
    reviews_count: 140,
    origin: 'Hydroponic Farm',
    description: 'Triple-washed and spun dry. Ready to eat straight from the pack with zero grit.',
  },
  {
    id: 'p6',
    name: 'Cold-Pressed Valencia Orange Juice',
    category: 'beverages',
    price: 3.49,
    original_price: 4.20,
    unit: '500 mL',
    image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=600&auto=format&fit=crop&q=80',
    badge: 'COLD PRESSED',
    rating: 4.9,
    reviews_count: 320,
    origin: 'Nagpur Citrus Groves',
    description: '100% pure cold-pressed citrus juice with natural pulp. High Vitamin C and zero preservatives.',
  },
];

export const HomeScreen = ({ navigation }: any) => {
  const {
    cart,
    addToCart,
    updateQuantity,
    selectedAddress,
    deliveryEstimate,
    getCartTotal,
    getCartSavings,
    getCartItemsCount,
    toggleWishlist,
    isWishlisted,
  } = useStore();

  const [products, setProducts] = useState<MobileProduct[]>(FALLBACK_PRODUCTS);
  const [categories, setCategories] = useState<{ id: string; name: string; icon: string }[]>(CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'sale' | 'organic'>('all');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [, setCurrencyTick] = useState(0);

  const loadBackendCategories = useCallback(async () => {
    try {
      const response = await apiClient.get('/categories');
      const catList = Array.isArray(response.data)
        ? response.data
        : response.data?.data && Array.isArray(response.data.data)
        ? response.data.data
        : [];

      if (catList.length > 0) {
        const mapped = [
          { id: 'all', name: 'All', icon: '🧺' },
          ...catList.map((cat: any) => ({
            id: cat.id,
            name: cat.name,
            icon: getCategoryEmoji(cat.name),
          })),
        ];
        setCategories(mapped);
      }
    } catch (err) {
      console.log('Error fetching categories from backend, keeping defaults:', err);
    }
  }, []);

  const fetchProductsPage = useCallback(
    async (
      pageNum: number,
      search: string,
      cat: string,
      isAppend: boolean
    ) => {
      try {
        if (isAppend) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const params: Record<string, any> = {
          page: pageNum,
          limit: 16,
        };

        if (search.trim()) {
          params.search = search.trim();
        }

        if (cat !== 'all') {
          const matchedCategory = categories.find(
            (c) =>
              c.id.toLowerCase() === cat.toLowerCase() ||
              c.name.toLowerCase() === cat.toLowerCase()
          );
          if (matchedCategory && matchedCategory.id !== 'all') {
            params.category = matchedCategory.id;
          }
        }

        const response = await apiClient.get('/products', { params });
        const productList = Array.isArray(response.data)
          ? response.data
          : response.data?.data && Array.isArray(response.data.data)
          ? response.data.data
          : [];

        const mapped: MobileProduct[] = productList.map((item: any) => {
          const variants: ProductVariantItem[] =
            Array.isArray(item.variants) && item.variants.length > 0
              ? item.variants.map((v: any) => {
                  const vSalePrice = Number(v.price?.sale_price || v.sale_price || item.price || 0);
                  const vMrpPrice = Number(v.price?.mrp_price || v.mrp_price || 0);
                  return {
                    id: v.id,
                    name: v.name || v.sku || 'Default Pack',
                    unit: v.unit
                      ? `${v.unit} ${item.unit_type || ''}`.trim()
                      : item.unit_type || '1 pack',
                    price: vSalePrice > 0 ? vSalePrice : Number(item.price || 3.99),
                    original_price: vMrpPrice > vSalePrice ? vMrpPrice : undefined,
                    in_stock: true,
                  };
                })
              : [];

          const defaultVariant = variants[0];
          const calculatedPrice = defaultVariant
            ? defaultVariant.price
            : Number(item.sale_price || item.price || 3.99);
          const calculatedOriginalPrice = defaultVariant
            ? defaultVariant.original_price
            : item.price && Number(item.price) > calculatedPrice
            ? Number(item.price)
            : undefined;

          const catIdentifier =
            item.category?.slug ||
            item.category?.name?.toLowerCase() ||
            item.category_id ||
            item.cat_slug ||
            'general';

          const primaryImage =
            item.images?.[0]?.image_url ||
            item.image_url ||
            'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500';

          return {
            id: item.id,
            name: item.name,
            category: catIdentifier,
            price: calculatedPrice > 0 ? calculatedPrice : 3.99,
            original_price: calculatedOriginalPrice,
            unit:
              defaultVariant?.unit ||
              (item.unit ? `${item.unit} ${item.unit_type || ''}`.trim() : item.unit_type || '1 pack'),
            image: primaryImage,
            badge:
              item.badge ||
              (calculatedOriginalPrice && calculatedOriginalPrice > calculatedPrice
                ? `SAVE ${Math.round(((calculatedOriginalPrice - calculatedPrice) / calculatedOriginalPrice) * 100)}%`
                : 'FARM FRESH'),
            rating: item.rating || 4.8,
            reviews_count: item.reviews_count || 120,
            origin: item.origin || 'Farm Direct',
            description: item.description || 'Harvested fresh and chilled for maximum nutrition and crispness.',
            variants: variants.length > 0 ? variants : undefined,
          };
        });

        if (isAppend) {
          setProducts((prev) => [...prev, ...mapped]);
        } else {
          setProducts(mapped);
        }

        setPage(pageNum);
        setHasMore(mapped.length >= 16);
      } catch (err) {
        console.log('Error fetching products page:', err);
        if (!isAppend && products.length === 0) {
          setProducts(FALLBACK_PRODUCTS);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [categories, products.length]
  );

  // Initial mount & currency loading
  useEffect(() => {
    fetchCompanyCurrency().then(() => setCurrencyTick((prev) => prev + 1));
    loadBackendCategories();
  }, [loadBackendCategories]);

  // Debounced server-side search and category filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProductsPage(1, searchQuery, selectedCategory, false);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory, fetchProductsPage]);

  const loadMoreProducts = () => {
    if (hasMore && !loadingMore && !loading) {
      fetchProductsPage(page + 1, searchQuery, selectedCategory, true);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadBackendCategories(),
      fetchProductsPage(1, searchQuery, selectedCategory, false),
      fetchCompanyCurrency(),
    ]);
    setRefreshing(false);
  };

  const filteredProducts = products.filter((p) => {
    const pCat = (p.category || '').toLowerCase();
    const sCat = selectedCategory.toLowerCase();
    const matchedCategoryObj = categories.find((c) => c.id.toLowerCase() === sCat);
    const matchesCategory =
      selectedCategory === 'all' ||
      pCat === sCat ||
      pCat.includes(sCat) ||
      sCat.includes(pCat) ||
      Boolean(
        matchedCategoryObj &&
          matchedCategoryObj.name &&
          (pCat === matchedCategoryObj.name.toLowerCase() ||
            matchedCategoryObj.name.toLowerCase().includes(pCat) ||
            pCat.includes(matchedCategoryObj.name.toLowerCase()))
      );

    const matchesSearch =
      searchQuery.trim() === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesFilter =
      filterType === 'all' ||
      (filterType === 'sale' && p.original_price && p.original_price > p.price) ||
      (filterType === 'organic' && p.badge?.includes('ORGANIC'));

    return matchesCategory && matchesSearch && matchesFilter;
  });

  const cartItemCount = getCartItemsCount();
  const cartTotal = getCartTotal();
  const cartSavings = getCartSavings();

  const getProductQuantity = (productId: string) => {
    const item = cart.find((i) => i.id === productId);
    return item ? item.quantity : 0;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgWhite} />

      {/* Top Header Bar matching Web Store */}
      <View style={styles.header}>
        {/* Brand Logo & Top Actions */}
        <View style={styles.brandRow}>
          <View style={styles.brandLogo}>
            <Text style={styles.logoFresh}>Fresh</Text>
            <Text style={styles.logoBasket}>Basket</Text>
          </View>

          {/* Right Header: Delivery ETA Badge + Profile Avatar Button */}
          <View style={styles.headerRightActions}>
            <View style={styles.etaPill}>
              <View style={styles.etaDot} />
              <Text style={styles.etaText}>
                {deliveryEstimate?.eta_text || '25 MINS'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.profileAvatarBtn}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.8}
            >
              <User color={COLORS.primaryDark} size={18} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Location Dropdown - Click to open Saved Addresses in Profile */}
        <TouchableOpacity
          style={styles.locationDropdown}
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.8}
        >
          <MapPin color={COLORS.primary} size={15} />
          <Text style={styles.locationText} numberOfLines={1}>
            {selectedAddress.street}, {selectedAddress.pincode}
          </Text>
          <ChevronDown color={COLORS.textSecondary} size={14} />
        </TouchableOpacity>

        {/* Clean Web-Style Search Bar */}
        <View style={styles.searchBar}>
          <Search color={COLORS.textSecondary} size={17} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search farm fresh produce, milk, bakery..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
              <X color={COLORS.textSecondary} size={15} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        scrollEventThrottle={300}
        onScroll={({ nativeEvent }) => {
          const paddingToBottom = 160;
          const isNearBottom =
            nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >=
            nativeEvent.contentSize.height - paddingToBottom;
          if (isNearBottom && hasMore && !loadingMore && !loading) {
            loadMoreProducts();
          }
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primaryDark]}
            tintColor={COLORS.primaryDark}
          />
        }
      >
        {/* Top Hero Banner matching Web Figma Page 4 */}
        <View style={styles.heroBanner}>
          <View style={styles.heroBadgeRow}>
            <Leaf color={COLORS.primary} size={13} fill={COLORS.primary} />
            <Text style={styles.heroBadgeText}>Direct from Farm</Text>
          </View>

          <Text style={styles.heroTitle}>Goodness in Every Category</Text>
          <Text style={styles.heroSubtitle}>
            Handpicked fresh, natural and organic produce harvested for your health.
          </Text>

          <View style={styles.heroDiscountTag}>
            <Sparkles color="#FF9800" size={13} />
            <Text style={styles.heroDiscountText}>Use Code: FRESH30 for 30% Off</Text>
          </View>
        </View>

        {/* Shop By Category Section */}
        <View style={styles.categorySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Shop by Category</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.categoryItem}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <View
                    style={[
                      styles.categoryCircle,
                      isSelected && styles.categoryCircleActive,
                    ]}
                  >
                    <Text style={styles.categoryEmoji}>{cat.icon}</Text>
                  </View>
                  <Text
                    style={[
                      styles.categoryName,
                      isSelected && styles.categoryNameActive,
                    ]}
                    numberOfLines={1}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Filter Pills */}
        <View style={styles.filterBar}>
          <TouchableOpacity
            style={[styles.filterChip, filterType === 'all' && styles.filterChipActive]}
            onPress={() => setFilterType('all')}
          >
            <Text
              style={[styles.filterChipText, filterType === 'all' && styles.filterChipTextActive]}
            >
              All Items
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterType === 'sale' && styles.filterChipActive]}
            onPress={() => setFilterType('sale')}
          >
            <Text
              style={[styles.filterChipText, filterType === 'sale' && styles.filterChipTextActive]}
            >
              🔥 Deals & Sales
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterType === 'organic' && styles.filterChipActive]}
            onPress={() => setFilterType('organic')}
          >
            <Text
              style={[styles.filterChipText, filterType === 'organic' && styles.filterChipTextActive]}
            >
              🌱 100% Organic
            </Text>
          </TouchableOpacity>
        </View>

        {/* Product Grid (Exact Match with Web ProductCard) */}
        <View style={styles.productGrid}>
          {filteredProducts.map((product) => {
            const qty = getProductQuantity(product.id);
            const wishlisted = isWishlisted(product.id);
            const discount =
              product.original_price && product.original_price > product.price
                ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
                : null;

            return (
              <TouchableOpacity
                key={product.id}
                style={styles.productCard}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('ProductDetails', { product })}
              >
                {/* Image Stage Container */}
                <View style={styles.cardImageContainer}>
                  <Image source={{ uri: product.image }} style={styles.cardImage} resizeMode="contain" />

                  {/* Top Badges */}
                  <View style={styles.badgeOverlay}>
                    {product.badge ? (
                      <View style={styles.cardBadgePill}>
                        <Text style={styles.cardBadgeText}>{product.badge}</Text>
                      </View>
                    ) : discount ? (
                      <View style={[styles.cardBadgePill, { backgroundColor: COLORS.accent }]}>
                        <Text style={styles.cardBadgeText}>{discount}% OFF</Text>
                      </View>
                    ) : null}

                    {/* Heart Button */}
                    <TouchableOpacity
                      style={styles.cardHeartBtn}
                      onPress={() => toggleWishlist(product.id)}
                    >
                      <Heart
                        color={wishlisted ? '#EF4444' : '#9CA3AF'}
                        fill={wishlisted ? '#EF4444' : 'transparent'}
                        size={15}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Content */}
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Text style={styles.cardSubtitle} numberOfLines={1}>
                    {product.description || 'Aromatic • Fresh • Pure & Natural'}
                  </Text>

                  {/* Price & Unit Row */}
                  <View style={styles.cardPriceRow}>
                    <View style={styles.priceCol}>
                      <Text style={styles.cardPrice}>{formatCurrency(product.price)}</Text>
                      {product.original_price && product.original_price > product.price && (
                        <Text style={styles.cardMrp}>{formatCurrency(product.original_price)}</Text>
                      )}
                    </View>
                    <View style={styles.unitBadge}>
                      <Text style={styles.unitBadgeText}>{product.unit}</Text>
                    </View>
                  </View>

                  {/* Add / Stepper Button */}
                  <View style={styles.cardButtonRow}>
                    {qty === 0 ? (
                      <TouchableOpacity
                        style={styles.cardAddButton}
                        onPress={() =>
                          addToCart({
                            id: product.id,
                            name: product.name,
                            price: product.price,
                            original_price: product.original_price,
                            image_url: product.image,
                            unit: product.unit,
                            category: product.category,
                          })
                        }
                      >
                        <Plus color="#FFF" size={14} />
                        <Text style={styles.cardAddButtonText}>ADD</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.stepperContainer}>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() => updateQuantity(product.id, qty - 1)}
                        >
                          <Minus color="#FFF" size={12} />
                        </TouchableOpacity>
                        <Text style={styles.stepperQty}>{qty}</Text>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() => updateQuantity(product.id, qty + 1)}
                        >
                          <Plus color="#FFF" size={12} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Loading More Indicator / End of List Indicator */}
        {loadingMore && (
          <View style={styles.paginationLoader}>
            <ActivityIndicator size="small" color={COLORS.primaryDark} />
            <Text style={styles.paginationLoaderText}>Loading more fresh harvest...</Text>
          </View>
        )}

        {!hasMore && products.length > 0 && !loading && (
          <View style={styles.endOfCatalogBox}>
            <Text style={styles.endOfCatalogText}>✨ You've reached the end of this catalog</Text>
          </View>
        )}
      </ScrollView>

      {/* Floating Bottom Cart Pill */}
      {cartItemCount > 0 && (
        <View style={styles.floatingCartAnchor}>
          <TouchableOpacity
            style={styles.floatingCartPill}
            activeOpacity={0.92}
            onPress={() => navigation.navigate('Cart')}
          >
            <View style={styles.cartPillLeft}>
              <View style={styles.cartIconCircle}>
                <ShoppingBag color="#FFF" size={16} />
                <View style={styles.cartPillBadge}>
                  <Text style={styles.cartPillBadgeText}>{cartItemCount}</Text>
                </View>
              </View>
              <View>
                <Text style={styles.cartPillTotal}>{formatCurrency(cartTotal)}</Text>
                {cartSavings > 0 && (
                  <Text style={styles.cartPillSavings}>You save {formatCurrency(cartSavings)}!</Text>
                )}
              </View>
            </View>

            <View style={styles.cartPillRight}>
              <Text style={styles.cartPillActionText}>View Basket</Text>
              <View style={styles.cartPillArrowCircle}>
                <Text style={styles.cartPillArrow}>→</Text>
              </View>
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
    backgroundColor: COLORS.bgCanvas,
  },
  header: {
    backgroundColor: COLORS.bgWhite,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.card,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  brandLogo: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  logoFresh: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primaryDark,
    letterSpacing: -0.5,
  },
  logoBasket: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
    marginLeft: 2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileAvatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.primaryBorder,
  },
  etaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  etaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  etaText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primaryDark,
    letterSpacing: 0.5,
  },
  locationDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    marginBottom: 8,
    gap: 6,
  },
  locationText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textBody,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1.5,
    borderColor: COLORS.borderGreen,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textBody,
  },
  clearBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  heroBanner: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1.5,
    borderColor: COLORS.borderGreen,
    ...SHADOWS.card,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
    gap: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.borderGreen,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.primaryDark,
    lineHeight: 26,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  heroDiscountTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.cream,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  heroDiscountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#E65100',
  },
  categorySection: {
    marginTop: SPACING.md,
  },
  sectionHeader: {
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  categoryScroll: {
    paddingHorizontal: SPACING.md,
    gap: 12,
  },
  categoryItem: {
    alignItems: 'center',
    width: 64,
  },
  categoryCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.bgWhite,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.borderGreen,
    marginBottom: 6,
    ...SHADOWS.card,
  },
  categoryCircleActive: {
    borderColor: COLORS.primaryDark,
    backgroundColor: COLORS.primaryLight,
  },
  categoryEmoji: {
    fontSize: 26,
  },
  categoryName: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  categoryNameActive: {
    color: COLORS.primaryDark,
    fontWeight: '800',
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgWhite,
    borderWidth: 1.5,
    borderColor: COLORS.borderGreen,
  },
  filterChipActive: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primaryDark,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textBody,
  },
  filterChipTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  productCard: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.bgCard, // Matching web ProductCard (#f5f8f0)
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderGreen,
    padding: 10,
    marginBottom: SPACING.xs,
    justifyContent: 'space-between',
    ...SHADOWS.card,
  },
  cardImageContainer: {
    width: '100%',
    height: CARD_WIDTH * 0.85,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E8F5E9',
    position: 'relative',
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  badgeOverlay: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardBadgePill: {
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  cardBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardHeartBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.card,
  },
  cardContent: {
    paddingTop: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  cardSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    marginBottom: 6,
  },
  cardPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  priceCol: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  cardMrp: {
    fontSize: 11,
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
  },
  unitBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  unitBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  cardButtonRow: {
    marginTop: 2,
  },
  cardAddButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  cardAddButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.md,
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  stepperBtn: {
    padding: 5,
  },
  stepperQty: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
  },
  floatingCartAnchor: {
    position: 'absolute',
    bottom: 12,
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 100,
  },
  floatingCartPill: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...SHADOWS.floating,
  },
  cartPillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  cartIconCircle: {
    position: 'relative',
    padding: 4,
  },
  cartPillBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  cartPillBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
  },
  cartPillTotal: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
  },
  cartPillSavings: {
    color: '#DCFCE7',
    fontSize: 11,
    fontWeight: '700',
  },
  cartPillRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cartPillActionText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  cartPillArrowCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartPillArrow: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  paginationLoader: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  paginationLoaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  endOfCatalogBox: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  endOfCatalogText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
});
