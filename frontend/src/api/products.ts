import apiClient from '@/lib/apiClient';

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
  created_at: string;
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
}

export interface Product {
  id: string;                          // uuid
  name: string;                        // varchar(255)
  description: string | null;          // text
  price: number;                       // numeric(10,2)
  sale_price: number | null;           // numeric(10,2)
  image_url: string | null;            // text
  category_id: string | null;          // uuid
  slug: string;                        // varchar(255)
  is_featured: boolean;                // boolean
  is_active: boolean;                  // boolean
  stock_count: number;                 // integer
  unit_type: string;                   // varchar(50)
  nutritional_info: string | null;     // text
  origin: string | null;               // varchar(100)
  best_before: string | null;          // date
  created_at: string;                  // timestamp with timezone
  updated_at: string;                  // timestamp with timezone
  unit: number | null;                 // numeric
  badge: string | null;                // text
  additional_images: string[];         // handled separately in product_images table
}

export interface CreateProductInput {
  name: string;
  description: string | null;
  price: string;
  sale_price: string | null;
  stock_count: string;
  category_id: string | null;
  origin: string | null;
  unit: string;
  unit_type: string;
  badge: string | null;
  image_url: string;
  additional_images?: string[]; // handled separately, optional
  nutritional_info: string | null;
  best_before: string | null;
  is_featured: boolean;
  is_active: boolean;
  slug?: string;
}

export interface UpdateProductData extends CreateProductInput {}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
}

export const productsService = {
  async getAll(): Promise<Product[]> {
    const { data: response } = await apiClient.get<ApiResponse<APIProduct[]>>('/products');
    return response.data.map(apiProduct => ({
      id: apiProduct.id,
      name: apiProduct.name,
      description: apiProduct.description || '',
      price: apiProduct.price,
      sale_price: apiProduct.sale_price,
      stock_count: apiProduct.stock_count,
      category_id: apiProduct.category_id,
      slug: apiProduct.slug,
      is_featured: apiProduct.is_featured,
      is_active: apiProduct.is_active,
      origin: apiProduct.origin || '',
      unit: apiProduct.unit || 1,
      unit_type: apiProduct.unit_type,
      badge: apiProduct.badge,
      image_url: apiProduct.image_url || '',
      additional_images: [],
      created_at: apiProduct.created_at,
      updated_at: apiProduct.updated_at,
      nutritional_info: apiProduct.nutritional_info,
      best_before: apiProduct.best_before
    }));
  },

  async getById(id: string): Promise<Product> {
    const { data: response } = await apiClient.get<ApiResponse<APIProduct>>(`/products/${id}`);
    const apiProduct = response.data;
    const { data: imagesResponse } = await apiClient.get<ApiResponse<ProductImage[]>>(`/product-images/${id}`);
    
    const additionalImages = imagesResponse.data
      .sort((a, b) => a.display_order - b.display_order)
      .map(img => img.image_url);

    return {
      id: apiProduct.id,
      name: apiProduct.name,
      description: apiProduct.description || '',
      price: apiProduct.price,
      sale_price: apiProduct.sale_price,
      stock_count: apiProduct.stock_count,
      category_id: apiProduct.category_id,
      slug: apiProduct.slug,
      is_featured: apiProduct.is_featured,
      is_active: apiProduct.is_active,
      origin: apiProduct.origin || '',
      unit: apiProduct.unit || 1,
      unit_type: apiProduct.unit_type,
      badge: apiProduct.badge,
      image_url: apiProduct.image_url || '',
      additional_images: additionalImages,
      created_at: apiProduct.created_at,
      updated_at: apiProduct.updated_at,
      nutritional_info: apiProduct.nutritional_info,
      best_before: apiProduct.best_before
    };
  },

  async create(productData: CreateProductInput): Promise<Product> {
    const { data: response } = await apiClient.post<ApiResponse<Product>>('/products', {
      ...productData,
      price: productData.price,
      sale_price: productData.sale_price,
      stock_count: productData.stock_count,
      category_id: productData.category_id,
      unit_type: productData.unit_type,
      unit: productData.unit,
      image_url: productData.image_url,
      nutritional_info: productData.nutritional_info,
      best_before: productData.best_before,
      is_featured: productData.is_featured,
      is_active: productData.is_active ?? true
    });
    return response.data;
  },

  async update(id: string, productData: CreateProductInput): Promise<Product> {
    const formattedData = {
      name: productData.name,
      description: productData.description,
      price: parseFloat(productData.price),
      sale_price: productData.sale_price ? parseFloat(productData.sale_price) : null,
      stock_count: parseInt(productData.stock_count),
      category_id: productData.category_id,
      unit_type: productData.unit_type,
      unit: productData.unit ? parseFloat(productData.unit) : null,
      image_url: productData.image_url,
      nutritional_info: productData.nutritional_info || null,
      best_before: productData.best_before || null,
      is_featured: productData.is_featured || false,
      is_active: productData.is_active ?? true,
      badge: productData.badge || null,
      origin: productData.origin || '',
      slug: productData.name?.toLowerCase().replace(/\s+/g, '-'),
    };

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