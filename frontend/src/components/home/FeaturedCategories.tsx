import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchCategories } from '@/api/categories';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorMessage } from '@/components/ui/error-message';
import { ArrowRight, Leaf } from 'lucide-react';

// Fallback image & description mapping for gofreshco categories
const CATEGORY_META: Record<string, { desc: string; img: string }> = {
  rice: {
    desc: 'Premium quality rice for every meal.',
    img: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
  },
  'fruits & vegetables': {
    desc: 'Fresh, seasonal and farm-picked.',
    img: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=600&q=80',
  },
  pulses: {
    desc: 'Protein-rich goodness for a balanced diet.',
    img: 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?auto=format&fit=crop&w=600&q=80',
  },
  spices: {
    desc: 'Authentic taste, natural goodness.',
    img: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80',
  },
  'superseeds & millets': {
    desc: 'Small seeds. Big nutrition.',
    img: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=600&q=80',
  },
};

const DEFAULT_DESC = 'Pure, fresh, and handpicked for your daily health.';
const DEFAULT_IMG = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';

const FeaturedCategories = () => {
  const { data: categories, isLoading, error } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  return (
    <section className="py-16 md:py-20 bg-[#c9d064]/20 border-b border-green-200/40 relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 text-[#276B3C] font-semibold text-sm mb-2 bg-white/60 px-3 py-1 rounded-full border border-green-200/60 shadow-sm">
            <Leaf className="w-4 h-4 fill-[#276B3C]" />
            <span>Categories</span>
            <Leaf className="w-4 h-4 fill-[#276B3C] transform rotate-90" />
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1E502B] font-serif mb-4">
            Explore Our Fresh & Healthy Range
          </h2>
          <p className="text-gray-700 text-base sm:text-lg font-medium">
            From wholesome staples to superfoods, find everything you need for a healthier lifestyle.
          </p>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="bg-white p-5 rounded-2xl border border-gray-100 flex flex-col items-center">
                <Skeleton className="w-36 h-36 rounded-full mb-4" />
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-5/6 mb-4" />
                <Skeleton className="w-10 h-10 rounded-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorMessage 
            title="Failed to load categories" 
            message="We couldn't load the product categories. Please try refreshing the page." 
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {categories?.slice(0, 5).map((category) => {
              const key = category.name.toLowerCase();
              const meta = CATEGORY_META[key] || { desc: DEFAULT_DESC, img: category.image_url || DEFAULT_IMG };

              return (
                <Link 
                  key={category.id}
                  to={`/products?category=${category.id}`}
                  className="group bg-[#e0e6d6] hover:bg-[#d5dccb] rounded-2xl p-5 border border-green-200/60 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col items-center text-center transform hover:-translate-y-1"
                >
                  {/* Category Image Circle */}
                  <div className="w-36 h-36 rounded-full overflow-hidden mb-4 border-4 border-white group-hover:border-[#276B3C] transition-colors shadow-md">
                    <img
                      src={category.image_url || meta.img}
                      alt={category.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>

                  {/* Category Name */}
                  <h3 className="text-lg font-extrabold text-[#1E502B] group-hover:text-[#276B3C] transition-colors mb-1.5">
                    {category.name}
                  </h3>

                  {/* Description */}
                  <p className="text-xs text-gray-700 font-medium mb-5 line-clamp-2 px-1 leading-relaxed">
                    {meta.desc}
                  </p>

                  {/* Circular Arrow CTA */}
                  <div className="mt-auto">
                    <div className="w-9 h-9 rounded-full bg-[#276B3C] text-white flex items-center justify-center group-hover:bg-[#1E502B] group-hover:scale-110 transition-all shadow-md">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
};

export default FeaturedCategories;

