import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Facebook, Instagram, Twitter } from 'lucide-react';
import { categoriesService } from '@/api/categories';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const [categories, setCategories] = useState([]);

  // Fetch categories when component mounts
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const categoriesData = await categoriesService.getAll();
        setCategories(categoriesData);
      } catch (error) {
        console.error('Failed to load categories:', error);
      }
    };
    
    fetchCategories();
  }, []);

  // Find category IDs by name (case insensitive)
  const findCategoryId = (name) => {
    const category = categories.find(c => 
      c.name.toLowerCase() === name.toLowerCase()
    );
    return category ? category.id : null;
  };

  // Get category IDs
  const fruitsId = findCategoryId('fruits');
  const vegetablesId = findCategoryId('vegetables');
  const organicId = findCategoryId('organic');

  return (
    <footer className="bg-secondary text-white pt-8 sm:pt-12 lg:pt-16 pb-6 sm:pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-6 sm:gap-8">
          {/* Company Info */}
          <div className="col-span-2 sm:col-span-2 md:col-span-1">
            <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">
              <span className="font-playfair">Fresh</span>
              <span className="text-primary-light">Basket</span>
            </h3>
            <p className="mb-3 sm:mb-4 text-sm sm:text-base text-gray-200">
              Dubai's premier destination for farm-fresh produce delivered straight to your door.
            </p>
            <div className="flex space-x-3 sm:space-x-4">
              <a href="https://facebook.com" className="hover:text-primary-light transition-colors" aria-label="Facebook">
                <Facebook size={18} className="sm:w-5 sm:h-5" />
              </a>
              <a href="https://instagram.com" className="hover:text-primary-light transition-colors" aria-label="Instagram">
                <Instagram size={18} className="sm:w-5 sm:h-5" />
              </a>
              <a href="https://twitter.com" className="hover:text-primary-light transition-colors" aria-label="Twitter">
                <Twitter size={18} className="sm:w-5 sm:h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-base sm:text-lg font-bold mb-2 sm:mb-4">Quick Links</h3>
            <ul className="space-y-1 sm:space-y-2">
              <li><Link to="/products" className="text-xs sm:text-sm hover:text-primary-light transition-colors">Shop All</Link></li>
              
              {fruitsId ? (
                <li><Link to={`/products?category=${fruitsId}`} className="text-xs sm:text-sm hover:text-primary-light transition-colors">Fruits</Link></li>
              ) : (
                <li><Link to="/products?category=fruits" className="text-xs sm:text-sm hover:text-primary-light transition-colors">Fruits</Link></li>
              )}
              
              {vegetablesId ? (
                <li><Link to={`/products?category=${vegetablesId}`} className="text-xs sm:text-sm hover:text-primary-light transition-colors">Vegetables</Link></li>
              ) : (
                <li><Link to="/products?category=vegetables" className="text-xs sm:text-sm hover:text-primary-light transition-colors">Vegetables</Link></li>
              )}
              
              {organicId ? (
                <li><Link to={`/products?category=${organicId}`} className="text-xs sm:text-sm hover:text-primary-light transition-colors">Organic</Link></li>
              ) : (
                <li><Link to="/products?category=organic" className="text-xs sm:text-sm hover:text-primary-light transition-colors">Organic</Link></li>
              )}
              
              <li><Link to="/products?discount=true" className="text-xs sm:text-sm hover:text-primary-light transition-colors">Sale Items</Link></li>
              <li><Link to="/about" className="text-xs sm:text-sm hover:text-primary-light transition-colors">About Us</Link></li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h3 className="text-base sm:text-lg font-bold mb-2 sm:mb-4">Customer Service</h3>
            <ul className="space-y-1 sm:space-y-2">
              <li><Link to="/account" className="text-xs sm:text-sm hover:text-primary-light transition-colors">My Account</Link></li>
              <li><Link to="/faq" className="text-xs sm:text-sm hover:text-primary-light transition-colors">FAQ</Link></li>
              <li><Link to="/shipping" className="text-xs sm:text-sm hover:text-primary-light transition-colors">Shipping & Delivery</Link></li>
              <li><Link to="/returns" className="text-xs sm:text-sm hover:text-primary-light transition-colors">Returns & Refunds</Link></li>
              <li><Link to="/contact" className="text-xs sm:text-sm hover:text-primary-light transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          {/* Contact Information */}
          <div className="col-span-2 sm:col-span-2 md:col-span-1">
            <h3 className="text-base sm:text-lg font-bold mb-2 sm:mb-4">Contact Us</h3>
            <ul className="space-y-2 sm:space-y-3">
              <li className="flex items-start">
                <MapPin className="mr-2 h-4 sm:h-5 w-4 sm:w-5 text-primary-light flex-shrink-0 mt-0.5" />
                <span className="text-xs sm:text-sm">Sheikh Zayed Road, Dubai, UAE</span>
              </li>
              <li className="flex items-center">
                <Phone className="mr-2 h-4 sm:h-5 w-4 sm:w-5 text-primary-light flex-shrink-0" />
                <span className="text-xs sm:text-sm">+971 4 123 4567</span>
              </li>
              <li className="flex items-center">
                <Mail className="mr-2 h-4 sm:h-5 w-4 sm:w-5 text-primary-light flex-shrink-0" />
                <span className="text-xs sm:text-sm">info@freshbasket.ae</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Newsletter */}
        <div className="border-t border-gray-600 mt-8 sm:mt-10 lg:mt-12 pt-6 sm:pt-8 mb-6 sm:mb-8">
          <div className="max-w-md mx-auto text-center">
            <h3 className="text-base sm:text-lg font-bold mb-2">Subscribe to our Newsletter</h3>
            <p className="text-xs sm:text-sm text-gray-300 mb-3 sm:mb-4">Get the latest updates on fresh arrivals and special offers</p>
            <div className="flex">
              <input 
                type="email" 
                placeholder="Your email address" 
                className="flex-grow px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-l-lg focus:outline-none text-gray-800"
              />
              <button className="bg-primary-light px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-r-lg hover:bg-opacity-90 transition-colors">
                Subscribe
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-600 mt-6 sm:mt-8 pt-4 sm:pt-6 text-center text-xs sm:text-sm text-gray-300">
          <p>© {currentYear} FreshBasket. All rights reserved.</p>
          <div className="mt-1 sm:mt-2 space-x-3 sm:space-x-4">
            <Link to="/privacy" className="text-xs sm:text-sm hover:text-primary-light transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="text-xs sm:text-sm hover:text-primary-light transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 