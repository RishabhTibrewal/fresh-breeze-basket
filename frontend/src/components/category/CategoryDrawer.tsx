import React from 'react';
import { Link } from 'react-router-dom';
import { X, LayoutGrid } from 'lucide-react';
import { useCategory } from '@/contexts/CategoryContext';
import { Skeleton } from '@/components/ui/skeleton';

const CategoryDrawer = () => {
  const { categories, isLoading, isCategoryDrawerOpen, setIsCategoryDrawerOpen } = useCategory();

  return (
    <>
      {/* Backdrop */}
      {isCategoryDrawerOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsCategoryDrawerOpen(false)}
        />
      )}
      
      {/* Category drawer - positioned to appear from left */}
      <div className={`fixed top-0 left-0 h-full w-[85%] sm:w-80 bg-white shadow-lg z-50 transform transition-transform duration-300 ease-in-out ${
        isCategoryDrawerOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center">
              <LayoutGrid className="h-5 w-5 text-primary mr-2" />
              <h2 className="text-lg font-semibold">Categories</h2>
            </div>
            <button 
              onClick={() => setIsCategoryDrawerOpen(false)}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Category list */}
          <div className="flex-grow overflow-y-auto py-4">
            {isLoading ? (
              // Loading state
              <div className="space-y-2 p-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center p-2">
                    <Skeleton className="h-10 w-10 rounded-md mr-3" />
                    <Skeleton className="h-6 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              // Categories list
              <ul className="space-y-1 p-2">
                {categories.map((category) => (
                  <li key={category.id}>
                    <Link 
                      to={`/categories/${category.slug}`}
                      onClick={() => setIsCategoryDrawerOpen(false)}
                      className="flex items-center p-2 hover:bg-gray-50 rounded-md transition-colors"
                    >
                      {category.image_url ? (
                        <img 
                          src={category.image_url} 
                          alt={category.name}
                          className="h-10 w-10 object-cover rounded-md mr-3" 
                        />
                      ) : (
                        <div className="h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center mr-3">
                          <LayoutGrid className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                      <span className="text-gray-800">{category.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          {/* Footer */}
          <div className="border-t p-4">
            <Link 
              to="/categories"
              onClick={() => setIsCategoryDrawerOpen(false)}
              className="block w-full bg-primary text-white py-3 text-center rounded-md hover:bg-opacity-90 transition-colors"
            >
              View All Categories
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default CategoryDrawer; 