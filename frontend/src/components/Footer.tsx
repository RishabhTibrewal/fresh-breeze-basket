
import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Facebook, Instagram, Twitter } from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-secondary text-white pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <h3 className="text-xl font-bold mb-4">
              <span className="font-playfair">Fresh</span>
              <span className="text-primary-light">Basket</span>
            </h3>
            <p className="mb-4 text-gray-200">
              Dubai's premier destination for farm-fresh produce delivered straight to your door.
            </p>
            <div className="flex space-x-4">
              <a href="https://facebook.com" className="hover:text-primary-light transition-colors">
                <Facebook size={20} />
              </a>
              <a href="https://instagram.com" className="hover:text-primary-light transition-colors">
                <Instagram size={20} />
              </a>
              <a href="https://twitter.com" className="hover:text-primary-light transition-colors">
                <Twitter size={20} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-bold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><Link to="/products" className="hover:text-primary-light transition-colors">Shop All</Link></li>
              <li><Link to="/categories/fruits" className="hover:text-primary-light transition-colors">Fruits</Link></li>
              <li><Link to="/categories/vegetables" className="hover:text-primary-light transition-colors">Vegetables</Link></li>
              <li><Link to="/categories/organic" className="hover:text-primary-light transition-colors">Organic</Link></li>
              <li><Link to="/about" className="hover:text-primary-light transition-colors">About Us</Link></li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h3 className="text-lg font-bold mb-4">Customer Service</h3>
            <ul className="space-y-2">
              <li><Link to="/account" className="hover:text-primary-light transition-colors">My Account</Link></li>
              <li><Link to="/faq" className="hover:text-primary-light transition-colors">FAQ</Link></li>
              <li><Link to="/shipping" className="hover:text-primary-light transition-colors">Shipping & Delivery</Link></li>
              <li><Link to="/returns" className="hover:text-primary-light transition-colors">Returns & Refunds</Link></li>
              <li><Link to="/contact" className="hover:text-primary-light transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-bold mb-4">Contact Us</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <MapPin className="mr-2 h-5 w-5 text-primary-light flex-shrink-0 mt-0.5" />
                <span>Sheikh Zayed Road, Dubai, UAE</span>
              </li>
              <li className="flex items-center">
                <Phone className="mr-2 h-5 w-5 text-primary-light flex-shrink-0" />
                <span>+971 4 123 4567</span>
              </li>
              <li className="flex items-center">
                <Mail className="mr-2 h-5 w-5 text-primary-light flex-shrink-0" />
                <span>info@freshbasket.ae</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Newsletter */}
        <div className="border-t border-gray-600 mt-12 pt-8 mb-8">
          <div className="max-w-md mx-auto text-center">
            <h3 className="text-lg font-bold mb-2">Subscribe to our Newsletter</h3>
            <p className="text-gray-300 mb-4">Get the latest updates on fresh arrivals and special offers</p>
            <div className="flex">
              <input 
                type="email" 
                placeholder="Your email address" 
                className="flex-grow px-4 py-2 rounded-l-lg focus:outline-none text-gray-800"
              />
              <button className="bg-primary-light px-4 py-2 rounded-r-lg hover:bg-opacity-90 transition-colors">
                Subscribe
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-600 mt-8 pt-6 text-center text-sm text-gray-300">
          <p>© {currentYear} FreshBasket. All rights reserved.</p>
          <div className="mt-2 space-x-4">
            <Link to="/privacy" className="hover:text-primary-light transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-primary-light transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
