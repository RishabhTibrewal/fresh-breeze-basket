
import React from 'react';
import { Link } from 'react-router-dom';
import { categories } from '@/data/productData';

const FeaturedCategories = () => {
  return (
    <section className="py-12 md:py-16">
      <div className="container mx-auto px-4">
        <h2 className="section-title text-center">Shop by Category</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mt-8">
          {categories.map((category) => (
            <Link 
              to={`/categories/${category.slug}`} 
              key={category.id}
              className="group relative overflow-hidden rounded-lg shadow-md transition-all hover:shadow-lg h-56 md:h-64"
            >
              <img 
                src={category.image} 
                alt={category.name} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end">
                <h3 className="text-white text-xl font-semibold p-4 w-full text-center">
                  {category.name}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedCategories;
