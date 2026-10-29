import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Filter, 
  SlidersHorizontal, 
  Search, 
  X, 
  Leaf, 
  ChevronRight, 
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  FlaskConical,
  HeartHandshake,
  TreePine,
  CheckCircle2
} from 'lucide-react';
import { Product, productsService } from '@/api/products';
import { categoriesService } from '@/api/categories';
import { useCompanyCurrency } from '@/hooks/useCompanyCurrency';
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
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';



export default function Products() {
  const { formatCurrency } = useCompanyCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [showDiscountedOnly, setShowDiscountedOnly] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  
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
        setSelectedCategories([categoryToSet]);
      } else if (!categoryToSet && selectedCategories.length > 0) {
        setSelectedCategories([]);
      }
    } else if (!categoryFromUrl) {
      setSelectedCategories([]);
    }
    
    if (urlSearchQuery) {
      setSearchQuery(urlSearchQuery);
    }
    
    if (discountParam === 'true') {
      setShowDiscountedOnly(true);
    }
  }, [categoryFromUrl, urlSearchQuery, discountParam, categories]);

  // Fetch products
  const { data: products, isLoading: isLoadingProducts, error: productsError } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => productsService.getAll(),
  });

  // Set max price based on the highest variant price
  useEffect(() => {
    if (products && products.length > 0) {
      const allVariantPrices = products.flatMap(p => 
        (p.variants || [])
          .filter(v => v.is_active)
          .map(v => v.price?.mrp_price || v.price?.sale_price || 0)
          .filter(p => p > 0)
      );
      
      if (allVariantPrices.length > 0) {
        const highestPrice = Math.ceil(Math.max(...allVariantPrices));
        setMaxPrice(highestPrice);
        setPriceRange([0, highestPrice]);
      }
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
      
      const activeVariants = product.variants?.filter(v => v.is_active) || [];
      const variantPrices = activeVariants
        .map(v => v.price?.sale_price || v.price?.mrp_price || 0)
        .filter(p => p > 0);
      
      const minVariantPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : 0;
      const maxVariantPrice = variantPrices.length > 0 ? Math.max(...variantPrices) : 0;
      
      const matchesPrice = variantPrices.length === 0 || 
        (minVariantPrice <= priceRange[1] && maxVariantPrice >= priceRange[0]);
      
      const matchesSearch = !searchQuery || 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        product.variants?.some(v => 
          v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.sku?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        
      const hasDiscount = activeVariants.some(v => 
        v.price && v.price.sale_price < v.price.mrp_price
      );
      const matchesDiscount = !showDiscountedOnly || hasDiscount;

      return matchesCategory && matchesPrice && matchesSearch && matchesDiscount;
    });
  }, [products, selectedCategories, priceRange, searchQuery, showDiscountedOnly]);

  // Sort products
  const sortedProducts = React.useMemo(() => {
    const productsToSort: Product[] = filteredProducts || [];
    return [...productsToSort].sort((a, b) => {
      const getMinPrice = (product: Product) => {
        const activeVariants = product.variants?.filter(v => v.is_active) || [];
        const prices = activeVariants
          .map(v => v.price?.sale_price || v.price?.mrp_price || 0)
          .filter(p => p > 0);
        return prices.length > 0 ? Math.min(...prices) : 0;
      };

      switch (sortBy) {
        case 'price-low':
          return getMinPrice(a) - getMinPrice(b);
        case 'price-high':
          return getMinPrice(b) - getMinPrice(a);
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'featured':
          const aFeatured = a.variants?.some(v => v.is_featured) ? 1 : 0;
          const bFeatured = b.variants?.some(v => v.is_featured) ? 1 : 0;
          return bFeatured - aFeatured;
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
      return [categoryId]; // Single category focus matching Figma design
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

  // Selected Category Name for Header
  const activeCategoryObj = categories?.find(c => selectedCategories.includes(c.id));
  const activeCategoryName = activeCategoryObj ? activeCategoryObj.name : 'Fruits & Vegetables';

  return (
    <div className="min-h-screen flex flex-col bg-[#F9FBF8]">
      <Navbar />
      
      <main className="flex-grow py-6 sm:py-8 lg:py-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">

          {/* ================= 1. TOP HERO BANNER (Figma Page 4) ================= */}
          <section 
            className="relative rounded-3xl overflow-hidden bg-cover bg-bottom bg-no-repeat border-4 border-white shadow-xl mb-8 p-6 sm:p-8 lg:p-10 text-left"
            style={{ backgroundImage: `url('/hero-layers/bg-table.png')` }}
          >
            {/* Green Organic Shape Overlay (Right Side) */}
            <div className="absolute top-0 right-0 h-full w-full lg:w-1/2 flex justify-end pointer-events-none z-0 opacity-90">
              <img 
                src="/hero-layers/shape-green-nobg.png" 
                alt="Green background shape" 
                className="h-full w-full object-cover lg:object-fill"
              />
            </div>

            {/* Produce Basket Cut-out (Right Side) */}
            <div className="absolute bottom-0 right-4 lg:right-12 hidden md:block w-72 lg:w-96 z-10 pointer-events-none translate-y-2">
              <img 
                src="/hero-layers/produce-basket-nobg.png" 
                alt="Fresh produce basket" 
                className="w-full h-auto object-contain drop-shadow-xl"
              />
            </div>

            {/* Banner Inner Content */}
            <div className="relative z-10 max-w-xl">
              <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-md text-[#276B3C] px-3.5 py-1.5 rounded-full text-xs font-semibold mb-3 shadow-xs border border-green-200/60">
                <Leaf className="w-4 h-4 fill-[#276B3C]" />
                <span>Categories</span>
              </div>
              
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1E502B] font-serif leading-tight mb-3">
                Goodness<br />
                in Every Category
              </h1>
              
              <p className="text-gray-700 text-sm sm:text-base font-medium max-w-md leading-relaxed">
                Explore our wide range of fresh, natural and high-quality products, handpicked for your health and happiness.
              </p>
            </div>

            {/* Floating Top Right Tagline */}
            <div className="absolute top-6 right-8 hidden lg:block z-20 pointer-events-none text-right font-blackbones text-[#f4f6e8] text-2xl drop-shadow-md transform -rotate-3">
              Fresh Natural &gt;&gt;
            </div>
          </section>

          {/* ================= 2. MAIN LAYOUT GRID (LEFT SIDEBAR & RIGHT CONTENT) ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* ---------------- LEFT SIDEBAR (Figma Page 4) ---------------- */}
            <aside className="lg:col-span-3 space-y-6 lg:sticky lg:top-24 max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-none self-start">
              
              {/* Integrated Category & Filter Sidebar Card */}
              <div className="bg-[#f5f8f0] rounded-2xl border border-green-100/80 p-5 shadow-xs space-y-6 text-left">
                
                {/* 1. All Categories Section */}
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-green-200/60">
                    <button
                      id="toggle-categories"
                      type="button"
                      onClick={() => setCategoriesOpen(o => !o)}
                      aria-expanded={categoriesOpen}
                      className="flex-1 flex items-center gap-2 text-[#1E502B] font-bold text-base text-left"
                    >
                      <Leaf className="w-4.5 h-4.5 fill-[#1E502B]" />
                      <span>All Categories</span>
                      {!categoriesOpen && activeCategoryObj && (
                        <span className="text-xs font-semibold text-[#276B3C] bg-white px-2 py-0.5 rounded-full border border-green-200/60 truncate max-w-[7rem]">
                          {activeCategoryObj.name}
                        </span>
                      )}
                    </button>
                    <div className="flex items-center gap-2">
                      {selectedCategories.length > 0 && (
                        <button 
                          onClick={handleResetFilters} 
                          className="text-xs text-[#276B3C] hover:underline font-semibold"
                        >
                          Clear
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setCategoriesOpen(o => !o)}
                        aria-label={categoriesOpen ? 'Collapse categories' : 'Expand categories'}
                        className="p-1 rounded-full hover:bg-white/80 text-[#276B3C]"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${categoriesOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      categoriesOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="space-y-1 pt-1">
                        <button
                          onClick={() => setSelectedCategories([])}
                          className={`w-full text-left px-3.5 py-2.5 rounded-xl font-medium text-xs sm:text-sm flex items-center justify-between transition-all ${
                            selectedCategories.length === 0
                              ? 'bg-[#E8F5E9] text-[#1E502B] font-bold border-l-4 border-[#276B3C] shadow-2xs'
                              : 'text-gray-700 hover:bg-white/80'
                          }`}
                        >
                          <span>All Products</span>
                          {selectedCategories.length === 0 && (
                            <ChevronRight className="w-4 h-4 text-[#276B3C]" />
                          )}
                        </button>
                        {categories?.map((cat) => {
                          const isSelected = selectedCategories.includes(cat.id);
                          return (
                            <button
                              key={cat.id}
                              onClick={() => handleCategoryChange(cat.id)}
                              className={`w-full text-left px-3.5 py-2.5 rounded-xl font-medium text-xs sm:text-sm flex items-center justify-between transition-all ${
                                isSelected
                                  ? 'bg-[#E8F5E9] text-[#1E502B] font-bold border-l-4 border-[#276B3C] shadow-2xs'
                                  : 'text-gray-700 hover:bg-white/80'
                              }`}
                            >
                              <span className="truncate">{cat.name}</span>
                              {isSelected && (
                                <ChevronRight className="w-4 h-4 text-[#276B3C]" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Price Range Slider Section */}
                <div className="pt-4 border-t border-green-200/60">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[#1E502B] font-bold text-sm">Price Range</span>
                    <span className="text-xs font-semibold text-[#276B3C] bg-white px-2.5 py-0.5 rounded-md border border-green-200/60 shadow-2xs">
                      {formatCurrency(priceRange[0])} - {formatCurrency(priceRange[1])}
                    </span>
                  </div>

                  <Slider
                    defaultValue={priceRange}
                    value={priceRange}
                    max={maxPrice}
                    step={10}
                    onValueChange={handlePriceRangeChange}
                    className="my-3"
                  />

                  <div className="flex items-center justify-between text-[11px] text-gray-500">
                    <span>Min: {formatCurrency(0)}</span>
                    <span>Max: {formatCurrency(maxPrice)}</span>
                  </div>
                </div>

                {/* 3. Special Offers Filter Section */}
                <div className="pt-4 border-t border-green-200/60">
                  <span className="text-[#1E502B] font-bold text-sm block mb-3">Special Offers</span>
                  <div className="flex items-center space-x-2 bg-white/70 p-2.5 rounded-xl border border-green-200/50">
                    <Checkbox
                      id="discount-only-sidebar"
                      checked={showDiscountedOnly}
                      onCheckedChange={handleDiscountToggle}
                    />
                    <label
                      htmlFor="discount-only-sidebar"
                      className="text-xs font-semibold text-gray-800 flex items-center justify-between w-full cursor-pointer select-none"
                    >
                      <span>Items on Sale</span>
                      <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">
                        Sale
                      </span>
                    </label>
                  </div>
                </div>

                {/* Apply / Reset Filter Actions */}
                <div className="pt-4 border-t border-green-200/60 space-y-2">
                  <button
                    onClick={handleApplyFilters}
                    className="w-full bg-[#1E502B] hover:bg-[#276B3C] text-white font-bold text-xs sm:text-sm rounded-xl py-2.5 shadow-xs transition-colors"
                  >
                    Apply Filters
                  </button>
                  
                  {(selectedCategories.length > 0 || showDiscountedOnly || priceRange[1] < maxPrice || priceRange[0] > 0) && (
                    <button
                      onClick={handleResetFilters}
                      className="w-full text-xs text-gray-500 hover:text-red-600 font-medium py-1 transition-colors"
                    >
                      Reset All Filters
                    </button>
                  )}
                </div>

              </div>

              {/* Promo Card 1: Pure. Natural. Healthy. */}
              <div className="bg-[#f5f8f0] rounded-2xl border border-green-100/80 p-5 shadow-xs relative overflow-hidden text-left">
                <div className="w-10 h-10 rounded-full bg-[#E8F5E9] text-[#276B3C] flex items-center justify-center mb-3">
                  <Leaf className="w-5 h-5 fill-[#276B3C]" />
                </div>
                <h4 className="font-extrabold text-[#1E502B] text-base mb-1">
                  Pure. Natural. Healthy.
                </h4>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Because you deserve the best.
                </p>
                <div className="absolute bottom-2 right-2 opacity-15 pointer-events-none">
                  <Leaf className="w-16 h-16 text-[#276B3C] transform rotate-45" />
                </div>
              </div>

              {/* Promo Card 2: Healthy Choices for a Better You */}
              <div className="bg-[#f5f8f0] rounded-2xl border border-green-100/80 p-5 shadow-xs relative overflow-hidden text-left">
                <div className="inline-flex items-center gap-1.5 text-[#276B3C] font-semibold text-xs mb-2">
                  <Sparkles className="w-4 h-4" />
                  <span>Healthy Choices</span>
                </div>
                <h4 className="font-extrabold text-[#1E502B] text-lg leading-snug mb-1">
                  Healthy Choices for a Better You
                </h4>
                <p className="text-xs text-gray-600 mb-4">
                  Natural food. Better living.
                </p>
                <Link
                  to="/products"
                  className="inline-flex items-center gap-2 bg-[#1E502B] hover:bg-[#276B3C] text-white text-xs font-semibold px-5 py-2.5 rounded-full shadow-xs transition-colors"
                >
                  <span>Shop Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

            </aside>

            {/* ---------------- RIGHT CONTENT AREA ---------------- */}
            <div className="lg:col-span-9 space-y-8">

              {/* Categories Featured Row (Figma Page 4 Header) */}
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs text-left">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Leaf className="w-5 h-5 text-[#276B3C] fill-[#276B3C]" />
                    <h2 className="text-xl sm:text-2xl font-bold text-[#1E502B]">
                      Categories
                    </h2>
                  </div>
                </div>

                {/* Real Categories Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
                  {categories && categories.length > 0 ? (
                    categories.slice(0, 5).map((cat) => (
                      <div 
                        key={cat.id}
                        onClick={() => handleCategoryChange(cat.id)}
                        className={`bg-[#f5f8f0] rounded-2xl p-3 flex flex-col items-center text-center border transition-all duration-300 group cursor-pointer ${
                          selectedCategories.includes(cat.id)
                            ? 'border-[#276B3C] shadow-xs bg-[#E8F5E9]'
                            : 'border-green-100/80 hover:shadow-sm'
                        }`}
                      >
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden mb-2.5 border-2 border-white shadow-xs bg-white flex items-center justify-center">
                          <img 
                            src={cat.image_url || '/placeholder.svg'} 
                            alt={cat.name} 
                            className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-300"
                          />
                        </div>
                        <h4 className="font-bold text-gray-900 text-xs sm:text-sm mb-2 line-clamp-1">{cat.name}</h4>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCategoryChange(cat.id);
                          }}
                          className="bg-white/90 hover:bg-white text-[11px] font-semibold text-[#1E502B] px-3 py-1 rounded-full border border-green-200/80 shadow-2xs inline-flex items-center gap-1 transition-colors"
                        >
                          <span>View All</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  ) : (
                    Array(5).fill(0).map((_, idx) => (
                      <Skeleton key={idx} className="h-32 w-full rounded-2xl bg-[#f5f8f0]" />
                    ))
                  )}
                </div>
              </div>

              {/* Toolbar Bar: Search & Sort Selector */}
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs">
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                  
                  {/* Search Bar */}
                  <form onSubmit={handleSearch} className="relative w-full sm:flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-10 rounded-xl border-gray-200 focus:border-[#276B3C]"
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
                  </form>
                  
                  {/* Sort Selector & Mobile Filter Toggle */}
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <Select value={sortBy} onValueChange={handleSortChange}>
                      <SelectTrigger className="w-[180px] rounded-xl border-gray-200">
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
                        <Button variant="outline" className="md:hidden rounded-xl border-gray-200">
                          <Filter className="h-4 w-4 mr-2 text-[#276B3C]" />
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
                          <Button onClick={handleApplyFilters} className="w-full bg-[#1E502B]">
                            Apply Filters
                          </Button>
                        </SheetFooter>
                      </SheetContent>
                    </Sheet>
                  </div>
                </div>

                {/* Active Filter Badges */}
                {(selectedCategories.length > 0 || showDiscountedOnly) && (
                  <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-500 font-medium">Active:</span>
                    {selectedCategories.map(id => {
                      const category = categories?.find(c => c.id === id);
                      return category ? (
                        <Badge key={id} variant="secondary" className="py-1 px-3 bg-[#E8F5E9] text-[#1E502B] font-semibold border border-green-200">
                          {category.name}
                          <button onClick={() => handleCategoryChange(id)} className="ml-1.5 hover:text-red-500">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ) : null;
                    })}
                    {showDiscountedOnly && (
                      <Badge variant="secondary" className="py-1 px-3 bg-[#1E502B] text-white">
                        Sale Items
                        <button onClick={handleDiscountToggle} className="ml-1.5">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    <Button variant="ghost" size="sm" onClick={handleResetFilters} className="text-xs h-7 text-gray-500 hover:text-gray-900">
                      Clear all
                    </Button>
                  </div>
                )}
              </div>

              {/* Products Display Grid */}
              {isLoadingProducts || isLoadingCategories ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  {[...Array(8)].map((_, index) => (
                    <Skeleton key={index} className="h-[360px] rounded-2xl bg-[#f5f8f0]" />
                  ))}
                </div>
              ) : productsError ? (
                <ErrorMessage 
                  title="Failed to load products" 
                  message="Please try refreshing the page or contact support if the problem persists." 
                />
              ) : sortedProducts.length === 0 ? (
                <div className="bg-[#f5f8f0] rounded-2xl border border-green-100/70 p-12 text-center">
                  <SlidersHorizontal className="h-12 w-12 text-[#276B3C] mx-auto mb-4 opacity-50" />
                  <h2 className="text-xl font-bold text-[#1E502B] mb-2">No products found</h2>
                  <p className="text-gray-600 text-sm mb-6">
                    Try adjusting your filters or search terms.
                  </p>
                  <Button onClick={handleResetFilters} variant="outline" className="rounded-full border-green-300">
                    Reset Filters
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2 px-1 text-left">
                    <p className="text-xs sm:text-sm font-semibold text-gray-600">
                      Showing <span className="text-[#1E502B] font-extrabold">{sortedProducts.length}</span> fresh products
                    </p>
                  </div>
                  
                  {/* 4-Column Grid with #f5f8f0 Product Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                    {sortedProducts.map((product) => (
                      <ProductCard 
                        key={product.id} 
                        product={product}
                      />
                    ))}
                  </div>
                </>
              )}

            </div>

          </div>

          {/* ================= 3. BOTTOM VALUE PROPOSITION BANNER (Figma Page 4) ================= */}
          <section className="mt-14 bg-[#f5f8f0] border border-green-100/80 rounded-2xl p-6 sm:p-8 shadow-xs">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-center">
              
              {/* Feature 1 */}
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-[#E8F5E9] text-[#276B3C] flex items-center justify-center mb-2.5">
                  <Leaf className="w-6 h-6 fill-[#276B3C]" />
                </div>
                <h4 className="font-bold text-[#1E502B] text-sm">100% Natural</h4>
                <p className="text-xs text-gray-500 mt-0.5">No artificial additives</p>
              </div>

              {/* Feature 2 */}
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-[#E8F5E9] text-[#276B3C] flex items-center justify-center mb-2.5">
                  <FlaskConical className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-[#1E502B] text-sm">Chemical Free</h4>
                <p className="text-xs text-gray-500 mt-0.5">Safe for your family</p>
              </div>

              {/* Feature 3 */}
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-[#E8F5E9] text-[#276B3C] flex items-center justify-center mb-2.5">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-[#1E502B] text-sm">Farm Fresh</h4>
                <p className="text-xs text-gray-500 mt-0.5">Direct from farmers</p>
              </div>

              {/* Feature 4 */}
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-[#E8F5E9] text-[#276B3C] flex items-center justify-center mb-2.5">
                  <HeartHandshake className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-[#1E502B] text-sm">Healthy Choices</h4>
                <p className="text-xs text-gray-500 mt-0.5">For a better tomorrow</p>
              </div>

              {/* Feature 5 */}
              <div className="flex flex-col items-center col-span-2 md:col-span-1">
                <div className="w-12 h-12 rounded-full bg-[#E8F5E9] text-[#276B3C] flex items-center justify-center mb-2.5">
                  <TreePine className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-[#1E502B] text-sm">Sustainable</h4>
                <p className="text-xs text-gray-500 mt-0.5">Good for you & planet</p>
              </div>

            </div>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  );
}
