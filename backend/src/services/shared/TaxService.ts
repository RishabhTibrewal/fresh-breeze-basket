import { supabaseAdmin } from '../../lib/supabase';

/**
 * TaxService - Handles tax calculations and tax management
 * Industry-agnostic tax service
 */
export class TaxService {
  private companyId: string;

  constructor(companyId: string) {
    this.companyId = companyId;
  }

  /**
   * Get active tax rate by code (e.g., "GST", "VAT")
   */
  async getTaxRate(code: string): Promise<number> {
    try {
      const { data, error } = await supabaseAdmin
        .from('taxes')
        .select('rate')
        .eq('company_id', this.companyId)
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) {
        return 0;
      }

      return parseFloat(data.rate.toString());
    } catch (error) {
      console.error('Error getting tax rate:', error);
      return 0;
    }
  }

  /**
   * Calculate tax amount for a given amount and tax rate
   */
  calculateTax(amount: number, taxRate: number): number {
    return Math.round((amount * taxRate / 100) * 100) / 100;
  }

  /**
   * Calculate tax amount using variant's tax_id
   * Falls back to product's tax field for backward compatibility
   */
  async calculateTaxForVariant(
    variantId: string,
    amount: number
  ): Promise<number> {
    try {
      // Get variant with tax_id
      const { data: variant } = await supabaseAdmin
        .from('product_variants')
        .select('tax_id, product:products(tax)')
        .eq('id', variantId)
        .maybeSingle();

      if (!variant) {
        return 0;
      }

      // If variant has tax_id, use it
      if (variant.tax_id) {
        const { data: tax } = await supabaseAdmin
          .from('taxes')
          .select('rate')
          .eq('id', variant.tax_id)
          .eq('is_active', true)
          .maybeSingle();

        if (tax) {
          const taxRate = parseFloat(tax.rate.toString());
          return this.calculateTax(amount, taxRate);
        }
      }

      // Fallback to product tax (backward compatibility)
      const productTax = Array.isArray(variant.product) 
        ? (variant.product[0] as any)?.tax 
        : (variant.product as any)?.tax;
      
      if (productTax) {
        const taxRate = parseFloat(productTax.toString());
        return this.calculateTax(amount, taxRate);
      }

      return 0;
    } catch (error) {
      console.error('Error calculating tax for variant:', error);
      return 0;
    }
  }

  /**
   * Calculate tax amount using product's tax field (backward compatibility)
   * @deprecated Use calculateTaxForVariant instead
   */
  async calculateTaxForProduct(
    productId: string,
    amount: number
  ): Promise<number> {
    try {
      // Get product tax percentage
      const { data: product } = await supabaseAdmin
        .from('products')
        .select('tax')
        .eq('id', productId)
        .maybeSingle();

      if (!product || !product.tax) {
        return 0;
      }

      const taxRate = parseFloat(product.tax.toString());
      return this.calculateTax(amount, taxRate);
    } catch (error) {
      console.error('Error calculating tax for product:', error);
      return 0;
    }
  }

  /**
   * Get all active taxes for the company
   */
  async getActiveTaxes(): Promise<Array<{ id: string; name: string; code: string; rate: number }>> {
    try {
      const { data, error } = await supabaseAdmin
        .from('taxes')
        .select('id, name, code, rate')
        .eq('company_id', this.companyId)
        .eq('is_active', true)
        .order('name');

      if (error || !data) {
        return [];
      }

      return data.map(tax => ({
        id: tax.id,
        name: tax.name,
        code: tax.code,
        rate: parseFloat(tax.rate.toString()),
      }));
    } catch (error) {
      console.error('Error getting active taxes:', error);
      return [];
    }
  }

  /**
   * Create a new tax
   */
  async createTax(data: { name: string; code: string; rate: number; is_active?: boolean }): Promise<any> {
    console.log('Creating tax with data:', { ...data, company_id: this.companyId });
    
    const { data: tax, error } = await supabaseAdmin
      .from('taxes')
      .insert({
        name: data.name,
        code: data.code,
        rate: data.rate,
        company_id: this.companyId,
        is_active: data.is_active !== undefined ? data.is_active : true,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating tax:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      
      // Handle duplicate key constraint violation
      if (error.code === '23505') {
        const duplicateError: any = new Error(`A tax with code "${data.code}" already exists for this company`);
        duplicateError.statusCode = 409;
        duplicateError.isDuplicate = true;
        throw duplicateError;
      }
      
      throw new Error(`Failed to create tax: ${error.message}${error.details ? ` - ${error.details}` : ''}${error.hint ? ` (${error.hint})` : ''}`);
    }

    return tax;
  }

  /**
   * Update an existing tax
   */
  async updateTax(id: string, data: Partial<{ name: string; code: string; rate: number; is_active: boolean }>): Promise<any> {
    const { data: tax, error } = await supabaseAdmin
      .from('taxes')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', this.companyId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update tax: ${error.message}`);
    }

    return tax;
  }

  /**
   * Delete a tax
   */
  async deleteTax(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('taxes')
      .delete()
      .eq('id', id)
      .eq('company_id', this.companyId);

    if (error) {
      throw new Error(`Failed to delete tax: ${error.message}`);
    }
  }
}

