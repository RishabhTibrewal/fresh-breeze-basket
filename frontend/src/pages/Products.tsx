
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, SlidersHorizontal } from 'lucide-react';
import { products, categories } from '@/data/productData';
import ProductCard from '@/components/products/ProductCard';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const Products = () => {
  const [searchParams] = useSearchParams();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.get('category') || '');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 200 });
  const [origins, setOrigins] = useState<string[]>([]);

  const categoryFromUrl = searchParams.get('category');
  const saleOnly = searchParams.get('sale') === 'true';

  // Filter products based on selections
  const filteredProducts = products.filter(product => {
    // Category filter
    if (selectedCategory && product.categoryId !== selectedCategory) {
      return false;
    }
    
    // Sale items filter
    if (saleOnly && !product.salePrice) {
      return false;
    }
    
    // Price range filter
    const price = product.salePrice || product.price;
    if (price < priceRange.min || price > priceRange.max) {
      return false;
    }
    
    // Origin filter
    if (origins.length > 0 && !origins.includes(product.origin)) {
      return false;
    }
    
    return true;
  });

  // Get unique origins for filter
  const uniqueOrigins = [...new Set(products.map(product => product.origin))];

  // Toggle filter sidebar on mobile
  const toggleFilter = () => {
    setIsFilterOpen(!isFilterOpen);
  };

  // Handle category selection
  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId === selectedCategory ? '' : categoryId);
  };

  // Handle origin selection
  const handleOriginChange = (origin: string) => {
    setOrigins(prev => 
      prev.includes(origin) 
        ? prev.filter(o => o !== origin)
        : [...prev, origin]
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <div className="bg-primary text-white py-8">
          <div className="container mx-auto px-4">
            <h1 className="text-3xl md:text-4xl font-bold">All Fresh Produce</h1>
            <p className="mt-2">Farm-fresh fruits and vegetables delivered to your door</p>
          </div>
        </div>
        
        <div className="container mx-auto px-4 py-8">
          <div className="lg:hidden mb-4 flex justify-end">
            <button 
              onClick={toggleFilter}
              className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-md transition-colors"
            >
              <Filter className="h-5 w-5" />
              <span>Filters</span>
            </button>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Filters Sidebar */}
            <div className={`lg:w-1/4 ${isFilterOpen ? 'block' : 'hidden'} lg:block bg-white p-6 rounded-lg shadow-md h-fit sticky top-24`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Filters</h2>
                <button 
                  onClick={toggleFilter}
                  className="lg:hidden text-gray-500"
                >
                  <SlidersHorizontal className="h-5 w-5" />
                </button>
              </div>
              
              {/* Category Filter */}
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">Categories</h3>
                <div className="space-y-2">
                  {categories.map(category => (
                    <div key={category.id} className="flex items-center">
                      <input 
                        type="checkbox" 
                        id={`category-${category.id}`} 
                        checked={selectedCategory === category.id}
                        onChange={() => handleCategoryChange(category.id)}
                        className="mr-2"
                      />
                      <label htmlFor={`category-${category.id}`} className="text-gray-700">
                        {category.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Price Range Filter */}
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">Price Range</h3>
                <div className="px-2">
                  <div className="flex items-center justify-between mb-2">
                    <span>AED {priceRange.min}</span>
                    <span>AED {priceRange.max}</span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="200"
                    value={priceRange.max}
                    onChange={(e) => setPriceRange(prev => ({ ...prev, max: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                </div>
              </div>
              
              {/* Origin Filter */}
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">Origin</h3>
                <div className="space-y-2">
                  {uniqueOrigins.map(origin => (
                    <div key={origin} className="flex items-center">
                      <input 
                        type="checkbox" 
                        id={`origin-${origin}`} 
                        checked={origins.includes(origin)}
                        onChange={() => handleOriginChange(origin)}
                        className="mr-2"
                      />
                      <label htmlFor={`origin-${origin}`} className="text-gray-700">
                        {origin}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Special Filters */}
              <div>
                <h3 className="text-lg font-medium mb-3">Special</h3>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input 
                      type="checkbox" 
                      id="on-sale" 
                      checked={saleOnly}
                      onChange={() => {/* Update URL instead */}}
                      className="mr-2"
                    />
                    <label htmlFor="on-sale" className="text-gray-700">On Sale</label>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Products Grid */}
            <div className="lg:w-3/4">
              {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 p-10 rounded-lg text-center">
                  <h3 className="text-xl font-semibold mb-2">No products found</h3>
                  <p className="text-gray-600 mb-4">Try adjusting your filters to find what you're looking for.</p>
                  <button 
                    onClick={() => {
                      setSelectedCategory('');
                      setPriceRange({ min: 0, max: 200 });
                      setOrigins([]);
                    }}
                    className="inline-block bg-primary text-white py-2 px-4 rounded-md hover:bg-opacity-90 transition-colors"
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Products;
