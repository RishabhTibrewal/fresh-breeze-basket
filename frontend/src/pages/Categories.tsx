
import React from 'react';
import { Link } from 'react-router-dom';
import { categories } from '@/data/productData';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const Categories = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <div className="bg-primary text-white py-8">
          <div className="container mx-auto px-4">
            <h1 className="text-3xl md:text-4xl font-bold">Product Categories</h1>
            <p className="mt-2">Browse our selection of fresh produce by category</p>
          </div>
        </div>
        
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {categories.map((category) => (
              <Link 
                key={category.id}
                to={`/products?category=${category.id}`}
                className="group"
              >
                <div className="bg-white rounded-lg shadow-md overflow-hidden transition-transform hover:shadow-lg group-hover:-translate-y-1">
                  <div className="h-48 overflow-hidden">
                    <img
                      src={category.image || '/placeholder.svg'}
                      alt={category.name}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                  <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-800 group-hover:text-primary transition-colors">
                      {category.name}
                    </h2>
                    <p className="mt-2 text-gray-600">
                      {`Browse our selection of ${category.name.toLowerCase()}`}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Categories;
