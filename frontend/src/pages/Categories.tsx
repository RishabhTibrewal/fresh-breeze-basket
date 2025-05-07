import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorMessage } from '@/components/ui/error-message';
import { CategoryCard } from '@/components/CategoryCard';
import { fetchCategories } from '@/api/categories';
import type { ProductCategory } from '@/types/product';

export default function Categories() {
  const { data: categories, isLoading, error } = useQuery<ProductCategory[]>({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Fresh Categories
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Explore our wide selection of fresh, high-quality produce categories.
            From seasonal fruits to organic vegetables, we have everything you need.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8" role="status" aria-label="Loading categories">
            {[...Array(8)].map((_, index) => (
              <Skeleton key={index} className="h-64 rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <ErrorMessage 
            title="Failed to load categories" 
            message="Please try refreshing the page or contact support if the problem persists." 
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
            {categories?.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
