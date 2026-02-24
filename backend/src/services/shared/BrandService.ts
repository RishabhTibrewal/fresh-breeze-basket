import { supabaseAdmin } from '../../lib/supabase';
import { ApiError } from '../../middleware/error';

/**
 * BrandService - Handles brand management
 * Multi-tenant brand service with company isolation
 */
export class BrandService {
  private companyId: string;

  constructor(companyId: string) {
    this.companyId = companyId;
  }

  /**
   * Generate a URL-friendly slug from brand name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-'); // Replace multiple hyphens with single hyphen
  }

  /**
   * Check if slug is unique within company
   */
  async isSlugUnique(slug: string, excludeId?: string): Promise<boolean> {
    try {
      let query = supabaseAdmin
        .from('brands')
        .select('id')
        .eq('company_id', this.companyId)
        .eq('slug', slug);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query.maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return !data; // Return true if no brand found (slug is unique)
    } catch (error) {
      console.error('Error checking slug uniqueness:', error);
      throw new ApiError(500, 'Failed to check slug uniqueness');
    }
  }

  /**
   * Create a new brand
   */
  async createBrand(data: {
    name: string;
    slug?: string | null;
    legal_name?: string | null;
    logo_url?: string | null;
    is_active?: boolean;
  }): Promise<any> {
    try {
      if (!data.name || data.name.trim() === '') {
        throw new ApiError(400, 'Brand name is required');
      }

      // Generate slug if not provided
      let slug = data.slug || this.generateSlug(data.name);

      // Ensure slug is unique
      let slugCounter = 1;
      const originalSlug = slug;
      while (!(await this.isSlugUnique(slug))) {
        slug = `${originalSlug}-${slugCounter}`;
        slugCounter++;
      }

      const { data: brand, error } = await supabaseAdmin
        .from('brands')
        .insert({
          company_id: this.companyId,
          name: data.name.trim(),
          slug,
          legal_name: data.legal_name || null,
          logo_url: data.logo_url || null,
          is_active: data.is_active !== undefined ? data.is_active : true,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating brand:', error);
        if (error.code === '23505') {
          throw new ApiError(
            409,
            `Brand with slug '${slug}' already exists. Please use a different name or slug.`
          );
        }
        throw new ApiError(500, `Failed to create brand: ${error.message}`);
      }

      return brand;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'Failed to create brand');
    }
  }

  /**
   * Get brand by ID
   */
  async getBrandById(brandId: string): Promise<any> {
    try {
      const { data, error } = await supabaseAdmin
        .from('brands')
        .select('*')
        .eq('id', brandId)
        .eq('company_id', this.companyId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new ApiError(
            404,
            `Brand with ID '${brandId}' not found or does not belong to your company. Please select a valid brand.`
          );
        }
        throw new ApiError(500, `Failed to fetch brand: ${error.message}`);
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'Failed to fetch brand');
    }
  }

  /**
   * Get all brands for company
   */
  async getBrands(filters?: {
    is_active?: boolean;
    search?: string;
  }): Promise<any[]> {
    try {
      let query = supabaseAdmin
        .from('brands')
        .select('*')
        .eq('company_id', this.companyId)
        .order('name', { ascending: true });

      if (filters?.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,legal_name.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) {
        throw new ApiError(500, `Failed to fetch brands: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'Failed to fetch brands');
    }
  }

  /**
   * Update brand
   */
  async updateBrand(
    brandId: string,
    data: {
      name?: string;
      slug?: string | null;
      legal_name?: string | null;
      logo_url?: string | null;
      is_active?: boolean;
    }
  ): Promise<any> {
    try {
      // Check if brand exists
      const existingBrand = await this.getBrandById(brandId);

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      // Handle name update - regenerate slug if name changes
      if (data.name !== undefined && data.name !== existingBrand.name) {
        updateData.name = data.name.trim();
        // Regenerate slug if name changes and slug not explicitly provided
        if (data.slug === undefined) {
          let newSlug = this.generateSlug(data.name);
          let slugCounter = 1;
          const originalSlug = newSlug;
          while (!(await this.isSlugUnique(newSlug, brandId))) {
            newSlug = `${originalSlug}-${slugCounter}`;
            slugCounter++;
          }
          updateData.slug = newSlug;
        }
      }

      if (data.slug !== undefined) {
        // Validate slug uniqueness if provided
        if (data.slug && !(await this.isSlugUnique(data.slug, brandId))) {
          throw new ApiError(
            409,
            `Brand with slug '${data.slug}' already exists. Please use a different slug.`
          );
        }
        updateData.slug = data.slug || null;
      }

      if (data.legal_name !== undefined) {
        updateData.legal_name = data.legal_name || null;
      }

      if (data.logo_url !== undefined) {
        updateData.logo_url = data.logo_url || null;
      }

      if (data.is_active !== undefined) {
        updateData.is_active = data.is_active;
      }

      const { data: brand, error } = await supabaseAdmin
        .from('brands')
        .update(updateData)
        .eq('id', brandId)
        .eq('company_id', this.companyId)
        .select()
        .single();

      if (error) {
        console.error('Error updating brand:', error);
        if (error.code === '23505') {
          throw new ApiError(
            409,
            `Brand with slug '${updateData.slug}' already exists. Please use a different slug.`
          );
        }
        throw new ApiError(500, `Failed to update brand: ${error.message}`);
      }

      return brand;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'Failed to update brand');
    }
  }

  /**
   * Delete brand (soft delete by default, hard delete if no variants reference it)
   */
  async deleteBrand(brandId: string, force?: boolean): Promise<void> {
    try {
      // Check if brand exists
      const brand = await this.getBrandById(brandId);

      // Check if any variants reference this brand
      const { data: variants, error: variantsError } = await supabaseAdmin
        .from('product_variants')
        .select('id, name, product:products(name)')
        .eq('brand_id', brandId)
        .eq('company_id', this.companyId)
        .limit(10);

      if (variantsError) {
        throw new ApiError(500, `Failed to check brand usage: ${variantsError.message}`);
      }

      const variantCount = variants?.length || 0;

      if (variantCount > 0 && !force) {
        // Soft delete - set is_active to false
        await this.updateBrand(brandId, { is_active: false });
        throw new ApiError(
          400,
          `Cannot delete brand '${brand.name}': ${variantCount} variant(s) reference this brand. The brand has been deactivated instead. To permanently delete, update or remove the variants first, or use force delete.`
        );
      }

      // Hard delete if no variants reference it or force is true
      const { error } = await supabaseAdmin
        .from('brands')
        .delete()
        .eq('id', brandId)
        .eq('company_id', this.companyId);

      if (error) {
        throw new ApiError(500, `Failed to delete brand: ${error.message}`);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'Failed to delete brand');
    }
  }

  /**
   * Get all products/variants for a brand
   */
  async getBrandProducts(brandId: string): Promise<any[]> {
    try {
      // Verify brand exists
      await this.getBrandById(brandId);

      const { data, error } = await supabaseAdmin
        .from('product_variants')
        .select(
          `
          id,
          name,
          sku,
          is_active,
          product:products (
            id,
            name,
            description,
            category_id
          )
        `
        )
        .eq('brand_id', brandId)
        .eq('company_id', this.companyId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new ApiError(500, `Failed to fetch brand products: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'Failed to fetch brand products');
    }
  }
}

