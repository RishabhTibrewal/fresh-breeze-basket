import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchCategories } from '@/api/categories';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorMessage } from '@/components/ui/error-message';
import { ChevronRight } from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

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
  
  const carouselApi = useRef<{ scrollNext: () => void } | null>(null);

  // Auto-slide carousel every 3 seconds
  useEffect(() => {
    if (!carouselApi.current) return;
    
    const interval = setInterval(() => {
      if (carouselApi.current) {
        carouselApi.current.scrollNext();
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [carouselApi]);

  return (
    <section className="py-16 pb-8 md:py-20 md:pb-10 bg-gray-50 overflow-hidden">
      <div className="container mx-auto">
        <div className="text-center mb-14 px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Shop by Category</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Explore our selection of fresh, premium quality products sorted by category to make your shopping experience easier.
          </p>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center gap-6 px-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="flex flex-col items-center">
                <Skeleton className="h-44 w-44 md:h-56 md:w-56 lg:h-64 lg:w-64 rounded-full mb-5" />
                <Skeleton className="h-6 w-28 rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="px-4">
            <ErrorMessage 
              title="Failed to load categories" 
              message="We couldn't load the product categories. Please try refreshing the page." 
            />
          </div>
        ) : (
          <>
            {/* Categories Carousel */}
            <div className="relative px-4">
              <Carousel 
                opts={{
                  align: "start",
                  loop: true,
                  slidesToScroll: 4,
                  containScroll: "trimSnaps"
                }}
                setApi={(api) => {
                  carouselApi.current = api;
                }}
                className="w-full"
              >
                <CarouselContent>
                  {categories?.map((category, index) => (
                    <CarouselItem key={category.id} className="basis-full sm:basis-1/2 md:basis-1/4 lg:basis-1/4">
                      <Link 
                        to={`/products?category=${category.id}`}
                        className="flex flex-col items-center group"
                      >
                        <div className={`w-44 h-44 sm:w-52 sm:h-52 md:w-56 md:h-56 lg:w-64 lg:h-64 rounded-full overflow-hidden flex items-center justify-center mx-auto mb-5 transition-transform duration-300 group-hover:scale-105 shadow-sm ${CATEGORY_COLORS[index % CATEGORY_COLORS.length]}`}>
                          <div className="w-40 h-40 sm:w-48 sm:h-48 md:w-52 md:h-52 lg:w-60 lg:h-60 rounded-full overflow-hidden border-4 border-white">
                            <img
                              src={category.image_url || '/placeholder.svg'}
                              alt={category.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </div>
                        <h3 className="text-center text-xl font-medium text-gray-800 group-hover:text-primary transition-colors">
                          {category.name}
                        </h3>
                      </Link>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="-left-3 md:left-2" />
                <CarouselNext className="-right-3 md:right-2" />
              </Carousel>
            </div>
            
            {/* View All Categories Link */}
            <div className="mt-10 text-center">
              <Link 
                to="/categories" 
                className="inline-flex items-center text-lg text-primary hover:text-primary/80 font-medium"
              >
                View All Categories
                <ChevronRight size={18} className="ml-1" />
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default FeaturedCategories;
