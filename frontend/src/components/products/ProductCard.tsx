
import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Heart } from 'lucide-react';
import { Product } from '@/data/productData';
import { cn } from '@/lib/utils';
import { useCart } from '@/contexts/CartContext';

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
    <div className="product-card flex flex-col">
      <Link to={`/products/${product.slug}`} className="relative overflow-hidden group">
        {product.badge && (
          <div className={cn(
            "absolute top-2 left-2 z-10 py-1 px-3 text-white text-xs font-semibold rounded-full",
            {
              'bg-accent-sale': product.badge === 'sale',
              'bg-accent': product.badge === 'new',
              'bg-primary': product.badge === 'best-seller',
              'bg-accent-special': product.badge === 'organic',
            }
          )}>
            {product.badge === 'sale' ? 'SALE' : 
             product.badge === 'new' ? 'NEW' : 
             product.badge === 'best-seller' ? 'BEST SELLER' : 
             'ORGANIC'}
          </div>
        )}
        <div className="h-48 sm:h-56 overflow-hidden">
          <img 
            src={product.images[0]} 
            alt={product.name} 
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
        </div>
      </Link>
      
      <div className="p-4 flex-grow flex flex-col">
        <div className="text-xs text-gray-500 mb-1">Origin: {product.origin}</div>
        <Link to={`/products/${product.slug}`} className="hover:text-primary">
          <h3 className="font-semibold text-lg mb-2 line-clamp-2">{product.name}</h3>
        </Link>
        
        <div className="mt-auto">
          <div className="flex items-baseline mb-3">
            {product.salePrice ? (
              <>
                <span className="text-accent-sale font-bold text-lg">AED {product.salePrice.toFixed(2)}</span>
                <span className="ml-2 text-gray-500 line-through text-sm">AED {product.price.toFixed(2)}</span>
              </>
            ) : (
              <span className="font-bold text-lg">AED {product.price.toFixed(2)}</span>
            )}
            <span className="ml-1 text-sm text-gray-600">/{product.unit}</span>
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
