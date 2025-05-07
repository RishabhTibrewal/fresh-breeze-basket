import React from 'react';
import { Link } from 'react-router-dom';
import type { ProductCategory } from '@/types/product';

interface CategoryCardProps {
  category: ProductCategory;
}

export function CategoryCard({ category }: CategoryCardProps) {
  return (
    <Link 
      to={`/products?category=${category.id}`}
      className="group block h-full"
    >
      <div className="bg-white rounded-lg shadow-md overflow-hidden transition-transform hover:shadow-lg group-hover:-translate-y-1 flex flex-col h-full">
        <div className="relative h-64 overflow-hidden">
          <img
            src={category.image_url || '/placeholder.svg'}
            alt={category.name}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        </div>
        <div className="p-6 flex flex-col flex-grow">
          <h2 className="text-xl font-semibold text-gray-800 group-hover:text-primary transition-colors">
            {category.name}
          </h2>
          <p className="mt-2 text-gray-600 line-clamp-2">
            {category.description || `Browse our selection of ${category.name.toLowerCase()}`}
          </p>
        </div>
      </div>
    </Link>
  );
} 