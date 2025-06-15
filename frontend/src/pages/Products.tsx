import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Filter, SlidersHorizontal, Search, X } from 'lucide-react';
import { productsService } from '@/api/products';
import { categoriesService } from '@/api/categories';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductCard from '@/components/products/ProductCard';
import ProductFilters, { FilterCategory } from '@/components/products/ProductFilters';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [showDiscountedOnly, setShowDiscountedOnly] = useState(false);
  
  // Get parameters from URL if present
  const categoryFromUrl = searchParams.get('category');
  const urlSearchQuery = searchParams.get('search');
  const discountParam = searchParams.get('discount');

  // Fetch categories for filter
  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesService.getAll,
  });

  // Set initial values from URL params
  useEffect(() => {
    if (categoryFromUrl && categories) {
      const categoryById = categories.find(c => c.id === categoryFromUrl);
      const categoryByName = categories.find(c => 
        c.name.toLowerCase() === categoryFromUrl.toLowerCase() || 
        (c.slug && c.slug.toLowerCase() === categoryFromUrl.toLowerCase())
      );
      
      let categoryToSet: string | null = null;
      if (categoryById) {
        categoryToSet = categoryById.id;
      } else if (categoryByName) {
        categoryToSet = categoryByName.id;
      }

      if (categoryToSet && !selectedCategories.includes(categoryToSet)) {
        setSelectedCategories([categoryToSet]); // Set to an array with the single category
      } else if (!categoryToSet && selectedCategories.length > 0) {
        // This case might occur if categoryFromUrl is invalid but categories were previously set
        setSelectedCategories([]);
      }
    } else if (!categoryFromUrl) {
      // If no categoryFromUrl, clear selected categories
      setSelectedCategories([]);
    }
    
    if (urlSearchQuery) {
      setSearchQuery(urlSearchQuery);
    } else {
      // Optionally clear search query if not in URL
      // setSearchQuery(''); 
    }
    
    if (discountParam === 'true') {
      setShowDiscountedOnly(true);
    } else {
      // Optionally clear discount if not in URL
      // setShowDiscountedOnly(false);
    }
  }, [categoryFromUrl, urlSearchQuery, discountParam, categories]); // Removed selectedCategories from dependencies

  // Fetch products
  const { data: products, isLoading: isLoadingProducts, error: productsError } = useQuery({
    queryKey: ['products'],
    queryFn: productsService.getAll,
  });

  // Set max price based on the highest product price
  useEffect(() => {
    if (products && products.length > 0) {
      const highestPrice = Math.ceil(
        Math.max(...products.map(p => p.price))
      );
      setMaxPrice(highestPrice);
      setPriceRange([0, highestPrice]);
    }
  }, [products]);

  // Transform categories for the filter component
  const filterCategories: FilterCategory[] = React.useMemo(() => {
    if (!categories || !products) return [];
    
    return categories.map(category => ({
      id: category.id,
      name: category.name,
      count: products.filter(product => product.category_id === category.id).length
    }));
  }, [categories, products]);

  // Filter products based on selected criteria
  const filteredProducts = React.useMemo(() => {
    if (!products) return [];
    
    return products.filter(product => {
      const matchesCategory = selectedCategories.length === 0 || 
        selectedCategories.includes(product.category_id);
      
      const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];
      
      const matchesSearch = !searchQuery || 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()));
        
      const matchesDiscount = !showDiscountedOnly || 
        (product.sale_price && product.sale_price < product.price);

      return matchesCategory && matchesPrice && matchesSearch && matchesDiscount;
    });
  }, [products, selectedCategories, priceRange, searchQuery, showDiscountedOnly]);

  // Sort products
  const sortedProducts = React.useMemo(() => {
    return [...(filteredProducts || [])].sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return (a.sale_price || a.price) - (b.sale_price || b.price);
        case 'price-high':
          return (b.sale_price || b.price) - (a.sale_price || a.price);
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'featured':
          return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [filteredProducts, sortBy]);

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      }
      return [...prev, categoryId];
    });
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
  };

  const handlePriceRangeChange = (value: number[]) => {
    setPriceRange([value[0], value[1]]);
  };
  
  const handleDiscountToggle = () => {
    setShowDiscountedOnly(prev => !prev);
  };

  const handleResetFilters = () => {
    setSelectedCategories([]);
    setPriceRange([0, maxPrice]);
    setSearchQuery('');
    setShowDiscountedOnly(false);
  };

  const handleApplyFilters = () => {
    // Update URL with filters
    const params = new URLSearchParams();
    
    if (selectedCategories.length > 0) {
      selectedCategories.forEach(cat => {
        params.append('category', cat);
      });
    }
    
    if (searchQuery) {
      params.set('search', searchQuery);
    }
    
    if (sortBy !== 'newest') {
      params.set('sort', sortBy);
    }
    
    if (showDiscountedOnly) {
      params.set('discount', 'true');
    }
    
    setSearchParams(params);
    setShowMobileFilters(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    handleApplyFilters();
  };
  
  const handleClearSearch = () => {
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Fresh Products</h1>
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedCategories.length > 0 && categories && (
                selectedCategories.map(id => {
                  const category = categories.find(c => c.id === id);
                  return category ? (
                    <Badge key={id} variant="secondary" className="py-1 px-3">
                      {category.name}
                      <button 
                        onClick={() => handleCategoryChange(id)}
                        className="ml-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ) : null;
                })
              )}
              {showDiscountedOnly && (
                <Badge variant="secondary" className="py-1 px-3 bg-primary text-white">
                  Sale Items
                  <button 
                    onClick={handleDiscountToggle}
                    className="ml-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {(selectedCategories.length > 0 || showDiscountedOnly) && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleResetFilters}
                  className="text-sm h-7"
                >
                  Clear filters
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-6">
            {/* Desktop Filters */}
            <div className="hidden md:block w-64 flex-shrink-0">
              {!isLoadingCategories && filterCategories.length > 0 && (
                <ProductFilters
                  categories={filterCategories}
                  selectedCategories={selectedCategories}
                  onCategoryChange={handleCategoryChange}
                  priceRange={priceRange}
                  onPriceRangeChange={handlePriceRangeChange}
                  maxPrice={maxPrice}
                  onReset={handleResetFilters}
                  onApply={handleApplyFilters}
                  showDiscountedOnly={showDiscountedOnly}
                  onDiscountToggle={handleDiscountToggle}
                />
              )}
            </div>
          
            {/* Products Grid */}
            <div className="flex-1">
              <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <form 
                    onSubmit={handleSearch}
                    className="relative flex-1"
                  >
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-10"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    <button type="submit" className="sr-only">Search</button>
                  </form>
                  
                  <div className="flex gap-3">
                    <Select value={sortBy} onValueChange={handleSortChange}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest First</SelectItem>
                        <SelectItem value="price-low">Price: Low to High</SelectItem>
                        <SelectItem value="price-high">Price: High to Low</SelectItem>
                        <SelectItem value="name-asc">Name: A to Z</SelectItem>
                        <SelectItem value="name-desc">Name: Z to A</SelectItem>
                        <SelectItem value="featured">Featured</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Mobile Filters Button */}
                    <Sheet open={showMobileFilters} onOpenChange={setShowMobileFilters}>
                      <SheetTrigger asChild>
                        <Button variant="outline" className="md:hidden">
                          <Filter className="h-4 w-4 mr-2" />
                          Filters
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="left" className="w-full sm:max-w-md pt-6 md:hidden">
                        <SheetHeader>
                          <SheetTitle>Filters</SheetTitle>
                        </SheetHeader>
                        
                        {!isLoadingCategories && filterCategories.length > 0 && (
                          <div className="mt-6 flex-1 overflow-auto">
                            <ProductFilters
                              categories={filterCategories}
                              selectedCategories={selectedCategories}
                              onCategoryChange={handleCategoryChange}
                              priceRange={priceRange}
                              onPriceRangeChange={handlePriceRangeChange}
                              maxPrice={maxPrice}
                              onReset={handleResetFilters}
                              onApply={handleApplyFilters}
                              showDiscountedOnly={showDiscountedOnly}
                              onDiscountToggle={handleDiscountToggle}
                              className="border-none shadow-none p-0"
                            />
                          </div>
                        )}
                        
                        <SheetFooter className="mt-6">
                          <Button onClick={handleApplyFilters} className="w-full">
                            Apply Filters
                          </Button>
                        </SheetFooter>
                      </SheetContent>
                    </Sheet>
                  </div>
                </div>
              </div>

              {isLoadingProducts || isLoadingCategories ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                  {[...Array(6)].map((_, index) => (
                    <Skeleton key={index} className="h-[400px] rounded-lg" />
                  ))}
                </div>
              ) : productsError ? (
                <ErrorMessage 
                  title="Failed to load products" 
                  message="Please try refreshing the page or contact support if the problem persists." 
                />
              ) : sortedProducts.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                  <SlidersHorizontal className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">No products found</h2>
                  <p className="text-gray-500 mb-4">
                    Try adjusting your filters or search criteria
                  </p>
                  <Button onClick={handleResetFilters} variant="outline">
                    Reset Filters
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500 mb-4">
                    Showing {sortedProducts.length} products
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                    {sortedProducts.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
