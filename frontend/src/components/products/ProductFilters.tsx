import React from 'react';
import { X, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface FilterCategory {
  id: string;
  name: string;
  count?: number;
}

export interface ProductFiltersProps {
  categories: FilterCategory[];
  selectedCategories: string[];
  onCategoryChange: (categoryId: string) => void;
  priceRange: [number, number];
  onPriceRangeChange: (value: number[]) => void;
  maxPrice: number;
  onReset: () => void;
  onApply: () => void;
  showDiscountedOnly?: boolean;
  onDiscountToggle?: () => void;
  className?: string;
}

const ProductFilters: React.FC<ProductFiltersProps> = ({
  categories,
  selectedCategories,
  onCategoryChange,
  priceRange,
  onPriceRangeChange,
  maxPrice,
  onReset,
  onApply,
  showDiscountedOnly = false,
  onDiscountToggle,
  className
}) => {
  const [expandedSections, setExpandedSections] = React.useState({
    categories: true,
    price: true,
    discount: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className={cn("bg-white rounded-lg shadow-sm p-4", className)}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Filters</h2>
        <Button variant="ghost" size="sm" onClick={onReset} className="h-8 text-muted-foreground">
          Reset All
        </Button>
      </div>

      {/* Selected filters */}
      {selectedCategories.length > 0 && (
        <div className="mb-4">
          <div className="text-sm text-muted-foreground mb-2">Active Filters:</div>
          <div className="flex flex-wrap gap-2">
            {selectedCategories.map((id) => {
              const category = categories.find((c) => c.id === id);
              return (
                <Badge key={id} variant="secondary" className="py-1 px-2 gap-1">
                  {category?.name}
                  <button
                    onClick={() => onCategoryChange(id)}
                    className="ml-1 rounded-full hover:bg-muted p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      <Separator className="my-4" />

      {/* Categories */}
      <div className="mb-4">
        <button
          onClick={() => toggleSection('categories')}
          className="flex items-center justify-between w-full text-left font-medium mb-2"
        >
          <span>Categories</span>
          {expandedSections.categories ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        
        {expandedSections.categories && (
          <div className="space-y-2 mt-2">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`category-${category.id}`}
                  checked={selectedCategories.includes(category.id)}
                  onCheckedChange={() => onCategoryChange(category.id)}
                />
                <label
                  htmlFor={`category-${category.id}`}
                  className="text-sm flex items-center justify-between w-full cursor-pointer"
                >
                  <span>{category.name}</span>
                  {category.count !== undefined && (
                    <span className="text-muted-foreground text-xs bg-muted rounded-full px-2 py-0.5">
                      {category.count}
                    </span>
                  )}
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator className="my-4" />

      {/* Price Range */}
      <div className="mb-4">
        <button
          onClick={() => toggleSection('price')}
          className="flex items-center justify-between w-full text-left font-medium mb-2"
        >
          <span>Price Range</span>
          {expandedSections.price ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        
        {expandedSections.price && (
          <div className="space-y-4 mt-2">
            <Slider
              defaultValue={priceRange}
              max={maxPrice}
              step={10}
              onValueChange={onPriceRangeChange}
              className="mt-2"
            />
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <span className="text-sm text-muted-foreground">Min</span>
                <div className="bg-muted rounded px-2 py-1 text-sm">₹ {priceRange[0]}</div>
              </div>
              <div className="mx-2 text-muted-foreground">-</div>
              <div className="flex-1">
                <span className="text-sm text-muted-foreground">Max</span>
                <div className="bg-muted rounded px-2 py-1 text-sm">₹ {priceRange[1]}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Separator className="my-4" />
      
      {/* Discount Filter */}
      {onDiscountToggle && (
        <div className="mb-4">
          <button
            onClick={() => toggleSection('discount')}
            className="flex items-center justify-between w-full text-left font-medium mb-2"
          >
            <span>Special Offers</span>
            {expandedSections.discount ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          
          {expandedSections.discount && (
            <div className="space-y-2 mt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="discount-only"
                  checked={showDiscountedOnly}
                  onCheckedChange={onDiscountToggle}
                />
                <label
                  htmlFor="discount-only"
                  className="text-sm flex items-center justify-between w-full cursor-pointer"
                >
                  <span>Items on Sale</span>
                  <span className="text-muted-foreground text-xs bg-red-100 text-red-600 rounded-full px-2 py-0.5">
                    Sale
                  </span>
                </label>
              </div>
            </div>
          )}
          
          <Separator className="my-4" />
        </div>
      )}

      <Button onClick={onApply} className="w-full">
        Apply Filters
      </Button>
    </div>
  );
};

export default ProductFilters; 