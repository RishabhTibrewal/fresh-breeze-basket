export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  image_url: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  sale_price?: number;
  unit: string;
  images: string[];
  badge?: 'new' | 'sale' | 'best-seller' | 'organic';
  category_id: string;
  origin: string;
  description: string;
  nutritional_info: string;
  is_active: boolean;
  stock_count: number;
  harvest_date?: string;
  best_before?: string;
}

export const categories: ProductCategory[] = [
  {
    id: 'cat-1',
    name: 'Seasonal Fruits',
    slug: 'seasonal-fruits',
    image_url: 'https://images.unsplash.com/photo-1519996529931-28324d5a630e?q=80&w=800&auto=format',
  },
  {
    id: 'cat-2',
    name: 'Organic Vegetables',
    slug: 'organic-vegetables',
    image_url: 'https://images.unsplash.com/photo-1566385101042-1a0aa0c1268c?q=80&w=800&auto=format',
  },
  {
    id: 'cat-3',
    name: 'Exotic Imports',
    slug: 'exotic-imports',
    image_url: 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab12?q=80&w=800&auto=format',
  },
  {
    id: 'cat-4',
    name: 'Local Favorites',
    slug: 'local-favorites',
    image_url: 'https://images.unsplash.com/photo-1573246123716-6b1782bfc499?q=80&w=800&auto=format',
  },
  {
    id: 'cat-5',
    name: 'Value Bundles',
    slug: 'value-bundles',
    image_url: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?q=80&w=800&auto=format',
  },
  {
    id: 'cat-6',
    name: 'All Fruits',
    slug: 'all-fruits',
    image_url: 'https://images.unsplash.com/photo-1577234286642-fc512a5f8f77?q=80&w=800&auto=format',
  },
  {
    id: 'cat-7',
    name: 'All Vegetables',
    slug: 'all-vegetables',
    image_url: 'https://images.unsplash.com/photo-1557844352-761f2565b576?q=80&w=800&auto=format',
  }
];

export const products: Product[] = [
  {
    id: 'p1',
    name: 'Premium Red Apples',
    slug: 'premium-red-apples',
    price: 25.99,
    unit: 'kg',
    images: [
      'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?q=80&w=800&auto=format',
      'https://images.unsplash.com/photo-1570913149827-d2ac84ab3f9a?q=80&w=800&auto=format',
    ],
    category_id: 'cat-1',
    origin: 'United States',
    description: 'Sweet and juicy red apples. Perfect for snacking, baking, or adding to salads.',
    nutritional_info: 'Rich in fiber, vitamin C, and antioxidants.',
    is_active: true,
    stock_count: 45,
    harvest_date: '2025-04-01',
    best_before: '2025-04-20',
  },
  {
    id: 'p2',
    name: 'Organic Bananas',
    slug: 'organic-bananas',
    price: 12.50,
    unit: 'kg',
    images: [
      'https://images.unsplash.com/photo-1603833665858-e61d17a86224?q=80&w=800&auto=format',
      'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?q=80&w=800&auto=format',
    ],
    badge: 'organic',
    category_id: 'cat-2',
    origin: 'Ecuador',
    description: 'Organic bananas grown without pesticides. Sweet and nutritious.',
    nutritional_info: 'Excellent source of potassium, vitamin B6, and fiber.',
    is_active: true,
    stock_count: 78,
    harvest_date: '2025-04-05',
    best_before: '2025-04-15',
  },
  {
    id: 'p3',
    name: 'Fresh Strawberries',
    slug: 'fresh-strawberries',
    price: 35.75,
    sale_price: 29.99,
    unit: 'box',
    images: [
      'https://images.unsplash.com/photo-1543528176-61b239494933?q=80&w=800&auto=format',
      'https://images.unsplash.com/photo-1587393855524-087f83d95bc9?q=80&w=800&auto=format',
    ],
    badge: 'sale',
    category_id: 'cat-1',
    origin: 'Spain',
    description: 'Sweet and juicy strawberries. Perfect for desserts or eating fresh.',
    nutritional_info: 'Rich in vitamin C, manganese, and antioxidants.',
    is_active: true,
    stock_count: 30,
    harvest_date: '2025-04-10',
    best_before: '2025-04-14',
  },
  {
    id: 'p4',
    name: 'Organic Baby Spinach',
    slug: 'organic-baby-spinach',
    price: 18.99,
    unit: 'pack',
    images: [
      'https://images.unsplash.com/photo-1576045057995-568f588f82fb?q=80&w=800&auto=format',
      'https://images.unsplash.com/photo-1574316071802-0d684efa7bf5?q=80&w=800&auto=format',
    ],
    badge: 'organic',
    category_id: 'cat-2',
    origin: 'UAE',
    description: 'Locally grown organic baby spinach. Fresh and tender leaves.',
    nutritional_info: 'Excellent source of iron, vitamin K, and folate.',
    is_active: true,
    stock_count: 50,
    harvest_date: '2025-04-09',
    best_before: '2025-04-16',
  },
  {
    id: 'p5',
    name: 'Dragon Fruit',
    slug: 'dragon-fruit',
    price: 42.99,
    unit: 'piece',
    images: [
      'https://images.unsplash.com/photo-1600696380370-856ffe3c865f?q=80&w=800&auto=format',
      'https://images.unsplash.com/photo-1568909218940-9ca084ad57de?q=80&w=800&auto=format',
    ],
    badge: 'new',
    category_id: 'cat-3',
    origin: 'Vietnam',
    description: 'Exotic dragon fruit with vibrant pink skin and speckled flesh.',
    nutritional_info: 'Contains vitamin C, iron, and antioxidants.',
    is_active: true,
    stock_count: 25,
    harvest_date: '2025-04-08',
    best_before: '2025-04-18',
  },
  {
    id: 'p6',
    name: 'Local Dates',
    slug: 'local-dates',
    price: 55.00,
    unit: 'kg',
    images: [
      'https://images.unsplash.com/photo-1593498686033-4ce2a27be1c1?q=80&w=800&auto=format',
      'https://images.unsplash.com/photo-1584365685547-9a5fb6f3a70c?q=80&w=800&auto=format',
    ],
    badge: 'best-seller',
    category_id: 'cat-4',
    origin: 'UAE',
    description: 'Premium local dates. Sweet, soft and packed with nutrition.',
    nutritional_info: 'Rich in fiber, potassium, and various antioxidants.',
    is_active: true,
    stock_count: 100,
    harvest_date: '2025-04-01',
    best_before: '2025-06-01',
  },
  {
    id: 'p7',
    name: 'Avocados',
    slug: 'avocados',
    price: 32.99,
    unit: 'pack of 3',
    images: [
      'https://images.unsplash.com/photo-1601039641847-7857b994d704?q=80&w=800&auto=format',
      'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?q=80&w=800&auto=format',
    ],
    category_id: 'cat-1',
    origin: 'Mexico',
    description: 'Perfectly ripe avocados ready to eat. Creamy and nutritious.',
    nutritional_info: 'High in healthy fats, fiber, and potassium.',
    is_active: true,
    stock_count: 40,
    harvest_date: '2025-04-07',
    best_before: '2025-04-15',
  },
  {
    id: 'p8',
    name: 'Family Fresh Box',
    slug: 'family-fresh-box',
    price: 149.99,
    sale_price: 129.99,
    unit: 'box',
    images: [
      'https://images.unsplash.com/photo-1610348725531-843dff563e2c?q=80&w=800&auto=format',
      'https://images.unsplash.com/photo-1573246123716-6b1782bfc499?q=80&w=800&auto=format',
    ],
    badge: 'sale',
    category_id: 'cat-5',
    origin: 'Various',
    description: 'Weekly family fresh box with seasonal fruits and vegetables. Perfect for a family of 4.',
    nutritional_info: 'Varied selection of essential vitamins and minerals.',
    is_active: true,
    stock_count: 15,
    harvest_date: '2025-04-10',
    best_before: '2025-04-17',
  },
];

export const getProductsByCategory = (categoryId: string): Product[] => {
  return products.filter(product => product.category_id === categoryId);
};

export const getProductBySlug = (slug: string): Product | undefined => {
  return products.find(product => product.slug === slug);
};

export const getFeaturedProducts = (categoryId?: string): Product[] => {
  let filteredProducts = products.filter(product => product.badge === 'best-seller');
  
  if (categoryId) {
    filteredProducts = filteredProducts.filter(product => product.category_id === categoryId);
  }
  
  return filteredProducts;
};

export const getOnSaleProducts = (categoryId?: string): Product[] => {
  let filteredProducts = products.filter(product => product.sale_price !== undefined);
  
  if (categoryId) {
    filteredProducts = filteredProducts.filter(product => product.category_id === categoryId);
  }
  
  return filteredProducts;
};

export const getFilteredProducts = (filters: {
  category?: string;
  badge?: Product['badge'];
  organic?: boolean;
  onSale?: boolean;
  origin?: string;
}): Product[] => {
  return products.filter(product => {
    // Apply category filter
    if (filters.category && product.category_id !== filters.category) {
      return false;
    }
    
    // Apply badge filter
    if (filters.badge && product.badge !== filters.badge) {
      return false;
    }
    
    // Apply organic filter
    if (filters.organic && product.badge !== 'organic') {
      return false;
    }
    
    // Apply sale filter
    if (filters.onSale && product.sale_price === undefined) {
      return false;
    }
    
    // Apply origin filter
    if (filters.origin && product.origin !== filters.origin) {
      return false;
    }
    
    return true;
  });
};
