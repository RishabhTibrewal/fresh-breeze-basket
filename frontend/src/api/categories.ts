import apiClient from '@/lib/apiClient';
import { API_BASE_URL } from '../config';
import type { ProductCategory } from '@/types/product';

export interface Category {
  id: string;
  name: string;
  slug?: string;
  image_url?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoryData {
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
}

export interface UpdateCategoryData extends Partial<CreateCategoryData> {}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
}

export const categoriesService = {
  async getAll(): Promise<Category[]> {
    const { data: response } = await apiClient.get<ApiResponse<Category[]>>('/categories');
    return response.data;
  },

  async getCategory(id: string): Promise<Category> {
    const { data: response } = await apiClient.get<ApiResponse<Category>>(`/categories/${id}`);
    return response.data;
  },

  async create(data: CreateCategoryData): Promise<Category> {
    const { data: response } = await apiClient.post<ApiResponse<Category>>('/categories', data);
    return response.data;
  },

  async update(id: string, data: UpdateCategoryData): Promise<Category> {
    const { data: response } = await apiClient.put<ApiResponse<Category>>(`/categories/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/categories/${id}`);
  },
};

export const fetchCategories = async (): Promise<ProductCategory[]> => {
  const response = await fetch(`${API_BASE_URL}/api/categories`);
  if (!response.ok) {
    throw new Error('Failed to fetch categories');
  }
  const { data } = await response.json();
  console.log("categories data", data);
  return data;
} 