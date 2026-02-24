import { supabaseAdmin } from '../../lib/supabase';
import { TaxService } from '../shared/TaxService';

/**
 * PricingService - Handles product pricing logic
 * Supports outlet-specific pricing, variant pricing, and time-based pricing
 */
export class PricingService {
  private companyId: string;
  private taxService: TaxService;

  constructor(companyId: string) {
    this.companyId = companyId;
    this.taxService = new TaxService(companyId);
  }

  /**
   * Get product price considering variants, outlet, and price type
   * Returns sale_price only (for backward compatibility)
   * 
   * Price Resolution Priority:
   * 1. product_prices with variant_id + price_type + outlet_id (most specific)
   * 2. product_prices with variant_id + price_type + outlet_id IS NULL (variant-specific, all outlets)
   * 3. product_prices with product_id + price_type + outlet_id (product-level, outlet-specific)
   * 4. product_prices with product_id + price_type + outlet_id IS NULL (product-level, all outlets)
   * 5. product.price (fallback to product base price)
   * 
   * NOTE: Every variant MUST have a standard price entry in product_prices table.
   * This method uses product_prices exclusively - no fallback to price_override.
   */
  async getProductPrice(
    productId: string,
    variantId: string | null = null,
    outletId: string | null = null,
    priceType: string = 'standard'
  ): Promise<number> {
    const prices = await this.getProductPrices(productId, variantId, outletId, priceType);
    return prices.sale_price;
  }

  /**
   * Get both MRP and sale price considering variants, outlet, and price type
   * 
   * Price Resolution Priority:
   * 1. product_prices with variant_id + price_type + outlet_id (most specific)
   * 2. product_prices with variant_id + price_type + outlet_id IS NULL (variant-specific, all outlets)
   * 3. product_prices with product_id + price_type + outlet_id (product-level, outlet-specific)
   * 4. product_prices with product_id + price_type + outlet_id IS NULL (product-level, all outlets)
   * 5. product.price (fallback to product base price)
   * 
   * @returns Object with mrp_price and sale_price
   */
  async getProductPrices(
    productId: string,
    variantId: string | null = null,
    outletId: string | null = null,
    priceType: string = 'standard'
  ): Promise<{ mrp_price: number; sale_price: number }> {
    try {
      const now = new Date().toISOString();

      // Priority 1: Try variant-specific price with outlet_id
      if (variantId && outletId) {
        const { data: priceData } = await supabaseAdmin
          .from('product_prices')
          .select('mrp_price, sale_price')
          .eq('variant_id', variantId)
          .eq('price_type', priceType)
          .eq('outlet_id', outletId)
          .eq('company_id', this.companyId)
          .lte('valid_from', now)
          .or(`valid_until.is.null,valid_until.gte.${now}`)
          .maybeSingle();

        if (priceData) {
          return {
            mrp_price: parseFloat(priceData.mrp_price.toString()),
            sale_price: parseFloat(priceData.sale_price.toString()),
          };
        }
      }

      // Priority 2: Try variant-specific price (all outlets)
      if (variantId) {
        const { data: priceData } = await supabaseAdmin
          .from('product_prices')
          .select('mrp_price, sale_price')
          .eq('variant_id', variantId)
          .eq('price_type', priceType)
          .is('outlet_id', null)
          .eq('company_id', this.companyId)
          .lte('valid_from', now)
          .or(`valid_until.is.null,valid_until.gte.${now}`)
          .maybeSingle();

        if (priceData) {
          return {
            mrp_price: parseFloat(priceData.mrp_price.toString()),
            sale_price: parseFloat(priceData.sale_price.toString()),
          };
        }
      }

      // Priority 3: Try product-level price with outlet_id
      if (outletId) {
        const { data: priceData } = await supabaseAdmin
          .from('product_prices')
          .select('mrp_price, sale_price')
          .eq('product_id', productId)
          .is('variant_id', null)
          .eq('price_type', priceType)
          .eq('outlet_id', outletId)
          .eq('company_id', this.companyId)
          .lte('valid_from', now)
          .or(`valid_until.is.null,valid_until.gte.${now}`)
          .maybeSingle();

        if (priceData) {
          return {
            mrp_price: parseFloat(priceData.mrp_price.toString()),
            sale_price: parseFloat(priceData.sale_price.toString()),
          };
        }
      }

      // Priority 4: Try product-level price (all outlets)
      const { data: priceData } = await supabaseAdmin
        .from('product_prices')
        .select('mrp_price, sale_price')
        .eq('product_id', productId)
        .is('variant_id', null)
        .eq('price_type', priceType)
        .is('outlet_id', null)
        .eq('company_id', this.companyId)
        .lte('valid_from', now)
        .or(`valid_until.is.null,valid_until.gte.${now}`)
        .maybeSingle();

      if (priceData) {
        return {
          mrp_price: parseFloat(priceData.mrp_price.toString()),
          sale_price: parseFloat(priceData.sale_price.toString()),
        };
      }

      // Priority 5: Fall back to product base price
      const { data: product } = await supabaseAdmin
        .from('products')
        .select('sale_price, price')
        .eq('id', productId)
        .eq('company_id', this.companyId)
        .maybeSingle();

      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }

      // Prefer sale_price over price, use same value for MRP if not available
      const salePrice = parseFloat((product.sale_price || product.price).toString());
      return {
        mrp_price: salePrice, // Default MRP to sale price if not in product_prices
        sale_price: salePrice,
      };
    } catch (error) {
      console.error('Error getting product prices:', error);
      throw error;
    }
  }

  /**
   * Calculate line total (quantity * unit_price + tax)
   * Uses variant tax_id if variantId is provided, otherwise falls back to product tax
   */
  async calculateLineTotal(
    productId: string,
    quantity: number,
    unitPrice: number,
    variantId: string | null = null
  ): Promise<{ subtotal: number; taxAmount: number; total: number }> {
    const subtotal = quantity * unitPrice;
    
    // Use variant tax_id if variantId is provided, otherwise use product tax (backward compatibility)
    let taxAmount: number;
    if (variantId) {
      taxAmount = await this.taxService.calculateTaxForVariant(variantId, subtotal);
    } else {
      taxAmount = await this.taxService.calculateTaxForProduct(productId, subtotal);
    }
    
    const total = subtotal + taxAmount;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }

  /**
   * Validate price matches current product/variant price
   * Used to prevent price manipulation
   */
  async validatePrice(
    productId: string,
    variantId: string | null,
    outletId: string | null,
    providedPrice: number
  ): Promise<boolean> {
    try {
      const currentPrice = await this.getProductPrice(productId, variantId, outletId);
      // Allow small rounding differences (0.01)
      return Math.abs(currentPrice - providedPrice) < 0.02;
    } catch (error) {
      console.error('Error validating price:', error);
      return false;
    }
  }
}

