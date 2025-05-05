import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchCategories } from '@/api/categories';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorMessage } from '@/components/ui/error-message';
import { ExternalLink, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// Define background colors for categories (will cycle through these)
const CATEGORY_COLORS = [
  'bg-primary/10 hover:bg-primary/20',
  'bg-green-100 hover:bg-green-200',
  'bg-amber-100 hover:bg-amber-200',
  'bg-sky-100 hover:bg-sky-200',
  'bg-rose-100 hover:bg-rose-200',
  'bg-indigo-100 hover:bg-indigo-200',
];

const FeaturedCategories = () => {
  const { data: categories, isLoading, error } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  return (
    <section className="py-12 md:py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Shop by Category</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Explore our selection of fresh, premium quality products sorted by category to make your shopping experience easier.
          </p>
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" role="status" aria-label="Loading categories">
            {[...Array(4)].map((_, index) => (
              <Skeleton key={index} className="h-64 rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <ErrorMessage 
            title="Failed to load categories" 
            message="We couldn't load the product categories. Please try refreshing the page." 
          />
        ) : (
          <>
            {/* Featured Main Categories - Top Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {categories?.slice(0, 2).map((category, index) => (
                <Link 
                  key={category.id} 
                  to={`/products?category=${category.id}`}
                  className="group relative overflow-hidden rounded-xl shadow-md transition-all duration-300 hover:shadow-lg flex flex-col"
                >
                  <div className="aspect-[16/9] overflow-hidden">
                    <img
                      src={category.image_url || '/placeholder.svg'}
                      alt={category.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-6">
                    <h3 className="text-2xl font-bold text-white mb-2">{category.name}</h3>
                    <p className="text-white/90 mb-4">
                      Browse our selection of premium {category.name.toLowerCase()}
                    </p>
                    <div className="flex items-center text-white bg-primary/80 rounded-full py-2 px-4 w-fit transform transition-transform group-hover:translate-x-2">
                      <span className="mr-2">Shop Now</span>
                      <ChevronRight size={16} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            
            {/* Smaller Categories - Bottom Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {categories?.slice(2).map((category, index) => (
                <Link 
                  key={category.id} 
                  to={`/products?category=${category.id}`}
                  className={cn(
                    "group rounded-lg shadow-sm p-5 transition-all duration-300 hover:shadow-md",
                    CATEGORY_COLORS[index % CATEGORY_COLORS.length]
                  )}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-white p-1">
                      <img
                        src={category.image_url || '/placeholder.svg'}
                        alt={category.name}
                        className="w-full h-full object-cover rounded-full"
                      />
                    </div>
                    <ExternalLink size={16} className="text-gray-400 group-hover:text-primary transition-colors" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-primary transition-colors">
                    {category.name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {category.description || `Explore our ${category.name.toLowerCase()} collection`}
                  </p>
                </Link>
              ))}
            </div>
            
            {/* View All Categories Link */}
            <div className="mt-10 text-center">
              <Link 
                to="/categories" 
                className="inline-flex items-center text-primary hover:text-primary/80 font-medium"
              >
                View All Categories
                <ChevronRight size={16} className="ml-1" />
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default FeaturedCategories;
