import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Heart } from 'lucide-react';
import { Product } from '@/api/products';
import { cn } from '@/lib/utils';
import { useCart } from '@/contexts/CartContext';
import { Badge } from '@/components/ui/badge';

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addToCart } = useCart();
  
  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product, 1);
  };

  return (
    <div className="product-card flex flex-col bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
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
      
      <div className="p-3 sm:p-4 flex-grow flex flex-col">
        <div className="text-xs text-gray-500 mb-1">Origin: {product.origin}</div>
        <Link to={`/products/${product.id}`} className="hover:text-primary">
          <h3 className="font-semibold text-base sm:text-lg mb-2 line-clamp-2">{product.name}</h3>
        </Link>
        
        <div className="mt-auto">
          <div className="flex items-baseline mb-3">
            {product.sale_price ? (
              <>
                <span className="text-accent-sale font-bold text-base sm:text-lg">AED {product.sale_price.toFixed(2)}</span>
                <span className="ml-2 text-gray-500 line-through text-sm">AED {product.price.toFixed(2)}</span>
                <span className="ml-1 text-sm text-gray-600">/{product.unit_type}</span>
              </>
            ) : (
              <>
                <span className="font-bold text-base sm:text-lg">AED {product.price.toFixed(2)}</span>
                <span className="ml-1 text-sm text-gray-600">/{product.unit_type}</span>
              </>
            )}
          </div>
          
          <div className="flex space-x-2">
            <button 
              onClick={handleAddToCart}
              className="flex-1 bg-primary text-white rounded-md py-2 px-3 flex items-center justify-center text-sm hover:bg-opacity-90 transition-colors"
            >
              <ShoppingCart className="h-4 w-4 mr-1" />
              Add to Cart
            </button>
            <button className="bg-gray-100 hover:bg-gray-200 rounded-md p-2 transition-colors">
              <Heart className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
