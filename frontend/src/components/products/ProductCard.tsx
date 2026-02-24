import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Heart, Minus, Plus, ChevronDown } from 'lucide-react';
import { Product, ProductVariant } from '@/api/products';
import { cn } from '@/lib/utils';
import { useCart } from '@/contexts/CartContext';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { VariantSelector } from './VariantSelector';
import { PriceDisplay } from './PriceDisplay';
import { StockDisplay } from '@/components/inventory/StockDisplay';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { state: cartState, addToCart, updateQuantity, removeFromCart } = useCart();
  const isMobile = useIsMobile();
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [showVariantSelector, setShowVariantSelector] = useState(false);

  // Get active variants
  const activeVariants = product.variants?.filter(v => v.is_active) || [];
  
  // Select default variant or first active variant
  React.useEffect(() => {
    if (!selectedVariantId && activeVariants.length > 0) {
      const defaultVariant = activeVariants.find(v => v.is_default) || activeVariants[0];
      setSelectedVariantId(defaultVariant.id);
    }
  }, [activeVariants, selectedVariantId]);

  const selectedVariant = activeVariants.find(v => v.id === selectedVariantId);
  
  // Find cart item by product ID and variant ID
  const cartItem = cartState.items.find(
    item => item.id === product.id && item.variant_id === selectedVariantId
  );
  const quantityInCart = cartItem ? cartItem.quantity : 0;

  // Get stock for selected variant
  const variantStock = selectedVariant ? (
    <StockDisplay
      productId={product.id}
      variantId={selectedVariant.id}
      format="compact"
    />
  ) : null;

  const handleInitialAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!selectedVariant) {
      if (activeVariants.length > 1) {
        setShowVariantSelector(true);
        toast.error('Please select a variant');
      } else {
        toast.error('No variant available');
      }
      return;
    }

    // Check variant stock
    if (selectedVariant.price && selectedVariant.price.sale_price !== undefined) {
      addToCart(product, selectedVariant, 1);
      toast.success(`Added ${product.name} (${selectedVariant.name}) to cart`);
    } else {
      toast.error('Variant price not available');
    }
  };

  const handleDecreaseQuantity = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (cartItem && selectedVariant) {
      const newQuantity = cartItem.quantity - 1;
      if (newQuantity > 0) {
        updateQuantity(product.id, selectedVariant.id, newQuantity);
        toast.success(`Updated quantity to ${newQuantity}`);
      } else {
        removeFromCart(product.id, selectedVariant.id);
        toast.success('Removed from cart');
      }
    }
  };

  const handleIncreaseQuantity = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (cartItem && selectedVariant) {
      updateQuantity(product.id, selectedVariant.id, cartItem.quantity + 1);
      toast.success(`Updated quantity to ${cartItem.quantity + 1}`);
    }
  };

  // Get display image (variant image or product image)
  const displayImage = selectedVariant?.image_url || product.image_url || '/placeholder.svg';
  
  // Get display badge (variant badge or product badge)
  const displayBadge = selectedVariant?.badge || product.badge;

  // Price from variant
  const variantPrice = selectedVariant?.price;

  return (
    <div className="product-card flex flex-col bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow h-full">
      <Link to={`/products/${product.id}`} className="relative overflow-hidden group">
        <div className="relative aspect-square overflow-hidden rounded-lg">
          <img
            src={displayImage}
            alt={product.name}
            className="h-full w-full object-cover object-center"
          />
          {displayBadge && (
            <div className="absolute left-2 top-2">
              <Badge variant="secondary" className="text-xs">
                {displayBadge}
              </Badge>
            </div>
          )}
        </div>
      </Link>
      
      <div className="p-2 sm:p-3 flex-grow flex flex-col">
        <div className="text-xs text-gray-500 mb-0.5">{product.origin || ''}</div>
        <Link to={`/products/${product.id}`} className="hover:text-primary">
          <h3 className="font-semibold text-sm sm:text-base mb-1.5 line-clamp-2">{product.name}</h3>
        </Link>

        {/* Variant Selector */}
        {activeVariants.length > 1 && (
          <div className="mb-2">
            {isMobile ? (
              <Sheet open={showVariantSelector} onOpenChange={setShowVariantSelector}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowVariantSelector(true);
                    }}
                  >
                    {selectedVariant?.name || 'Select Variant'}
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[80vh]">
                  <SheetHeader>
                    <SheetTitle>Select Variant</SheetTitle>
                  </SheetHeader>
                  <VariantSelector
                    variants={activeVariants}
                    selectedVariantId={selectedVariantId}
                    onSelect={(id) => {
                      setSelectedVariantId(id);
                      setShowVariantSelector(false);
                    }}
                    productId={product.id}
                    showStock
                  />
                </SheetContent>
              </Sheet>
            ) : (
              <VariantSelector
                variants={activeVariants}
                selectedVariantId={selectedVariantId}
                onSelect={setSelectedVariantId}
                productId={product.id}
                showStock={false}
              />
            )}
          </div>
        )}

        {selectedVariant && (
          <>
            {/* Price Display */}
            <div className="mb-2">
              {variantPrice ? (
                <PriceDisplay
                  mrpPrice={variantPrice.mrp_price}
                  salePrice={variantPrice.sale_price}
                  size="sm"
                />
              ) : (
                <span className="text-sm text-muted-foreground">Price not available</span>
              )}
            </div>

            {/* Stock Display */}
            <div className="mb-2 text-xs text-muted-foreground">
              {variantStock}
            </div>
          </>
        )}
        
        <div className="mt-auto">
          {selectedVariant && variantPrice ? (
            quantityInCart === 0 ? (
              <div className="flex space-x-1.5">
                <button 
                  onClick={handleInitialAddToCart}
                  className="flex-1 bg-primary text-white rounded-md py-1.5 px-2 flex items-center justify-center text-xs sm:text-sm hover:bg-opacity-90 transition-colors"
                >
                  <ShoppingCart className="h-3 w-3 mr-1" />
                  Add to Cart
                </button>
                <button className="bg-gray-100 hover:bg-gray-200 rounded-md p-1.5 transition-colors">
                  <Heart className="h-3 w-3 text-gray-600" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between space-x-1.5">
                <div className="flex items-center border rounded-md overflow-hidden">
                  <button 
                    onClick={handleDecreaseQuantity}
                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 border-r text-primary disabled:text-gray-400"
                    disabled={quantityInCart <= 0}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-10 text-center text-sm font-medium text-gray-700 tabular-nums">{quantityInCart}</span>
                  <button 
                    onClick={handleIncreaseQuantity}
                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 border-l text-primary"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <button className="bg-gray-100 hover:bg-gray-200 rounded-md p-1.5 transition-colors">
                  <Heart className="h-3 w-3 text-gray-600" />
                </button>
              </div>
            )
          ) : (
            <div className="text-center py-2 flex flex-col items-center">
              <Badge variant="outline" className="text-sm text-red-600 border-red-600">
                {activeVariants.length === 0 ? 'No Variants' : 'Select Variant'}
              </Badge>
              <button className="mt-2 bg-gray-100 hover:bg-gray-200 rounded-md p-1.5 transition-colors">
                <Heart className="h-3 w-3 text-gray-600" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
