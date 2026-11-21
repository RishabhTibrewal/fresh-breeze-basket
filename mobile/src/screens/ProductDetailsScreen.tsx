import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../theme/theme';
import { useStore, MobileProduct } from '../store/useStore';
import {
  ArrowLeft,
  Heart,
  Star,
  Truck,
  Leaf,
  Plus,
  Minus,
  ShoppingBag,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import { formatCurrency } from '../utils/currency';
import { apiClient } from '../api/client';

export const ProductDetailsScreen = ({ route, navigation }: any) => {
  const { width } = useWindowDimensions();
  const imageStageHeight = Math.min(width * 0.9, 420);
  const { product }: { product: MobileProduct } = route.params || {};
  const { cart, addToCart, updateQuantity, toggleWishlist, isWishlisted } = useStore();

  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    product?.variants && product.variants.length > 0 ? product.variants[0].id : 'default'
  );
  const [galleryImages, setGalleryImages] = useState<string[]>(() => {
    const initial = [
      ...(Array.isArray(product?.images) ? product.images : []),
      ...(product?.image ? [product.image] : []),
    ].filter(Boolean);
    return Array.from(new Set(initial));
  });
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const galleryScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!product?.id) return;
    let isMounted = true;

    const loadProductImages = async () => {
      try {
        const res = await apiClient.get(`/products/${product.id}`);
        const detail = res.data?.data || res.data;
        if (!detail || !isMounted) return;

        const detailImages: string[] = Array.isArray(detail.images)
          ? detail.images
              .map((img: any) => (typeof img === 'string' ? img : img?.image_url))
              .filter(Boolean)
          : [];
        const additionalImages: string[] = Array.isArray(detail.additionalImages)
          ? detail.additionalImages.filter(Boolean)
          : [];
        const variantImages: string[] = Array.isArray(detail.variants)
          ? detail.variants.flatMap((v: any) => [
              ...(v.image_url ? [v.image_url] : []),
              ...(Array.isArray(v.variant_images)
                ? v.variant_images.map((vi: any) => (typeof vi === 'string' ? vi : vi?.image_url)).filter(Boolean)
                : []),
            ])
          : [];

        const merged = Array.from(
          new Set(
            [
              detail.image_url,
              ...detailImages,
              ...additionalImages,
              ...variantImages,
              product.image,
            ].filter(Boolean)
          )
        );

        if (merged.length > 0 && isMounted) {
          setGalleryImages(merged);
        }
      } catch {
        // Keep initial product image(s) if detail fetch fails
      }
    };

    loadProductImages();
    return () => {
      isMounted = false;
    };
  }, [product?.id, product?.image]);

  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Product details not found.</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Return to Catalog</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const selectedVariant = product.variants?.find((v) => v.id === selectedVariantId);
  const currentPrice = selectedVariant ? selectedVariant.price : product.price;
  const currentOriginalPrice = selectedVariant?.original_price || product.original_price;
  const currentUnit = selectedVariant ? selectedVariant.unit : product.unit;

  const cartItem = cart.find(
    (item) => item.id === product.id && (item.variant_id || 'default') === selectedVariantId
  );
  const quantity = cartItem ? cartItem.quantity : 0;
  const wishlisted = isWishlisted(product.id);

  const discountPercent =
    currentOriginalPrice && currentOriginalPrice > currentPrice
      ? Math.round(((currentOriginalPrice - currentPrice) / currentOriginalPrice) * 100)
      : null;

  const handleAddToCart = () => {
    addToCart({
      id: product.id,
      name: product.name,
      price: currentPrice,
      original_price: currentOriginalPrice,
      image_url: product.image,
      unit: currentUnit,
      category: product.category,
      variant_id: selectedVariantId,
      description: product.description,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgWhite} />

      {/* Top Floating App Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navIconBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft color={COLORS.primaryDark} size={22} />
        </TouchableOpacity>

        <View style={styles.navActions}>
          <TouchableOpacity
            style={styles.navIconBtn}
            onPress={() => toggleWishlist(product.id)}
          >
            <Heart
              color={wishlisted ? '#EF4444' : COLORS.textSecondary}
              fill={wishlisted ? '#EF4444' : 'transparent'}
              size={20}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navIconBtn} onPress={() => navigation.navigate('Cart')}>
            <ShoppingBag color={COLORS.primaryDark} size={20} />
            {cart.length > 0 && <View style={styles.cartBadgeDot} />}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Product Image Stage */}
        <View style={[styles.imageStage, { width, height: imageStageHeight }]}>
          <ScrollView
            ref={galleryScrollRef}
            horizontal
            pagingEnabled
            nestedScrollEnabled
            snapToInterval={width}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            style={{ width, height: imageStageHeight }}
            onScroll={(e) => {
              const offsetX = e.nativeEvent.contentOffset.x;
              if (width > 0) {
                const idx = Math.round(offsetX / width);
                if (idx >= 0 && idx < galleryImages.length && idx !== activeImageIndex) {
                  setActiveImageIndex(idx);
                }
              }
            }}
            onMomentumScrollEnd={(e) => {
              const offsetX = e.nativeEvent.contentOffset.x;
              if (width > 0) {
                const idx = Math.round(offsetX / width);
                if (idx >= 0 && idx < galleryImages.length) {
                  setActiveImageIndex(idx);
                }
              }
            }}
          >
            {galleryImages.map((imgUri, idx) => (
              <View key={`${imgUri}-${idx}`} style={[styles.imageSlide, { width, height: imageStageHeight }]}>
                <Image source={{ uri: imgUri }} style={styles.heroImage} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>

          {galleryImages.length > 1 && activeImageIndex > 0 && (
            <TouchableOpacity
              style={[styles.slideArrowBtn, styles.slideArrowLeft]}
              activeOpacity={0.8}
              onPress={() => {
                const nextIdx = activeImageIndex - 1;
                setActiveImageIndex(nextIdx);
                galleryScrollRef.current?.scrollTo({ x: nextIdx * width, animated: true });
              }}
            >
              <ChevronLeft color={COLORS.primaryDark} size={20} />
            </TouchableOpacity>
          )}

          {galleryImages.length > 1 && activeImageIndex < galleryImages.length - 1 && (
            <TouchableOpacity
              style={[styles.slideArrowBtn, styles.slideArrowRight]}
              activeOpacity={0.8}
              onPress={() => {
                const nextIdx = activeImageIndex + 1;
                setActiveImageIndex(nextIdx);
                galleryScrollRef.current?.scrollTo({ x: nextIdx * width, animated: true });
              }}
            >
              <ChevronRight color={COLORS.primaryDark} size={20} />
            </TouchableOpacity>
          )}

          {galleryImages.length > 1 && (
            <View style={styles.paginationDotsContainer}>
              {galleryImages.map((_, idx) => {
                const isActive = idx === activeImageIndex;
                return (
                  <TouchableOpacity
                    key={`dot-${idx}`}
                    activeOpacity={0.8}
                    onPress={() => {
                      setActiveImageIndex(idx);
                      galleryScrollRef.current?.scrollTo({ x: idx * width, animated: true });
                    }}
                    style={[styles.paginationDot, isActive && styles.paginationDotActive]}
                  />
                );
              })}
            </View>
          )}

          {discountPercent && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>{discountPercent}% OFF</Text>
            </View>
          )}
          {product.badge && (
            <View style={styles.freshBadge}>
              <Leaf color="#FFF" size={12} fill="#FFF" />
              <Text style={styles.freshBadgeText}>{product.badge}</Text>
            </View>
          )}
        </View>

        {/* Product Info Section */}
        <View style={styles.detailsBody}>
          <View style={styles.categoryRow}>
            <Text style={styles.categoryLabel}>{product.category.toUpperCase()}</Text>
            <View style={styles.ratingBadge}>
              <Star color="#F59E0B" fill="#F59E0B" size={13} />
              <Text style={styles.ratingText}>{product.rating || '4.9'}</Text>
              <Text style={styles.reviewsCount}>({product.reviews_count || '140+'})</Text>
            </View>
          </View>

          <Text style={styles.productTitle}>{product.name}</Text>
          <Text style={styles.originText}>
            {product.origin ? `📍 Direct from ${product.origin}` : '🌱 Organically Grown & Farm Fresh'}
          </Text>

          {/* Pricing Row */}
          <View style={styles.pricingRow}>
            <Text style={styles.currentPrice}>{formatCurrency(currentPrice)}</Text>
            {currentOriginalPrice && currentOriginalPrice > currentPrice && (
              <Text style={styles.originalPrice}>{formatCurrency(currentOriginalPrice)}</Text>
            )}
            <Text style={styles.taxPill}>Inclusive of all taxes</Text>
          </View>

          {/* Variant Selector */}
          {product.variants && product.variants.length > 0 && (
            <View style={styles.variantSection}>
              <Text style={styles.sectionSubtitle}>Select Pack Size / Weight</Text>
              <View style={styles.variantChips}>
                {product.variants.map((v) => {
                  const isSelected = selectedVariantId === v.id;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.variantChip, isSelected && styles.variantChipSelected]}
                      onPress={() => setSelectedVariantId(v.id)}
                    >
                      <Text
                        style={[styles.variantUnitText, isSelected && styles.variantUnitTextSelected]}
                      >
                        {v.unit}
                      </Text>
                      <Text
                        style={[styles.variantPriceText, isSelected && styles.variantPriceTextSelected]}
                      >
                        {formatCurrency(v.price)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Quality & Freshness Guarantee Badges */}
          <View style={styles.trustCard}>
            <View style={styles.trustItem}>
              <View style={[styles.trustIconCircle, { backgroundColor: '#E8F5E9' }]}>
                <Leaf color="#2E7D32" size={18} />
              </View>
              <View style={styles.trustContent}>
                <Text style={styles.trustTitle}>100% Pesticide Free</Text>
                <Text style={styles.trustDesc}>Harvested fresh from certified regenerative farms</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.trustItem}>
              <View style={[styles.trustIconCircle, { backgroundColor: '#E0F2FE' }]}>
                <Truck color="#0284C7" size={18} />
              </View>
              <View style={styles.trustContent}>
                <Text style={styles.trustTitle}>Cold-Chain Express Delivery</Text>
                <Text style={styles.trustDesc}>Packed with chilled insulation to maintain peak crunch</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.trustItem}>
              <View style={[styles.trustIconCircle, { backgroundColor: '#FEF3C7' }]}>
                <RotateCcw color="#D97706" size={18} />
              </View>
              <View style={styles.trustContent}>
                <Text style={styles.trustTitle}>Freshness Guarantee</Text>
                <Text style={styles.trustDesc}>Instant replacement if you're not 100% satisfied</Text>
              </View>
            </View>
          </View>

          {/* Description & Storage */}
          <View style={styles.infoCard}>
            <Text style={styles.infoHeading}>Product Description</Text>
            <Text style={styles.infoBody}>
              {product.description ||
                'Naturally ripened under optimal sunlight, picked at peak maturity to lock in natural sugars, dietary fibers, and essential micronutrients. Hand-sorted to ensure zero blemishes.'}
            </Text>

            {product.storage_tips && (
              <>
                <Text style={[styles.infoHeading, { marginTop: SPACING.md }]}>Storage Tips</Text>
                <Text style={styles.infoBody}>{product.storage_tips}</Text>
              </>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomPriceCol}>
          <Text style={styles.bottomTotalLabel}>Total Price ({currentUnit})</Text>
          <Text style={styles.bottomTotalValue}>
            {formatCurrency(currentPrice * (quantity > 0 ? quantity : 1))}
          </Text>
        </View>

        {quantity === 0 ? (
          <TouchableOpacity style={styles.primaryAddBtn} onPress={handleAddToCart}>
            <Plus color="#FFF" size={18} />
            <Text style={styles.primaryAddBtnText}>Add to Basket</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.stepperContainer}>
            <TouchableOpacity
              style={styles.stepperActionBtn}
              onPress={() => updateQuantity(product.id, quantity - 1, selectedVariantId)}
            >
              <Minus color="#FFF" size={18} />
            </TouchableOpacity>
            <Text style={styles.stepperValue}>{quantity}</Text>
            <TouchableOpacity
              style={styles.stepperActionBtn}
              onPress={() => updateQuantity(product.id, quantity + 1, selectedVariantId)}
            >
              <Plus color="#FFF" size={18} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgCanvas,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginBottom: SPACING.md,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  backButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  navIconBtn: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.card,
  },
  navActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  cartBadgeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  imageStage: {
    backgroundColor: COLORS.bgWhite,
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGreen,
  },
  imageSlide: {
    padding: SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  slideArrowBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    ...SHADOWS.card,
  },
  slideArrowLeft: {
    left: SPACING.sm,
  },
  slideArrowRight: {
    right: SPACING.sm,
  },
  paginationDotsContainer: {
    position: 'absolute',
    bottom: SPACING.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    zIndex: 2,
  },
  paginationDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  paginationDotActive: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#FFFFFF',
  },
  discountBadge: {
    position: 'absolute',
    bottom: SPACING.md,
    left: SPACING.md,
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  discountBadgeText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 12,
  },
  freshBadge: {
    position: 'absolute',
    bottom: SPACING.md,
    right: SPACING.md,
    backgroundColor: COLORS.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  freshBadgeText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 11,
  },
  detailsBody: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  categoryLabel: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgWhite,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ratingText: {
    color: COLORS.textBody,
    fontSize: 12,
    fontWeight: '700',
  },
  reviewsCount: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  productTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    lineHeight: 28,
  },
  originText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: SPACING.md,
  },
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  currentPrice: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  originalPrice: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
  },
  taxPill: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginLeft: 'auto',
  },
  variantSection: {
    marginBottom: SPACING.lg,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  variantChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  variantChip: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.borderGreen,
    alignItems: 'center',
    minWidth: 90,
  },
  variantChipSelected: {
    borderColor: COLORS.primaryDark,
    backgroundColor: COLORS.primaryLight,
  },
  variantUnitText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textBody,
  },
  variantUnitTextSelected: {
    color: COLORS.primaryDark,
  },
  variantPriceText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  variantPriceTextSelected: {
    color: COLORS.primaryDark,
    fontWeight: '700',
  },
  trustCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderGreen,
    marginBottom: SPACING.lg,
    ...SHADOWS.card,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  trustIconCircle: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trustContent: {
    flex: 1,
  },
  trustTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  trustDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderGreen,
    marginVertical: SPACING.sm,
  },
  infoCard: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderGreen,
    ...SHADOWS.card,
  },
  infoHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  infoBody: {
    fontSize: 13,
    color: COLORS.textBody,
    lineHeight: 19,
  },
  bottomBar: {
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
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOWS.cardElevated,
  },
  bottomPriceCol: {
    justifyContent: 'center',
  },
  bottomTotalLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  bottomTotalValue: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  primaryAddBtn: {
    backgroundColor: COLORS.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 4,
    borderRadius: RADIUS.md,
  },
  primaryAddBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.md,
    paddingHorizontal: 4,
  },
  stepperActionBtn: {
    padding: SPACING.sm + 2,
  },
  stepperValue: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    paddingHorizontal: SPACING.md,
  },
});
