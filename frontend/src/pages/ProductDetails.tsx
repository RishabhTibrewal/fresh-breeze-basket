import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Flag, ShoppingCart, Heart, Minus, Plus, ArrowLeft } from 'lucide-react';
import { productsService, ProductVariant } from '@/api/products';
import ProductCard from '@/components/products/ProductCard';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useCart } from '@/contexts/CartContext';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorMessage } from '@/components/ui/error-message';
import { toast } from 'sonner';
import { VariantSelector } from '@/components/products/VariantSelector';
import { PriceDisplay } from '@/components/products/PriceDisplay';
import { StockDisplay } from '@/components/inventory/StockDisplay';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const ProductDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const { state: cartState, addToCart, updateQuantity, removeFromCart } = useCart();

  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsService.getById(id || ''),
    enabled: !!id,
  });

  // Get active variants
  const activeVariants = product?.variants?.filter(v => v.is_active) || [];
  
  // Select default variant or first active variant
  useEffect(() => {
    if (!selectedVariantId && activeVariants.length > 0) {
      const defaultVariant = activeVariants.find(v => v.is_default) || activeVariants[0];
      setSelectedVariantId(defaultVariant.id);
    }
  }, [activeVariants, selectedVariantId]);

  const selectedVariant = activeVariants.find(v => v.id === selectedVariantId);
  
  // Find cart item by product ID and variant ID
  const cartItem = product && selectedVariantId
    ? cartState.items.find(
        item => item.id === product.id && item.variant_id === selectedVariantId
      )
    : undefined;
  const quantityInCart = cartItem ? cartItem.quantity : 0;

  useEffect(() => {
    if (product && selectedVariant) {
      setQuantity(quantityInCart > 0 ? quantityInCart : 1);
    }
  }, [product, selectedVariant, quantityInCart]);

  // Get related products
  const { data: allProductsForRelated, isLoading: isLoadingRelated } = useQuery({
    queryKey: ['products', 'allUnfilteredForRelated'],
    queryFn: productsService.getAll,
  });

  const relatedProducts = allProductsForRelated
    ?.filter(p => p.category_id === product?.category_id && p.id !== product?.id)
    .slice(0, 4);

  const decreaseQuantity = () => {
    setQuantity(prev => Math.max(1, prev - 1));
  };

  const increaseQuantity = () => {
    // Stock limit will be checked when adding to cart
    setQuantity(prev => prev + 1);
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <Skeleton className="h-96 rounded-lg" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-24" />
              <Skeleton className="h-12" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow container mx-auto px-4 py-12">
          <ErrorMessage 
            title="Product Not Found" 
            message="Sorry, the product you are looking for does not exist." 
          />
          <Link to="/products" className="btn-primary mt-6 inline-block">
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
    ? selectedVariant.variant_images
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
        .map(img => img.image_url)
    : [];
  const variantImages = [...mainVariantImage, ...variantAdditionalImages];
  const productImages = product.image_url ? [product.image_url, ...(product.additional_images || [])] : [];
  const displayImages = variantImages.length > 0 ? variantImages : productImages;
  
  const mainImage = displayImages[activeImageIndex] || '/placeholder.svg';

  // Get display badge
  const displayBadge = selectedVariant?.badge || product.badge;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow pb-20 md:pb-8">
        <div className="container mx-auto px-4 py-8">
          {/* Breadcrumbs */}
          <div className="mb-6">
            <Link to="/products" className="flex items-center text-primary hover:underline">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Products
            </Link>
          </div>

          {/* Product Details */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
              {/* Product Images */}
              <div>
                <div className="relative rounded-lg overflow-hidden mb-4 aspect-[4/3] bg-gray-50">
                  <img 
                    src={mainImage} 
                    alt={product.name} 
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                </div>
                {displayImages.length > 1 && (
                  <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                    {displayImages.map((imageUrl, index) => (
                      <button
                        key={index}
                        onClick={() => setActiveImageIndex(index)}
                        className={cn(
                          "relative rounded-lg overflow-hidden aspect-square",
                          index === activeImageIndex ? 'ring-2 ring-primary' : ''
                        )}
                      >
                        <img
                          src={imageUrl}
                          alt={`${product.name} - view ${index + 1}`}
                          className="absolute inset-0 w-full h-full object-contain hover:scale-110 transition-transform duration-200"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Product Info */}
              <div>
                {displayBadge && (
                  <Badge variant="secondary" className="mb-2">
                    {displayBadge}
                  </Badge>
                )}
                <h1 className="text-2xl sm:text-3xl font-bold mb-3">{product.name}</h1>
                
                {product.origin && (
                  <div className="flex items-center mb-4">
                    <Flag className="h-4 w-4 mr-2 text-gray-500" />
                    <span className="text-gray-600">Origin: {product.origin}</span>
                  </div>
                )}

                {/* Variant Selector */}
                {activeVariants.length > 1 && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium mb-2">Select Variant</label>
                    <VariantSelector
                      variants={activeVariants}
                      selectedVariantId={selectedVariantId}
                      onSelect={setSelectedVariantId}
                      productId={product.id}
                      showStock
                    />
                  </div>
                )}

                {selectedVariant ? (
                  <>
                    {/* Price Display */}
                    <div className="mb-4">
                      {selectedVariant.price ? (
                        <PriceDisplay
                          mrpPrice={selectedVariant.price.mrp_price}
                          salePrice={selectedVariant.price.sale_price}
                          size="lg"
                        />
                      ) : (
                        <span className="text-2xl sm:text-3xl font-bold">Price not available</span>
                      )}
                      {selectedVariant.unit && selectedVariant.unit_type && (
                        <span className="ml-2 text-gray-600 text-lg">
                          / {selectedVariant.unit} {selectedVariant.unit_type}
                        </span>
                      )}
                    </div>

                    {/* Stock Display */}
                    <div className="mb-6">
                      <StockDisplay
                        productId={product.id}
                        variantId={selectedVariant.id}
                        format="detailed"
                      />
                    </div>
                  </>
                ) : (
                  <div className="mb-6">
                    <Badge variant="destructive">No variant available</Badge>
                  </div>
                )}
                
                <p className="text-gray-700 mb-6">{product.description}</p>

                {product.nutritional_info && (
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold mb-2">Nutritional Highlights:</h2>
                    <p className="text-gray-700">{product.nutritional_info}</p>
                  </div>
                )}

                {/* Add to Cart Section */}
                {selectedVariant && selectedVariant.price && (
                  <div className="mb-6">
                    {quantityInCart === 0 ? (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex items-center border rounded-lg overflow-hidden">
                          <button
                            onClick={decreaseQuantity}
                            className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 border-r"
                            disabled={quantity <= 1}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-12 text-center text-lg tabular-nums">
                            {quantity}
                          </span>
                          <button
                            onClick={increaseQuantity}
                            className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 border-l"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        
                        <Button
                          onClick={handleAddNewToCart}
                          className="flex-1 bg-green-600 text-white py-3 sm:py-2 hover:bg-green-700"
                          disabled={!product.is_active || !selectedVariant.is_active}
                        >
                          <ShoppingCart className="h-5 w-5 mr-2" />
                          Add to Cart ({quantity})
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center border rounded-lg overflow-hidden">
                          <button
                            onClick={() => handleUpdateCartQuantity(quantityInCart - 1)}
                            className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 border-r"
                            disabled={quantityInCart <= 0}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-12 text-center text-lg tabular-nums">
                            {quantityInCart}
                          </span>
                          <button
                            onClick={() => handleUpdateCartQuantity(quantityInCart + 1)}
                            className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 border-l"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="text-sm text-green-700">
                          This item is in your cart. Adjust quantity above.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {!selectedVariant && (
                  <div className="mb-6">
                    <Button
                      disabled
                      className="w-full bg-gray-400 text-white cursor-not-allowed"
                    >
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      Select Variant to Add to Cart
                    </Button>
                  </div>
                )}

                <div className="flex gap-3 mb-6">
                  <button
                    className="w-12 sm:w-14 h-12 sm:h-14 flex items-center justify-center border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Heart className="h-5 sm:h-6 w-5 sm:w-6 text-gray-500" />
                  </button>
                </div>
                                
                <div className="mt-6 flex items-center text-gray-600">
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Free delivery for orders over ₹ 100
                </div>
              </div>
            </div>
          </div>

          {/* Related Products */}
          {isLoadingRelated ? (
            <p>Loading related products...</p>
          ) : relatedProducts && relatedProducts.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Related Products</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {relatedProducts.map((relatedProduct) => (
                  <ProductCard 
                    key={relatedProduct.id} 
                    product={relatedProduct}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Sticky Variant Selector & Add to Cart */}
      {isMobile && selectedVariant && selectedVariant.price && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-lg md:hidden p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              {activeVariants.length > 1 && (
                <VariantSelector
                  variants={activeVariants}
                  selectedVariantId={selectedVariantId}
                  onSelect={setSelectedVariantId}
                  productId={product.id}
                  showStock={false}
                />
              )}
              {selectedVariant.price && (
                <PriceDisplay
                  mrpPrice={selectedVariant.price.mrp_price}
                  salePrice={selectedVariant.price.sale_price}
                  size="sm"
                />
              )}
            </div>
            {quantityInCart === 0 ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center border rounded-lg overflow-hidden">
                  <button
                    onClick={decreaseQuantity}
                    className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 border-r"
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-12 text-center text-lg tabular-nums">
                    {quantity}
                  </span>
                  <button
                    onClick={increaseQuantity}
                    className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 border-l"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <Button
                  onClick={handleAddNewToCart}
                  className="bg-green-600 text-white hover:bg-green-700"
                  disabled={!product.is_active || !selectedVariant.is_active}
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Add
                </Button>
              </div>
            ) : (
              <div className="flex items-center border rounded-lg overflow-hidden">
                <button
                  onClick={() => handleUpdateCartQuantity(quantityInCart - 1)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 border-r"
                  disabled={quantityInCart <= 0}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-12 text-center text-lg tabular-nums">
                  {quantityInCart}
                </span>
                <button
                  onClick={() => handleUpdateCartQuantity(quantityInCart + 1)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 border-l"
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
