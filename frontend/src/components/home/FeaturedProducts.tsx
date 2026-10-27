import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ProductCard from '@/components/products/ProductCard';
import { productsService } from '@/api/products';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorMessage } from '@/components/ui/error-message';
import { ArrowRight, Leaf } from 'lucide-react';

interface FeaturedProductsProps {
  limit?: number;
}

const FeaturedProducts: React.FC<FeaturedProductsProps> = ({ limit = 8 }) => {
  const { data: products, isLoading, error } = useQuery({
    queryKey: ['products', 'featured'],
    queryFn: async () => {
      const allProducts = await productsService.getAll();
      const featured = allProducts.filter(product => product.is_featured);
      return featured.length > 0 ? featured : allProducts;
    }
  });

  const displayProducts = products && limit ? products.slice(0, limit) : products;

  if (isLoading) {
    return (
      <section className="py-16 md:py-20 bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10">
            <div>
              <div className="inline-flex items-center gap-2 text-[#276B3C] font-semibold text-sm mb-2">
                <Leaf className="w-4 h-4" />
                <span>Our Bestsellers</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1E502B] font-serif">
                Fresh Picks for a Healthier You
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array(4).fill(0).map((_, index) => (
              <div key={index} className="flex flex-col space-y-3">
                <Skeleton className="h-56 w-full rounded-2xl" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-16 md:py-20 bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <ErrorMessage 
            title="Error" 
            message="Failed to load featured products" 
          />
        </div>
      </section>
    );
  }

  if (!displayProducts || displayProducts.length === 0) {
    return null;
  }

  return (
    <section className="py-16 md:py-20 bg-white border-b border-gray-100 relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[#276B3C] font-semibold text-sm mb-2">
              <Leaf className="w-4 h-4 fill-[#276B3C]" />
              <span>Our Bestsellers</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1E502B] font-serif mb-2">
              Fresh Picks for a Healthier You
            </h2>
            <p className="text-gray-600 text-base sm:text-lg">
              Handpicked favorites, loved by our customers.
            </p>
          </div>

          <Link 
            to="/products" 
            className="inline-flex items-center gap-2 text-[#276B3C] hover:text-[#1E502B] font-bold text-sm sm:text-base group transition-colors"
          >
            <span>View All</span>
            <div className="w-7 h-7 rounded-full bg-[#E8F5E9] text-[#276B3C] flex items-center justify-center group-hover:bg-[#276B3C] group-hover:text-white transition-colors">
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>
        </div>
        
        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {displayProducts.map((product) => (
            <div key={product.id} className="h-full">
              <ProductCard product={product} />
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default FeaturedProducts;

