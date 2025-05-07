import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchCategories } from '@/api/categories';

export type CategoryContextType = {
  categories: any[];
  isLoading: boolean;
  error: Error | null;
  isCategoryDrawerOpen: boolean;
  setIsCategoryDrawerOpen: (isOpen: boolean) => void;
};

const CategoryContext = createContext<CategoryContextType>({
  categories: [],
  isLoading: false,
  error: null,
  isCategoryDrawerOpen: false,
  setIsCategoryDrawerOpen: () => null,
});

export const CategoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState<boolean>(false);

  useEffect(() => {
    const loadCategories = async () => {
      setIsLoading(true);
      try {
        const data = await fetchCategories();
        setCategories(data);
      } catch (err: any) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadCategories();
  }, []);

  return (
    <CategoryContext.Provider
      value={{
        categories,
        isLoading,
        error,
        isCategoryDrawerOpen,
        setIsCategoryDrawerOpen,
      }}
    >
      {children}
    </CategoryContext.Provider>
  );
};

export const useCategory = () => {
  const context = useContext(CategoryContext);
  if (context === undefined) {
    throw new Error('useCategory must be used within a CategoryProvider');
  }
  return context;
}; 