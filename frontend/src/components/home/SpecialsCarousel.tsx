
import React from 'react';
import { Link } from 'react-router-dom';
import { getOnSaleProducts } from '@/data/productData';
import ProductCard from '@/components/products/ProductCard';

const SpecialsCarousel = () => {
  const onSaleProducts = getOnSaleProducts();

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
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {onSaleProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default SpecialsCarousel;
