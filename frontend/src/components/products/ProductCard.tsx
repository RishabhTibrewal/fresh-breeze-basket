import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Heart, Minus, Plus, ChevronDown } from 'lucide-react';
import { Product, ProductVariant } from '@/api/products';
import { cn } from '@/lib/utils';
import { useCompanyCurrency } from '@/hooks/useCompanyCurrency';
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
  const { formatCurrency } = useCompanyCurrency();
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
    <div className="product-card flex flex-col bg-[#f5f8f0] rounded-2xl border border-green-100/70 p-3 shadow-xs hover:shadow-md transition-all duration-300 h-full justify-between relative group">
      {/* Top Image Container */}
      <div className="relative">
        <Link to={`/products/${product.id}`} className="block relative overflow-hidden rounded-xl bg-white/70 border border-green-50 p-2 aspect-square">
          <img
            src={displayImage}
            alt={product.name}
            className="h-full w-full object-contain object-center transform group-hover:scale-105 transition-transform duration-300"
          />
        </Link>

        {/* Top Badges & Wishlist Heart Button */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none z-10">
          <div>
            {(displayBadge || product.is_featured) && (
              <span className="bg-[#1E502B] text-white text-[10px] sm:text-xs font-semibold px-2.5 py-1 rounded-full shadow-xs">
                {displayBadge || (product.is_featured ? 'Best Seller' : '')}
              </span>
            )}
          </div>
          <button 
            type="button"
            aria-label="Add to Wishlist"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/90 backdrop-blur-xs shadow-xs text-gray-400 hover:text-red-500 hover:bg-white flex items-center justify-center pointer-events-auto transition-colors"
          >
            <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        </div>
      </div>
      
      {/* Product Content */}
      <div className="pt-3 pb-1 flex-grow flex flex-col">
        {/* Title */}
        <Link to={`/products/${product.id}`} className="hover:text-[#276B3C] transition-colors">
          <h3 className="font-bold text-[#1E502B] text-sm sm:text-base line-clamp-1 mb-0.5">{product.name}</h3>
        </Link>

        {/* Feature Tagline / Description */}
        <p className="text-[11px] sm:text-xs text-gray-500 line-clamp-1 mb-2">
          {product.description || 'Aromatic • Fresh • Pure & Natural'}
        </p>

        {/* Price & Unit Row */}
        <div className="flex items-baseline justify-between mt-auto mb-2">
          <div className="flex items-baseline gap-1.5">
            {variantPrice ? (
              <>
                <span className="font-extrabold text-[#1E502B] text-sm sm:text-base">
                  {formatCurrency(variantPrice.sale_price || variantPrice.mrp_price)}
                </span>
                {variantPrice.sale_price < variantPrice.mrp_price && (
                  <span className="text-xs text-gray-400 line-through">
                    {formatCurrency(variantPrice.mrp_price)}
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs text-gray-500">Price not available</span>
            )}
          </div>
          <span className="text-[11px] font-medium text-gray-500 bg-white/60 px-2 py-0.5 rounded-md border border-gray-100">
            {selectedVariant?.name || '1 kg'}
          </span>
        </div>

        {/* Variant Selector Button (if multiple) */}
        {activeVariants.length > 1 && (
          <div className="mb-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                setShowVariantSelector(!showVariantSelector);
              }}
              className="w-full text-[11px] text-gray-600 bg-white border border-green-200/80 rounded-lg py-1 px-2 flex items-center justify-between hover:border-green-400 transition-colors"
            >
              <span>Variant: {selectedVariant?.name || 'Select'}</span>
              <ChevronDown className="h-3 w-3 text-gray-400" />
            </button>
            
            {showVariantSelector && (
              <div className="mt-1 bg-white border border-green-200 rounded-lg shadow-lg p-1.5 space-y-1 max-h-32 overflow-y-auto">
                {activeVariants.map((variant) => (
                  <button
                    key={variant.id}
                    onClick={() => {
                      setSelectedVariantId(variant.id);
                      setShowVariantSelector(false);
                    }}
                    className={cn(
                      "w-full text-left text-xs px-2 py-1 rounded-md transition-colors flex items-center justify-between",
                      variant.id === selectedVariantId ? "bg-[#E8F5E9] text-[#276B3C] font-semibold" : "hover:bg-gray-50 text-gray-700"
                    )}
                  >
                    <span>{variant.name}</span>
                    <span className="font-bold">{formatCurrency(variant.price?.sale_price || variant.price?.mrp_price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action CTA Button */}
      <div className="mt-auto pt-1">
        {quantityInCart === 0 ? (
          <button 
            onClick={handleInitialAddToCart}
            className="w-full bg-[#1E502B] hover:bg-[#276B3C] text-white font-semibold rounded-xl py-2 px-3 flex items-center justify-center gap-2 text-xs sm:text-sm shadow-xs hover:shadow-md transition-all duration-300"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span>Add to Cart</span>
          </button>
        ) : (
          <div className="flex items-center justify-between bg-white rounded-xl border border-green-300 p-1 shadow-xs">
            <button 
              onClick={handleDecreaseQuantity}
              className="w-7 h-7 rounded-lg bg-green-50 hover:bg-green-100 flex items-center justify-center text-[#1E502B] transition-colors"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs sm:text-sm font-bold text-[#1E502B] px-2 tabular-nums">
              {quantityInCart} in Cart
            </span>
            <button 
              onClick={handleIncreaseQuantity}
              className="w-7 h-7 rounded-lg bg-[#1E502B] text-white hover:bg-[#276B3C] flex items-center justify-center transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
