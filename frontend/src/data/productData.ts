export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  image: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  salePrice?: number;
  unit: string;
  images: string[];
  badge?: 'new' | 'sale' | 'best-seller' | 'organic';
  categoryId: string;
  origin: string;
  description: string;
  nutritionalInfo: string;
  inStock: boolean;
  stockCount: number;
  harvestDate?: string;
  bestBefore?: string;
}

export const categories: ProductCategory[] = [
  {
    id: 'cat-1',
    name: 'Seasonal Fruits',
    slug: 'seasonal-fruits',
    image: 'https://images.unsplash.com/photo-1519996529931-28324d5a630e?q=80&w=800&auto=format',
  },
  {
    id: 'cat-2',
    name: 'Organic Vegetables',
    slug: 'organic-vegetables',
    image: 'https://images.unsplash.com/photo-1566385101042-1a0aa0c1268c?q=80&w=800&auto=format',
  },
  {
    id: 'cat-3',
    name: 'Exotic Imports',
    slug: 'exotic-imports',
    image: 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab12?q=80&w=800&auto=format',
  },
  {
    id: 'cat-4',
    name: 'Local Favorites',
    slug: 'local-favorites',
    image: 'https://images.unsplash.com/photo-1573246123716-6b1782bfc499?q=80&w=800&auto=format',
  },
  {
    id: 'cat-5',
    name: 'Value Bundles',
    slug: 'value-bundles',
    image: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?q=80&w=800&auto=format',
  },
  {
    id: 'cat-6',
    name: 'All Fruits',
    slug: 'all-fruits',
    image: 'https://images.unsplash.com/photo-1577234286642-fc512a5f8f77?q=80&w=800&auto=format',
  },
  {
    id: 'cat-7',
    name: 'All Vegetables',
    slug: 'all-vegetables',
    image: 'https://images.unsplash.com/photo-1557844352-761f2565b576?q=80&w=800&auto=format',
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
    categoryId: 'cat-1',
    origin: 'United States',
    description: 'Sweet and juicy red apples. Perfect for snacking, baking, or adding to salads.',
    nutritionalInfo: 'Rich in fiber, vitamin C, and antioxidants.',
    inStock: true,
    stockCount: 45,
    harvestDate: '2025-04-01',
    bestBefore: '2025-04-20',
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
    categoryId: 'cat-2',
    origin: 'Ecuador',
    description: 'Organic bananas grown without pesticides. Sweet and nutritious.',
    nutritionalInfo: 'Excellent source of potassium, vitamin B6, and fiber.',
    inStock: true,
    stockCount: 78,
    harvestDate: '2025-04-05',
    bestBefore: '2025-04-15',
  },
  {
    id: 'p3',
    name: 'Fresh Strawberries',
    slug: 'fresh-strawberries',
    price: 35.75,
    salePrice: 29.99,
    unit: 'box',
    images: [
      'https://images.unsplash.com/photo-1543528176-61b239494933?q=80&w=800&auto=format',
      'https://images.unsplash.com/photo-1587393855524-087f83d95bc9?q=80&w=800&auto=format',
    ],
    badge: 'sale',
    categoryId: 'cat-1',
    origin: 'Spain',
    description: 'Sweet and juicy strawberries. Perfect for desserts or eating fresh.',
    nutritionalInfo: 'Rich in vitamin C, manganese, and antioxidants.',
    inStock: true,
    stockCount: 30,
    harvestDate: '2025-04-10',
    bestBefore: '2025-04-14',
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
    categoryId: 'cat-2',
    origin: 'UAE',
    description: 'Locally grown organic baby spinach. Fresh and tender leaves.',
    nutritionalInfo: 'Excellent source of iron, vitamin K, and folate.',
    inStock: true,
    stockCount: 50,
    harvestDate: '2025-04-09',
    bestBefore: '2025-04-16',
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
    categoryId: 'cat-3',
    origin: 'Vietnam',
    description: 'Exotic dragon fruit with vibrant pink skin and speckled flesh.',
    nutritionalInfo: 'Contains vitamin C, iron, and antioxidants.',
    inStock: true,
    stockCount: 25,
    harvestDate: '2025-04-08',
    bestBefore: '2025-04-18',
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
    categoryId: 'cat-4',
    origin: 'UAE',
    description: 'Premium local dates. Sweet, soft and packed with nutrition.',
    nutritionalInfo: 'Rich in fiber, potassium, and various antioxidants.',
    inStock: true,
    stockCount: 100,
    harvestDate: '2025-04-01',
    bestBefore: '2025-06-01',
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
    categoryId: 'cat-1',
    origin: 'Mexico',
    description: 'Perfectly ripe avocados ready to eat. Creamy and nutritious.',
    nutritionalInfo: 'High in healthy fats, fiber, and potassium.',
    inStock: true,
    stockCount: 40,
    harvestDate: '2025-04-07',
    bestBefore: '2025-04-15',
  },
  {
    id: 'p8',
    name: 'Family Fresh Box',
    slug: 'family-fresh-box',
    price: 149.99,
    salePrice: 129.99,
    unit: 'box',
    images: [
      'https://images.unsplash.com/photo-1610348725531-843dff563e2c?q=80&w=800&auto=format',
      'https://images.unsplash.com/photo-1573246123716-6b1782bfc499?q=80&w=800&auto=format',
    ],
    badge: 'sale',
    categoryId: 'cat-5',
    origin: 'Various',
    description: 'Weekly family fresh box with seasonal fruits and vegetables. Perfect for a family of 4.',
    nutritionalInfo: 'Varied selection of essential vitamins and minerals.',
    inStock: true,
    stockCount: 15,
    harvestDate: '2025-04-10',
    bestBefore: '2025-04-17',
  },
];

export const getProductsByCategory = (categoryId: string): Product[] => {
  return products.filter(product => product.categoryId === categoryId);
};

export const getProductBySlug = (slug: string): Product | undefined => {
  return products.find(product => product.slug === slug);
};

export const getFeaturedProducts = (): Product[] => {
  return products.filter(product => product.badge === 'best-seller' || product.badge === 'new').slice(0, 4);
};

export const getOnSaleProducts = (): Product[] => {
  return products.filter(product => product.salePrice !== undefined).slice(0, 4);
};
