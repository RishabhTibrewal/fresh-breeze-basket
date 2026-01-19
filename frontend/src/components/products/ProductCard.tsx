import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Heart, Minus, Plus } from 'lucide-react';
import { Product } from '@/api/products';
import { cn } from '@/lib/utils';
import { useCart } from '@/contexts/CartContext';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { state: cartState, addToCart, updateQuantity } = useCart();
  
  const cartItem = cartState.items.find(item => item.id === product.id);
  const quantityInCart = cartItem ? cartItem.quantity : 0;

  const handleInitialAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.stock_count > 0) {
      addToCart(product, 1);
      toast({ title: "Added to Cart", description: `1 x ${product.name} added.` });
    } else {
      toast({ title: "Out of Stock", description: `${product.name} is currently unavailable.`, variant: "destructive" });
    }
  };

  const handleDecreaseQuantity = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (cartItem && product) {
      const newQuantity = cartItem.quantity - 1;
      updateQuantity(product.id, newQuantity);
      if (newQuantity > 0) {
        toast({ title: "Cart Updated", description: `${product.name} quantity set to ${newQuantity}.` });
      } else {
        toast({ title: "Item Removed", description: `${product.name} removed from cart.` });
      }
    }
  };

  const handleIncreaseQuantity = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (cartItem && product) {
      if (cartItem.quantity + 1 > product.stock_count) {
        toast({ title: "Not Enough Stock", description: `Only ${product.stock_count} items available.`, variant: "destructive" });
        return;
      }
      updateQuantity(product.id, cartItem.quantity + 1);
      toast({ title: "Cart Updated", description: `${product.name} quantity set to ${cartItem.quantity + 1}.` });
    }
  };

  return (
    <div className="product-card flex flex-col bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow h-full">
      <Link to={`/products/${product.id}`} className="relative overflow-hidden group">
        <div className="relative aspect-square overflow-hidden rounded-lg">
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover object-center"
          />
          {product.badge && (
            <div className="absolute left-2 top-2">
              <Badge variant="secondary" className="text-xs">
                {product.badge}
              </Badge>
            </div>
          )}
        </div>
      </Link>
      
      <div className="p-2 sm:p-3 flex-grow flex flex-col">
        <div className="text-xs text-gray-500 mb-0.5">Origin: {product.origin}</div>
        <Link to={`/products/${product.id}`} className="hover:text-primary">
          <h3 className="font-semibold text-sm sm:text-base mb-1.5 line-clamp-2">{product.name}</h3>
        </Link>
        
        <div className="mt-auto">
          <div className="flex items-baseline mb-2">
            {product.sale_price ? (
              <>
                <span className="text-accent-sale font-bold text-sm sm:text-base">₹ {product.sale_price.toFixed(2)}</span>
                <span className="ml-1.5 text-gray-500 line-through text-xs">₹ {product.price.toFixed(2)}</span>
                <span className="ml-1 text-xs text-gray-600">/{product.unit_type}</span>
              </>
            ) : (
              <>
                <span className="font-bold text-sm sm:text-base">₹ {product.price.toFixed(2)}</span>
                <span className="ml-1 text-xs text-gray-600">/{product.unit_type}</span>
              </>
            )}
          </div>
          
          {product.stock_count > 0 ? (
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
                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 border-l text-primary disabled:text-gray-400"
                    disabled={quantityInCart >= product.stock_count}
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
                Out of Stock
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
