import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingCart,
  Minus,
  Plus,
  ChevronRight,
  ChevronLeft,
  Leaf,
  FlaskConical,
  ShieldCheck,
  HeartHandshake,
  Truck,
  RotateCcw,
  MapPin,
  CheckCircle2,
  FileText,
  Apple,
  Info,
} from 'lucide-react';
import { Product, productsService } from '@/api/products';
import { categoriesService } from '@/api/categories';
import ProductCard from '@/components/products/ProductCard';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useCart } from '@/contexts/CartContext';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorMessage } from '@/components/ui/error-message';
import { toast } from 'sonner';
import { VariantSelector } from '@/components/products/VariantSelector';
import { StockDisplay } from '@/components/inventory/StockDisplay';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCompanyCurrency } from '@/hooks/useCompanyCurrency';
import { cn, formatCurrency } from '@/lib/utils';

// Store-level highlights shown under the short description
const HIGHLIGHTS = [
  { icon: Leaf, title: '100% Natural', subtitle: 'No artificial additives' },
  { icon: FlaskConical, title: 'Chemical Free', subtitle: 'Safe for your family' },
  { icon: ShieldCheck, title: 'Farm Fresh', subtitle: 'Direct from farmers' },
  { icon: HeartHandshake, title: 'Healthy Choice', subtitle: 'For a better you' },
];

const WHY_LOVE_IT = [
  'Naturally sourced & carefully selected',
  'No artificial colours or preservatives',
  'Hygienically cleaned and packed',
  'Delivered fresh to your doorstep',
];

type TabKey = 'description' | 'nutrition' | 'key-info';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'description', label: 'Description', icon: FileText },
  { key: 'nutrition', label: 'Nutrition Facts', icon: Apple },
  { key: 'key-info', label: 'Key Information', icon: Info },
];

/**
 * Parses free-text nutritional info into label/value rows.
 * Supports "Protein: 7g, Fat: 1g" or one "Label: Value" per line.
 * Returns an empty array when the text isn't in that shape.
 */
const parseNutrition = (info: string | null): { label: string; value: string }[] => {
  if (!info) return [];
  const parts = info
    .split(/\n|;|,(?![^()]*\))/)
    .map((s) => s.trim())
    .filter(Boolean);
  const rows = parts.map((p) => {
    const idx = p.indexOf(':');
    if (idx <= 0) return null;
    const label = p.slice(0, idx).trim();
    const value = p.slice(idx + 1).trim();
    return label && value ? { label, value } : null;
  });
  return rows.length > 0 && rows.every(Boolean)
    ? (rows as { label: string; value: string }[])
    : [];
};

const ProductDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { formatCurrency } = useCompanyCurrency();
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('description');
  const relatedScrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { state: cartState, addToCart, updateQuantity, removeFromCart } = useCart();

  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsService.getById(id || ''),
    enabled: !!id,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesService.getAll,
  });

  // Reset view state when navigating between products
  useEffect(() => {
    setSelectedVariantId(null);
    setActiveImageIndex(0);
    setActiveTab('description');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);

  // Get active variants
  const activeVariants = product?.variants?.filter((v) => v.is_active) || [];

  // Select default variant or first active variant
  useEffect(() => {
    if (!selectedVariantId && activeVariants.length > 0) {
      const defaultVariant = activeVariants.find((v) => v.is_default) || activeVariants[0];
      setSelectedVariantId(defaultVariant.id);
    }
  }, [activeVariants, selectedVariantId]);

  const selectedVariant = activeVariants.find((v) => v.id === selectedVariantId);

  // Reset gallery when variant changes
  useEffect(() => {
    setActiveImageIndex(0);
  }, [selectedVariantId]);

  // Find cart item by product ID and variant ID
  const cartItem =
    product && selectedVariantId
      ? cartState.items.find(
          (item) => item.id === product.id && item.variant_id === selectedVariantId
        )
      : undefined;
  const quantityInCart = cartItem ? cartItem.quantity : 0;

  useEffect(() => {
    if (product && selectedVariant) {
      setQuantity(quantityInCart > 0 ? quantityInCart : 1);
    }
  }, [product, selectedVariant, quantityInCart]);

  // Get related products
  const { data: allProductsForRelated, isLoading: isLoadingRelated } = useQuery<Product[]>({
    queryKey: ['products', 'allUnfilteredForRelated'],
    queryFn: () => productsService.getAll(),
  });

  // Same-category products first, then fill with others
  const relatedProducts = useMemo(() => {
    if (!allProductsForRelated || !product) return [];
    const others = allProductsForRelated.filter((p) => p.id !== product.id && p.is_active !== false);
    const sameCategory = others.filter((p) => p.category_id === product.category_id);
    const rest = others.filter((p) => p.category_id !== product.category_id);
    return [...sameCategory, ...rest].slice(0, 10);
  }, [allProductsForRelated, product]);

  const category = categories?.find((c) => c.id === product?.category_id);

  const decreaseQuantity = () => {
    if (quantityInCart > 0) {
      handleUpdateCartQuantity(quantityInCart - 1);
    } else {
      setQuantity((prev) => Math.max(1, prev - 1));
    }
  };

  const increaseQuantity = () => {
    if (quantityInCart > 0) {
      handleUpdateCartQuantity(quantityInCart + 1);
    } else {
      // Stock limit will be checked when adding to cart
      setQuantity((prev) => prev + 1);
    }
  };

  const handleAddNewToCart = () => {
    if (!product || !selectedVariant) {
      toast.error('Please select a variant');
      return;
    }

    if (quantity <= 0) {
      toast.error('Please select a valid quantity');
      return;
    }

    addToCart(product, selectedVariant, quantity);
    toast.success(`Added ${quantity} × ${product.name} (${selectedVariant.name}) to cart`);
  };

  const handleUpdateCartQuantity = (newQuantity: number) => {
    if (product && selectedVariant && cartItem) {
      if (newQuantity > 0) {
        updateQuantity(product.id, selectedVariant.id, newQuantity);
        toast.success(`Updated quantity to ${newQuantity}`);
      } else {
        removeFromCart(product.id, selectedVariant.id);
        toast.success('Removed from cart');
      }
    }
  };

  const scrollRelated = (direction: 'left' | 'right') => {
    const el = relatedScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: (direction === 'left' ? -1 : 1) * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F9FBF8]">
        <Navbar />
        <main className="flex-grow container mx-auto px-4 py-8">
          <Skeleton className="h-4 w-64 mb-6 bg-[#eef3e8]" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 flex gap-4">
              <div className="hidden lg:flex flex-col gap-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="w-20 h-20 rounded-xl bg-[#eef3e8]" />
                ))}
              </div>
              <Skeleton className="flex-1 aspect-square rounded-3xl bg-[#eef3e8]" />
            </div>
            <div className="lg:col-span-5 space-y-4">
              <Skeleton className="h-6 w-24 rounded-full bg-[#eef3e8]" />
              <Skeleton className="h-10 w-3/4 bg-[#eef3e8]" />
              <Skeleton className="h-8 w-1/2 bg-[#eef3e8]" />
              <Skeleton className="h-24 bg-[#eef3e8]" />
              <Skeleton className="h-20 bg-[#eef3e8]" />
              <Skeleton className="h-12 rounded-2xl bg-[#eef3e8]" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F9FBF8]">
        <Navbar />
        <main className="flex-grow container mx-auto px-4 py-12">
          <ErrorMessage
            title="Product Not Found"
            message="Sorry, the product you are looking for does not exist."
          />
          <Link
            to="/products"
            className="mt-6 inline-flex items-center gap-2 bg-[#1E502B] hover:bg-[#276B3C] text-white font-semibold px-6 py-3 rounded-full transition-colors"
          >
            Continue Shopping
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  // Get images from variant or product
  // Priority: variant.image_url (main) > variant_images array (additional) > product images
  const mainVariantImage = selectedVariant?.image_url ? [selectedVariant.image_url] : [];
  const variantAdditionalImages = selectedVariant?.variant_images
    ? [...selectedVariant.variant_images]
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
        .map((img) => img.image_url)
    : [];
  const variantImages = [...mainVariantImage, ...variantAdditionalImages];
  const productImages = product.image_url
    ? [product.image_url, ...(product.additional_images || [])]
    : product.additional_images || [];
  const displayImages = variantImages.length > 0 ? variantImages : productImages;

  const mainImage = displayImages[activeImageIndex] || displayImages[0] || '/placeholder.svg';

  // Get display badge
  const displayBadge = selectedVariant?.badge || product.badge;

  // Pricing
  const price = selectedVariant?.price;
  const salePrice = price ? price.sale_price || price.mrp_price : 0;
  const mrpPrice = price?.mrp_price || 0;
  const hasDiscount = !!price && mrpPrice > 0 && salePrice < mrpPrice;
  const discountPercent = hasDiscount ? Math.round(((mrpPrice - salePrice) / mrpPrice) * 100) : 0;

  const unitLabel =
    selectedVariant?.unit && selectedVariant?.unit_type
      ? `${selectedVariant.unit} ${selectedVariant.unit_type}`
      : selectedVariant?.name;

  const brandName = selectedVariant?.brand?.name || product.brand?.name;

  // Short description for the summary block
  const shortDescription =
    product.description && product.description.length > 260
      ? `${product.description.slice(0, 260).trim()}…`
      : product.description;

  const nutritionRows = parseNutrition(product.nutritional_info);

  // Key information rows (only non-empty values are shown)
  const keyInfoRows: { label: string; value: string | null | undefined }[] = [
    { label: 'Brand', value: brandName },
    { label: 'Category', value: category?.name },
    { label: 'Origin', value: product.origin },
    { label: 'Pack Size', value: unitLabel },
    { label: 'Packing Type', value: selectedVariant?.packing_type },
    { label: 'Type', value: selectedVariant?.type },
    {
      label: 'Best Before',
      value: selectedVariant?.best_before || product.best_before,
    },
    { label: 'SKU', value: selectedVariant?.sku },
    { label: 'HSN Code', value: selectedVariant?.hsn || product.hsn_code },
    { label: 'Product Code', value: product.product_code },
  ].filter((row) => row.value);

  const isPurchasable = !!selectedVariant && !!price && product.is_active && selectedVariant.is_active;

  return (
    <div className="min-h-screen flex flex-col bg-[#F9FBF8]">
      <Navbar />
      <main className="flex-grow pb-24 md:pb-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* ================= Breadcrumbs ================= */}
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm text-gray-500">
              <li>
                <Link to="/" className="font-semibold text-[#1E502B] hover:text-[#276B3C] transition-colors">
                  Home
                </Link>
              </li>
              <li aria-hidden>
                <ChevronRight className="w-3.5 h-3.5" />
              </li>
              <li>
                <Link
                  to={category ? `/products?category=${category.id}` : '/products'}
                  className="hover:text-[#276B3C] transition-colors"
                >
                  {category?.name || 'Products'}
                </Link>
              </li>
              <li aria-hidden>
                <ChevronRight className="w-3.5 h-3.5" />
              </li>
              <li className="font-semibold text-[#276B3C] truncate max-w-[16rem]" aria-current="page">
                {product.name}
              </li>
            </ol>
          </nav>

          {/* ================= Product Hero ================= */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start mb-10">
            {/* ---------- Gallery ---------- */}
            <div className="lg:col-span-7 flex flex-col-reverse lg:flex-row gap-3 sm:gap-4 lg:sticky lg:top-24">
              {displayImages.length > 1 && (
                <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto lg:max-h-[560px] scrollbar-none shrink-0 pb-1 lg:pb-0">
                  {displayImages.map((imageUrl, index) => (
                    <button
                      key={`${imageUrl}-${index}`}
                      id={`product-thumb-${index}`}
                      type="button"
                      onClick={() => setActiveImageIndex(index)}
                      aria-label={`View image ${index + 1}`}
                      className={cn(
                        'relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-white border-2 transition-all duration-200',
                        index === activeImageIndex
                          ? 'border-[#276B3C] shadow-md'
                          : 'border-transparent opacity-80 hover:opacity-100 hover:border-green-200'
                      )}
                    >
                      <img
                        src={imageUrl}
                        alt={`${product.name} - view ${index + 1}`}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              <div className="relative flex-1 rounded-3xl overflow-hidden bg-white border border-green-100/80 shadow-sm aspect-square group">
                <img
                  key={mainImage}
                  src={mainImage}
                  alt={product.name}
                  className="absolute inset-0 w-full h-full object-contain p-4 sm:p-6 animate-fade-in transition-transform duration-500 group-hover:scale-[1.03]"
                />
                {hasDiscount && (
                  <span className="absolute top-4 left-4 bg-[#F44336] text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                    {discountPercent}% OFF
                  </span>
                )}
              </div>
            </div>

            {/* ---------- Product Info ---------- */}
            <div className="lg:col-span-5 text-left">
              {displayBadge && (
                <span className="inline-block bg-[#1E502B] text-white text-xs font-semibold px-3 py-1 rounded-full shadow-xs mb-3">
                  {displayBadge}
                </span>
              )}

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#1E502B] leading-tight mb-1.5">
                {product.name}
              </h1>

              {(brandName || product.origin) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm sm:text-base text-gray-600 mb-4">
                  {brandName && <span className="font-medium text-[#276B3C]">by {brandName}</span>}
                  {product.origin && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-[#276B3C]" />
                      {product.origin}
                    </span>
                  )}
                </div>
              )}

              {/* Price block */}
              {selectedVariant ? (
                <div className="mb-4">
                  {price ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-3xl sm:text-4xl font-extrabold text-[#1E502B]">
                        {formatCurrency(salePrice)}
                      </span>
                      {hasDiscount && (
                        <>
                          <span className="text-lg sm:text-xl text-gray-400 line-through">
                            {formatCurrency(mrpPrice)}
                          </span>
                          <span className="bg-[#1E502B] text-white text-xs font-bold px-2.5 py-1 rounded-full">
                            {discountPercent}% OFF
                          </span>
                        </>
                      )}
                    </div>
                  ) : (
                    <span className="text-2xl font-bold text-gray-500">Price not available</span>
                  )}
                  {unitLabel && <p className="text-sm text-gray-600 mt-1">{unitLabel}</p>}
                  <p className="text-[11px] text-gray-400 mt-0.5">Inclusive of all taxes</p>
                </div>
              ) : (
                <div className="mb-4">
                  <span className="inline-block bg-red-100 text-red-700 text-xs font-semibold px-3 py-1 rounded-full">
                    No variant available
                  </span>
                </div>
              )}

              {/* Short description */}
              {shortDescription && (
                <p className="text-gray-700 text-sm sm:text-base leading-relaxed mb-5">{shortDescription}</p>
              )}

              {/* Variant Selector */}
              {activeVariants.length > 1 && (
                <div className="mb-5">
                  <label className="block text-sm font-semibold text-[#1E502B] mb-2">Select Pack Size</label>
                  <VariantSelector
                    variants={activeVariants}
                    selectedVariantId={selectedVariantId}
                    onSelect={setSelectedVariantId}
                    productId={product.id}
                    showStock
                  />
                </div>
              )}

              {/* Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 border-y border-green-100 py-4 mb-5">
                {HIGHLIGHTS.map(({ icon: Icon, title, subtitle }, idx) => (
                  <div
                    key={title}
                    className={cn(
                      'flex flex-col items-center text-center px-2',
                      idx !== 0 && 'sm:border-l sm:border-green-100'
                    )}
                  >
                    <div className="w-11 h-11 rounded-full bg-[#E8F5E9] text-[#276B3C] flex items-center justify-center mb-2 transition-transform duration-300 hover:scale-110">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-[#1E502B] leading-tight">{title}</span>
                    <span className="text-[11px] text-gray-500 leading-tight mt-0.5">{subtitle}</span>
                  </div>
                ))}
              </div>

              {/* Stock */}
              {selectedVariant && (
                <div className="mb-4">
                  <StockDisplay productId={product.id} variantId={selectedVariant.id} format="detailed" />
                </div>
              )}

              {/* Quantity + Add to Cart */}
              {isPurchasable ? (
                <div className="flex items-stretch gap-3 mb-6">
                  <div className="flex items-center bg-white border border-green-200 rounded-2xl shadow-xs">
                    <button
                      id="qty-decrease"
                      type="button"
                      onClick={decreaseQuantity}
                      disabled={quantityInCart === 0 && quantity <= 1}
                      aria-label="Decrease quantity"
                      className="w-11 h-12 flex items-center justify-center text-[#1E502B] hover:bg-green-50 rounded-l-2xl disabled:opacity-40 transition-colors"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-10 text-center text-base font-bold text-[#1E502B] tabular-nums">
                      {quantityInCart > 0 ? quantityInCart : quantity}
                    </span>
                    <button
                      id="qty-increase"
                      type="button"
                      onClick={increaseQuantity}
                      aria-label="Increase quantity"
                      className="w-11 h-12 flex items-center justify-center text-[#1E502B] hover:bg-green-50 rounded-r-2xl transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  {quantityInCart === 0 ? (
                    <button
                      id="add-to-cart"
                      type="button"
                      onClick={handleAddNewToCart}
                      className="flex-1 inline-flex items-center justify-center gap-2 bg-[#1E502B] hover:bg-[#276B3C] text-white font-semibold text-sm sm:text-base rounded-2xl shadow-md hover:shadow-lg active:scale-[0.99] transition-all"
                    >
                      <ShoppingCart className="h-5 w-5" />
                      Add to Cart
                    </button>
                  ) : (
                    <Link
                      id="view-cart"
                      to="/cart"
                      className="flex-1 inline-flex items-center justify-center gap-2 bg-[#E8F5E9] hover:bg-[#d7ecd9] text-[#1E502B] border border-green-300 font-semibold text-sm sm:text-base rounded-2xl transition-colors"
                    >
                      <CheckCircle2 className="h-5 w-5 text-[#276B3C]" />
                      In Cart · View Cart
                    </Link>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full mb-6 h-12 inline-flex items-center justify-center gap-2 bg-gray-300 text-white font-semibold rounded-2xl cursor-not-allowed"
                >
                  <ShoppingCart className="h-5 w-5" />
                  {selectedVariant ? 'Currently Unavailable' : 'Select Variant to Add to Cart'}
                </button>
              )}

              {/* Trust row */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: Truck, title: 'Free Shipping', subtitle: `on orders above ${formatCurrency(100)}` },
                  { icon: ShieldCheck, title: 'Secure Payments', subtitle: '100% secure checkout' },
                  { icon: RotateCcw, title: 'Easy Returns', subtitle: 'within 7 days' },
                ].map(({ icon: Icon, title, subtitle }, idx) => (
                  <div
                    key={title}
                    className={cn(
                      'flex items-center gap-2 px-1 sm:px-2',
                      idx !== 0 && 'border-l border-green-100'
                    )}
                  >
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-[#276B3C] shrink-0" />
                    <div className="leading-tight">
                      <p className="text-[11px] sm:text-xs font-semibold text-gray-800">{title}</p>
                      <p className="text-[10px] sm:text-[11px] text-gray-500">{subtitle}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ================= Info Tabs ================= */}
          <section className="bg-white rounded-3xl border border-green-100/80 shadow-sm mb-12 overflow-hidden">
            <div role="tablist" className="flex gap-1 sm:gap-6 px-4 sm:px-6 border-b border-green-100 overflow-x-auto scrollbar-none">
              {TABS.map(({ key, label, icon: Icon }) => {
                const isActive = activeTab === key;
                return (
                  <button
                    key={key}
                    id={`tab-${key}`}
                    role="tab"
                    type="button"
                    aria-selected={isActive}
                    aria-controls={`panel-${key}`}
                    onClick={() => setActiveTab(key)}
                    className={cn(
                      'relative inline-flex items-center gap-2 whitespace-nowrap py-4 px-2 text-sm font-semibold transition-colors',
                      isActive ? 'text-[#1E502B]' : 'text-gray-500 hover:text-[#276B3C]'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                    <span
                      className={cn(
                        'absolute left-0 right-0 -bottom-px h-0.5 rounded-full bg-[#276B3C] transition-transform duration-300 origin-left',
                        isActive ? 'scale-x-100' : 'scale-x-0'
                      )}
                    />
                  </button>
                );
              })}
            </div>

            <div className="p-5 sm:p-8 text-left">
              {/* Description */}
              {activeTab === 'description' && (
                <div
                  id="panel-description"
                  role="tabpanel"
                  aria-labelledby="tab-description"
                  className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in"
                >
                  <div>
                    <h2 className="text-lg font-bold text-[#1E502B] mb-3">About This Product</h2>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                      {product.description || 'No description available for this product yet.'}
                    </p>
                  </div>

                  <div className="lg:border-l lg:border-green-100 lg:pl-8">
                    <h2 className="text-lg font-bold text-[#1E502B] mb-3">Why You'll Love It</h2>
                    <ul className="space-y-2.5">
                      {WHY_LOVE_IT.map((point) => (
                        <li key={point} className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="w-4 h-4 text-[#276B3C] mt-0.5 shrink-0" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#E8F5E9] to-[#f5f8f0] border border-green-100 flex items-center min-h-[160px]">
                    <img
                      src={displayImages[1] || mainImage}
                      alt=""
                      aria-hidden
                      className="w-2/5 self-stretch object-cover"
                    />
                    <div className="p-4 sm:p-5">
                      <h3 className="font-bold text-[#1E502B] mb-1.5">
                        {product.origin ? `Sourced from ${product.origin}` : 'Handpicked Quality'}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                        {category?.description ||
                          'Carefully selected and packed to retain its natural freshness, taste and nutrition.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Nutrition Facts */}
              {activeTab === 'nutrition' && (
                <div id="panel-nutrition" role="tabpanel" aria-labelledby="tab-nutrition" className="animate-fade-in">
                  <h2 className="text-lg font-bold text-[#1E502B] mb-4">Nutrition Facts</h2>
                  {nutritionRows.length > 0 ? (
                    <div className="max-w-xl rounded-2xl border border-green-100 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-[#E8F5E9] text-[#1E502B]">
                          <tr>
                            <th className="text-left font-semibold px-4 py-2.5">Nutrient</th>
                            <th className="text-right font-semibold px-4 py-2.5">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {nutritionRows.map((row, idx) => (
                            <tr key={`${row.label}-${idx}`} className={idx % 2 ? 'bg-[#f9fbf8]' : 'bg-white'}>
                              <td className="px-4 py-2.5 text-gray-700">{row.label}</td>
                              <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{row.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : product.nutritional_info ? (
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line max-w-3xl">
                      {product.nutritional_info}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">Nutritional information is not available for this product.</p>
                  )}
                </div>
              )}

              {/* Key Information */}
              {activeTab === 'key-info' && (
                <div id="panel-key-info" role="tabpanel" aria-labelledby="tab-key-info" className="animate-fade-in">
                  <h2 className="text-lg font-bold text-[#1E502B] mb-4">Key Information</h2>
                  {keyInfoRows.length > 0 ? (
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 max-w-3xl">
                      {keyInfoRows.map((row) => (
                        <div key={row.label} className="flex justify-between gap-4 py-3 border-b border-green-100/80 text-sm">
                          <dt className="text-gray-500">{row.label}</dt>
                          <dd className="font-semibold text-gray-900 text-right">{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-sm text-gray-500">No additional information available.</p>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ================= You May Also Like ================= */}
          {isLoadingRelated ? (
            <div className="flex gap-4 overflow-hidden">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="w-48 sm:w-56 h-80 shrink-0 rounded-2xl bg-[#eef3e8]" />
              ))}
            </div>
          ) : (
            relatedProducts.length > 0 && (
              <section aria-labelledby="related-heading">
                <div className="flex items-center justify-between mb-5">
                  <h2 id="related-heading" className="text-xl sm:text-2xl font-bold text-[#1E502B]">
                    You May Also Like
                  </h2>
                  <Link
                    to={category ? `/products?category=${category.id}` : '/products'}
                    className="text-xs sm:text-sm font-semibold text-[#276B3C] hover:text-[#1E502B] inline-flex items-center gap-1"
                  >
                    View All <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>

                <div className="relative">
                  <button
                    id="related-prev"
                    type="button"
                    onClick={() => scrollRelated('left')}
                    aria-label="Scroll left"
                    className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white border border-green-100 shadow-md items-center justify-center text-[#1E502B] hover:bg-[#E8F5E9] transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div
                    ref={relatedScrollRef}
                    className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-none pb-2"
                  >
                    {relatedProducts.map((relatedProduct) => (
                      <div key={relatedProduct.id} className="w-44 sm:w-52 lg:w-56 shrink-0 snap-start">
                        <ProductCard product={relatedProduct} />
                      </div>
                    ))}
                  </div>

                  <button
                    id="related-next"
                    type="button"
                    onClick={() => scrollRelated('right')}
                    aria-label="Scroll right"
                    className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white border border-green-100 shadow-md items-center justify-center text-[#1E502B] hover:bg-[#E8F5E9] transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </section>
            )
          )}
        </div>
      </main>

      {/* ================= Mobile Sticky Add to Cart ================= */}
      {isMobile && isPurchasable && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-green-100 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] md:hidden px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-extrabold text-[#1E502B]">{formatCurrency(salePrice)}</span>
                {hasDiscount && (
                  <span className="text-xs text-gray-400 line-through">{formatCurrency(mrpPrice)}</span>
                )}
              </div>
              {unitLabel && <p className="text-[11px] text-gray-500 truncate">{unitLabel}</p>}
            </div>

            {quantityInCart === 0 ? (
              <button
                type="button"
                onClick={handleAddNewToCart}
                className="inline-flex items-center gap-2 bg-[#1E502B] hover:bg-[#276B3C] text-white font-semibold text-sm px-5 py-3 rounded-xl shadow-md"
              >
                <ShoppingCart className="h-4 w-4" />
                Add {quantity > 1 ? `(${quantity})` : ''}
              </button>
            ) : (
              <div className="flex items-center bg-white border border-green-300 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleUpdateCartQuantity(quantityInCart - 1)}
                  aria-label="Decrease quantity"
                  className="w-10 h-10 flex items-center justify-center text-[#1E502B]"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center font-bold text-[#1E502B] tabular-nums">{quantityInCart}</span>
                <button
                  type="button"
                  onClick={() => handleUpdateCartQuantity(quantityInCart + 1)}
                  aria-label="Increase quantity"
                  className="w-10 h-10 flex items-center justify-center text-[#1E502B]"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default ProductDetails;
