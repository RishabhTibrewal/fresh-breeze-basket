import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ProductCard from '@/components/products/ProductCard';
import { productsService } from '@/api/products';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorMessage } from '@/components/ui/error-message';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SpecialsCarouselProps {
  limit?: number;
}

const CARD_WIDTH = 280; // px, adjust as needed
const VISIBLE_CARDS = 4;

const SpecialsCarousel: React.FC<SpecialsCarouselProps> = ({ limit = 8 }) => {
  const { data: products, isLoading, error } = useQuery({
    queryKey: ['products', 'specials'],
    queryFn: async () => {
      const allProducts = await productsService.getAll();
      return allProducts.filter(product => product.sale_price !== null);
    }
  });

  const displayProducts = products && limit ? products.slice(0, limit) : products;
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = CARD_WIDTH * VISIBLE_CARDS;
      scrollRef.current.scrollBy({
        left: dir === 'left' ? -amount : amount,
        behavior: 'smooth',
      });
    }
  };

  if (isLoading) {
    return (
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <h2 className="section-title mb-0">
              <span className="text-accent-sale">Special Offers</span>
            </h2>
            <Link to="/products?sale=true" className="text-primary font-medium hover:underline">
              View All Specials
            </Link>
          </div>
          <div className="relative">
            <div className="flex space-x-4 overflow-x-auto scrollbar-hide">
              {Array(VISIBLE_CARDS).fill(0).map((_, index) => (
                <div key={index} className="flex flex-col space-y-2 min-w-[280px]">
                  <Skeleton className="h-48 w-full rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <ErrorMessage
            title="Error"
            message="Failed to load special offers"
          />
        </div>
      </section>
    );
  }

  if (!displayProducts || displayProducts.length === 0) {
    return null;
  }

  const showArrows = displayProducts.length > VISIBLE_CARDS;

  return (
    <section className="py-12 md:py-16">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h2 className="section-title mb-0">
            <span className="text-accent-sale">Special Offers</span>
          </h2>
          <Link to="/products?sale=true" className="text-primary font-medium hover:underline">
            View All Specials
          </Link>
        </div>
        <div className="relative">
          {showArrows && (
            <button
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full shadow p-2 hover:bg-gray-100"
              onClick={() => scroll('left')}
              aria-label="Scroll left"
              style={{ display: 'block' }}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <div
            ref={scrollRef}
            className="flex space-x-4 overflow-x-auto scrollbar-hide px-8"
            style={{ scrollBehavior: 'smooth' }}
          >
            {displayProducts.map((product) => (
              <div key={product.id} className="min-w-[280px]">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
          {showArrows && (
            <button
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full shadow p-2 hover:bg-gray-100"
              onClick={() => scroll('right')}
              aria-label="Scroll right"
              style={{ display: 'block' }}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default SpecialsCarousel;
