import apiClient from '@/lib/apiClient';

export interface ProductImage {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  image_url: string;
  is_primary: boolean;
  display_order: number;
  created_at: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string | null;
  legal_name: string | null;
  logo_url: string | null;
  is_active: boolean;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export interface Tax {
  id: string;
  name: string;
  code: string;
  rate: number;
  is_active: boolean;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export interface ProductPrice {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  outlet_id: string | null;
  price_type: string;
  mrp_price: number;
  sale_price: number;
  brand_id: string | null;
  valid_from: string;
  valid_until: string | null;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  price_id: string;
  is_default: boolean;
  image_url: string | null;
  is_featured: boolean;
  is_active: boolean;
  unit: number | null;
  unit_type: string;
  best_before: string | null;
  tax_id: string | null;
  hsn: string | null;
  badge: string | null;
  brand_id: string | null;
  company_id: string;
  created_at: string;
  updated_at: string;
  // Nested relations (from API responses)
  price?: ProductPrice;
  brand?: Brand;
  tax?: Tax;
  variant_images?: ProductImage[];
}

interface APIProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  category_id: string | null;
  slug: string;
  is_featured: boolean;
  is_active: boolean;
  stock_count: number;
  unit_type: string;
  nutritional_info: string | null;
  origin: string | null;
  best_before: string | null;
  created_at: string;
  updated_at: string;
  unit: number | null;
  badge: string | null;
  product_code: string | null;
  hsn_code: string | null;
  tax: number | null;
}

export interface Product {
  id: string;                          // uuid
  name: string;                        // varchar(255)
  description: string | null;          // text
  category_id: string | null;          // uuid
  slug: string;                        // varchar(255)
  is_active: boolean;                  // boolean (product-level activation control)
  nutritional_info: string | null;     // text
  origin: string | null;               // varchar(100)
  brand_id: string | null;            // uuid (product-level brand)
  product_code: string | null;         // varchar(100)
  created_at: string;                  // timestamp with timezone
  updated_at: string;                  // timestamp with timezone
  // Nested relations (from API responses)
  brand?: Brand;
  variants?: ProductVariant[];
  // Legacy fields (deprecated, kept for backward compatibility during migration)
  /** @deprecated Use variants[].price.sale_price instead */
  price?: number;
  /** @deprecated Use variants[].price.sale_price instead */
  sale_price?: number | null;
  /** @deprecated Use variants[].image_url instead */
  image_url?: string | null;
  /** @deprecated Use variants[].is_featured instead */
  is_featured?: boolean;
  /** @deprecated Stock is tracked at variant level in warehouse_inventory */
  stock_count?: number;
  /** @deprecated Use variants[].unit_type instead */
  unit_type?: string;
  /** @deprecated Use variants[].best_before instead */
  best_before?: string | null;
  /** @deprecated Use variants[].unit instead */
  unit?: number | null;
  /** @deprecated Use variants[].badge instead */
  badge?: string | null;
  /** @deprecated Use variants[].hsn instead */
  hsn_code?: string | null;
  /** @deprecated Use variants[].tax_id instead */
  tax?: number | null;
  additional_images?: string[];       // handled separately in product_images table
}

export interface CreateProductInput {
  name: string;
  description: string | null;
  category_id: string | null;
  brand_id?: string | null;
  origin: string | null;
  nutritional_info: string | null;
  is_active?: boolean;
  slug?: string;
  product_code?: string | null;
  // Optional: variants array for creating product with variants
  variants?: Array<{
    name: string;
    sku?: string | null;
    price?: number | null;
    mrp_price?: number | null;
    image_url?: string | null;
    is_featured?: boolean;
    is_active?: boolean;
    unit?: number | null;
    unit_type?: string;
    best_before?: string | null;
    tax_id?: string | null;
    hsn?: string | null;
    badge?: string | null;
    brand_id?: string | null;
  }>;
  // Legacy fields (deprecated, kept for backward compatibility)
  /** @deprecated Use variants array instead */
  price?: string;
  /** @deprecated Use variants array instead */
  sale_price?: string | null;
  /** @deprecated Use variants array instead */
  stock_count?: string;
  /** @deprecated Use variants array instead */
  warehouse_id?: string | null;
  /** @deprecated Use variants array instead */
  unit?: string;
  /** @deprecated Use variants array instead */
  unit_type?: string;
  /** @deprecated Use variants array instead */
  badge?: string | null;
  /** @deprecated Use variants array instead */
  image_url?: string;
  /** @deprecated Use variants array instead */
  additional_images?: string[];
  /** @deprecated Use variants array instead */
  best_before?: string | null;
  /** @deprecated Use variants array instead */
  is_featured?: boolean;
  /** @deprecated Use variants array instead */
  hsn_code?: string | null;
  /** @deprecated Use variants array instead */
  tax?: string | null;
}

export interface UpdateProductData extends CreateProductInput {}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
}

export const productsService = {
  /**
   * Get all products with variants, prices, and brands
   * Returns catalog-only product data with nested variant information
   */
  async getAll(): Promise<Product[]> {
    const { data: response } = await apiClient.get<ApiResponse<any[]>>('/products');
    return response.data.map((apiProduct: any) => ({
      id: apiProduct.id,
      name: apiProduct.name,
      description: apiProduct.description || null,
      category_id: apiProduct.category_id,
      slug: apiProduct.slug,
      is_active: apiProduct.is_active,
      nutritional_info: apiProduct.nutritional_info || null,
      origin: apiProduct.origin || null,
      brand_id: apiProduct.brand_id || null,
      product_code: apiProduct.product_code || null,
      created_at: apiProduct.created_at,
      updated_at: apiProduct.updated_at,
      // Nested relations
      brand: apiProduct.brand || undefined,
      variants: apiProduct.variants || [],
      // Legacy fields (for backward compatibility)
      price: apiProduct.price,
      sale_price: apiProduct.sale_price,
      stock_count: apiProduct.stock_count,
      image_url: apiProduct.image_url,
      is_featured: apiProduct.is_featured,
      unit_type: apiProduct.unit_type,
      unit: apiProduct.unit,
      badge: apiProduct.badge,
      best_before: apiProduct.best_before,
      hsn_code: apiProduct.hsn_code,
      tax: apiProduct.tax,
      additional_images: [],
    }));
  },

  /**
   * Get product by ID with full variant details, prices, brands, and images
   * Returns product with nested variants array containing prices, brands, taxes, and images
   */
  async getById(id: string): Promise<Product> {
    const { data: response } = await apiClient.get<ApiResponse<any>>(`/products/${id}?include=true`);
    const apiProduct = response.data.product || response.data;
    
    // Get product-level images (not variant-specific)
    // Omit variant_id parameter to get product-level images (where variant_id IS NULL)
    const { data: imagesResponse } = await apiClient.get<ApiResponse<ProductImage[]>>(`/product-images/${id}`);
    
    const additionalImages = (imagesResponse?.data || [])
      .sort((a, b) => a.display_order - b.display_order)
      .map(img => img.image_url);

    return {
      id: apiProduct.id,
      name: apiProduct.name,
      description: apiProduct.description || null,
      category_id: apiProduct.category_id,
      slug: apiProduct.slug,
      is_active: apiProduct.is_active,
      nutritional_info: apiProduct.nutritional_info || null,
      origin: apiProduct.origin || null,
      brand_id: apiProduct.brand_id || null,
      product_code: apiProduct.product_code || null,
      created_at: apiProduct.created_at,
      updated_at: apiProduct.updated_at,
      // Nested relations
      brand: apiProduct.brand || response.data.brand || undefined,
      variants: response.data.variants || apiProduct.variants || [],
      additional_images: additionalImages,
      // Legacy fields (for backward compatibility)
      price: apiProduct.price,
      sale_price: apiProduct.sale_price,
      stock_count: apiProduct.stock_count,
      image_url: apiProduct.image_url,
      is_featured: apiProduct.is_featured,
      unit_type: apiProduct.unit_type,
      unit: apiProduct.unit,
      badge: apiProduct.badge,
      best_before: apiProduct.best_before,
      hsn_code: apiProduct.hsn_code,
      tax: apiProduct.tax,
    };
  },

  /**
   * Create a new product (catalog-only)
   * Can optionally include variants array for creating product with variants
   */
  async create(productData: CreateProductInput): Promise<Product> {
    // Build request payload - only include catalog fields
    const payload: Record<string, any> = {
      name: productData.name,
      description: productData.description,
      category_id: productData.category_id,
      origin: productData.origin,
      nutritional_info: productData.nutritional_info,
      is_active: productData.is_active ?? true,
    };

    // Add optional fields if provided
    if (productData.brand_id !== undefined) {
      payload.brand_id = productData.brand_id;
    }
    if (productData.slug) {
      payload.slug = productData.slug;
    }
    if (productData.product_code !== undefined) {
      payload.product_code = productData.product_code;
    }
    if (productData.variants && productData.variants.length > 0) {
      payload.variants = productData.variants;
    }

    // Legacy fields (for backward compatibility during migration)
    if (productData.price) payload.price = productData.price;
    if (productData.sale_price !== undefined) payload.sale_price = productData.sale_price;
    if (productData.stock_count) payload.stock_count = productData.stock_count;
    if (productData.warehouse_id) payload.warehouse_id = productData.warehouse_id;
    if (productData.unit_type) payload.unit_type = productData.unit_type;
    if (productData.unit) payload.unit = productData.unit;
    if (productData.image_url) payload.image_url = productData.image_url;
    if (productData.best_before) payload.best_before = productData.best_before;
    if (productData.is_featured !== undefined) payload.is_featured = productData.is_featured;
    if (productData.badge) payload.badge = productData.badge;
    if (productData.hsn_code !== undefined) payload.hsn_code = productData.hsn_code;
    if (productData.tax !== undefined) payload.tax = productData.tax;
    if (productData.additional_images) payload.additional_images = productData.additional_images;

    const { data: response } = await apiClient.post<ApiResponse<Product>>('/products', payload);
    return response.data;
  },

  /**
   * Update an existing product (catalog-only fields)
   * Variant updates should be done via variantsService
   */
  async update(id: string, productData: CreateProductInput): Promise<Product> {
    // Only include catalog fields that are defined and valid
    const formattedData: Record<string, any> = {};
    
    // Core catalog fields
    if (productData.name !== undefined && productData.name !== null) {
      formattedData.name = productData.name;
    }
    if (productData.description !== undefined) {
      formattedData.description = productData.description;
    }
    if (productData.category_id !== undefined) {
      formattedData.category_id = productData.category_id;
    }
    if (productData.brand_id !== undefined) {
      formattedData.brand_id = productData.brand_id;
    }
    if (productData.origin !== undefined) {
      formattedData.origin = productData.origin;
    }
    if (productData.nutritional_info !== undefined) {
      formattedData.nutritional_info = productData.nutritional_info;
    }
    if (productData.is_active !== undefined) {
      formattedData.is_active = productData.is_active;
    }
    if (productData.slug !== undefined && productData.slug !== null) {
      formattedData.slug = productData.slug;
    } else if (productData.name) {
      formattedData.slug = productData.name.toLowerCase().replace(/\s+/g, '-');
    }
    if (productData.product_code !== undefined) {
      formattedData.product_code = (productData.product_code === '' || productData.product_code === null) ? null : productData.product_code;
    }

    // Legacy fields (for backward compatibility during migration)
    if (productData.price !== undefined && productData.price !== null && productData.price !== '') {
      const priceValue = parseFloat(productData.price);
      if (!isNaN(priceValue)) {
        formattedData.price = priceValue;
      }
    }
    if (productData.sale_price !== undefined) {
      if (productData.sale_price === null || productData.sale_price === '') {
        formattedData.sale_price = null;
      } else {
        const salePriceValue = parseFloat(productData.sale_price);
        if (!isNaN(salePriceValue)) {
          formattedData.sale_price = salePriceValue;
        }
      }
    }
    if (productData.stock_count !== undefined && productData.stock_count !== null && productData.stock_count !== '') {
      const stockValue = parseInt(productData.stock_count);
      if (!isNaN(stockValue)) {
        formattedData.stock_count = stockValue;
      }
    }
    if (productData.unit_type !== undefined && productData.unit_type !== null) {
      formattedData.unit_type = productData.unit_type;
    }
    if (productData.unit !== undefined) {
      if (productData.unit === null || productData.unit === '') {
        formattedData.unit = null;
      } else {
        const unitValue = parseFloat(productData.unit);
        if (!isNaN(unitValue)) {
          formattedData.unit = unitValue;
        }
      }
    }
    if (productData.image_url !== undefined) {
      formattedData.image_url = productData.image_url;
    }
    if (productData.best_before !== undefined) {
      formattedData.best_before = productData.best_before;
    }
    if (productData.is_featured !== undefined) {
      formattedData.is_featured = productData.is_featured;
    }
    if (productData.badge !== undefined) {
      formattedData.badge = productData.badge;
    }
    if (productData.hsn_code !== undefined) {
      formattedData.hsn_code = (productData.hsn_code === '' || productData.hsn_code === null) ? null : productData.hsn_code;
    }
    if (productData.tax !== undefined) {
      if (productData.tax === null || productData.tax === '') {
        formattedData.tax = null;
      } else {
        const taxValue = parseFloat(productData.tax);
        if (!isNaN(taxValue) && taxValue >= 0 && taxValue <= 100) {
          formattedData.tax = taxValue;
        }
      }
    }

    const { data: response } = await apiClient.put<ApiResponse<Product>>(`/products/${id}`, formattedData);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/products/${id}`);
  },

  async uploadImage(productId: string, imageFile: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', imageFile);
    
    const { data: response } = await apiClient.post<ApiResponse<string>>(`/products/${productId}/images`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async getProductImages(productId: string): Promise<ProductImage[]> {
    const { data: response } = await apiClient.get<ApiResponse<ProductImage[]>>(`/product-images/${productId}`);
    return response.data;
  },

  async addAdditionalImages(productId: string, imageUrls: string[]): Promise<void> {
    if (!imageUrls.length) return;
    await apiClient.post(`/product-images/${productId}/bulk`, {
      images: imageUrls.map((url, idx) => ({ image_url: url, display_order: idx }))
    });
  }
}; 