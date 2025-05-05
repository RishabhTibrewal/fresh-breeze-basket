
import React from 'react';
import { Link } from 'react-router-dom';

const Hero = () => {
  return (
    <div className="bg-gradient-to-r from-green-50 to-green-100 py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="text-center md:text-left animate-fade-in">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 text-gray-800">
              <span className="text-primary">Farm Fresh Produce</span><br />
              <span className="font-playfair">Delivered to Your Door</span>
            </h1>
            <p className="text-lg md:text-xl mb-8 text-gray-600">
              Dubai's Premier Selection of Local and International Fruits & Vegetables
            </p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 justify-center md:justify-start">
              <Link to="/products" className="btn-primary">
                Shop Fresh Today
              </Link>
              <Link to="/products" className="btn-secondary">
                View Today's Deals
              </Link>
            </div>
          </div>
          <div className="rounded-lg overflow-hidden shadow-xl">
            <img 
              src="https://images.unsplash.com/photo-1610348725531-843dff563e2c?q=80&w=1200&auto=format" 
              alt="Fresh produce arrangement" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
