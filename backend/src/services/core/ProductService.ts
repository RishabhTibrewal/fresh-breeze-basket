import { supabaseAdmin } from '../../lib/supabase';
import { ApiError } from '../../middleware/error';

/**
 * ProductService - Handles product and variant creation
 * 
 * CORE RULE: Every product MUST have at least one variant (DEFAULT variant)
 * This ensures consistency and eliminates conditional logic throughout the system.
 * 
 * Why mandatory variants?
 * - Consistency: No "if variant exists" logic needed
 * - Future-proof: Restaurant items (Small Pizza, Large Pizza) are naturally variants
 * - Inventory accuracy: Clear warehouse × product × variant tracking
 */
export class ProductService {
  private companyId: string;

  constructor(companyId: string) {
    this.companyId = companyId;
  }

  /**
   * Create a product with automatic DEFAULT variant creation
   * 
   * If variants are provided, DEFAULT variant is still created.
   * Only one variant can be marked as default (enforced by database constraint).
   * 
   * Every variant gets a standard price entry in product_prices table.
   * 
   * @param productData - Product data (name, price, description, etc.)
   * @param variants - Optional array of variant data (name, sku, price amount for standard price)
   * @param initialWarehouseId - Optional warehouse ID for initial inventory seeding
   * @param initialStock - Optional initial stock count (defaults to 0)
   * @returns Created product with variants
   */
  async createProduct(
    productData: {
      name: string;
      price?: number; // Optional - defaults to 0 (pricing managed at variant level)
      description?: string | null;
      sale_price?: number | null;
      category_id?: string | null;
      image_url?: string | null; // Deprecated: use variant-level image_url
      slug?: string | null;
      is_featured?: boolean; // Deprecated: use variant-level is_featured
      is_active?: boolean;
      unit_type?: string; // Deprecated: use variant-level unit_type
      nutritional_info?: any;
      origin?: string | null;
      best_before?: string | null; // Deprecated: use variant-level best_before
      unit?: string | null; // Deprecated: use variant-level unit
      badge?: string | null; // Deprecated: use variant-level badge
      product_code?: string | null;
      hsn_code?: string | null; // Deprecated: use variant-level hsn
      tax?: number | null; // Deprecated: use variant-level tax_id
      brand_id?: string | null; // Product-level brand
    },
    variants?: Array<{
      name: string;
      sku?: string | null;
      price?: number | null; // Standard sale_price amount (defaults to product.price)
      mrp_price?: number | null; // MRP price (defaults to sale_price if not provided)
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
    }>,
    initialWarehouseId?: string | null,
    initialStock: number = 0
  ): Promise<{ product: any; defaultVariant: any; variants: any[] }> {
    // Validate required fields
    if (!productData.name) {
      throw new ApiError(400, 'Product name is required');
    }

    // Price is optional - default to 0 if not provided (pricing is managed at variant level)
    const productPrice = productData.price !== undefined && productData.price !== null 
      ? productData.price 
      : 0;

    // Generate slug if not provided
    const slug = productData.slug || productData.name.toLowerCase().replace(/\s+/g, '-');

    // Validate brand_id if provided
    if (productData.brand_id) {
      const { data: brand, error: brandError } = await supabaseAdmin
        .from('brands')
        .select('id')
        .eq('id', productData.brand_id)
        .eq('company_id', this.companyId)
        .single();

      if (brandError || !brand) {
        throw new ApiError(
          404,
          `Brand with ID '${productData.brand_id}' not found or does not belong to your company. Please select a valid brand.`
        );
      }
    }

    // Create product
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .insert({
        name: productData.name,
        description: productData.description || null,
        price: productPrice,
        sale_price: productData.sale_price || null,
        category_id: productData.category_id || null,
        image_url: productData.image_url || null,
        slug,
        is_featured: productData.is_featured || false,
        is_active: productData.is_active !== undefined ? productData.is_active : true,
        stock_count: 0, // Stock is managed in warehouse_inventory
        unit_type: productData.unit_type || 'piece',
        nutritional_info: productData.nutritional_info || null,
        origin: productData.origin || null,
        best_before: productData.best_before || null,
        unit: productData.unit || null,
        badge: productData.badge || null,
        product_code: productData.product_code || null,
        hsn_code: productData.hsn_code || null,
        brand_id: productData.brand_id || null,
        // Note: tax_id is not set at product level - it's variant-specific
        company_id: this.companyId,
      })
      .select()
      .single();

    if (productError) {
      console.error('Error creating product:', productError);
      throw new ApiError(500, `Failed to create product: ${productError.message}`);
    }

    // Always create DEFAULT variant (with standard price entry)
    // Use product-level fields for default variant if variant-level fields not provided
    const defaultVariantData = {
      image_url: productData.image_url || null,
      is_featured: productData.is_featured || false,
      is_active: productData.is_active !== undefined ? productData.is_active : true,
      unit: productData.unit ? parseFloat(productData.unit.toString()) : null,
      unit_type: productData.unit_type || 'piece',
      best_before: productData.best_before || null,
      // Note: tax_id is not set at product level - it's variant-specific
      hsn: productData.hsn_code || null,
      badge: productData.badge || null,
      brand_id: null, // Default variant doesn't have brand_id from product level
    };
    const defaultVariant = await this.ensureDefaultVariant(
      product.id, 
      productPrice,
      defaultVariantData
    );

    // Create additional variants if provided (each with standard price entry)
    const createdVariants = [defaultVariant];
    if (variants && variants.length > 0) {
      for (const variantData of variants) {
        const variantSalePrice = variantData.price !== undefined && variantData.price !== null 
          ? variantData.price 
          : productPrice;
        const variantMrpPrice = variantData.mrp_price !== undefined && variantData.mrp_price !== null
          ? variantData.mrp_price
          : variantSalePrice;
        const variant = await this.createVariant(product.id, {
          name: variantData.name,
          sku: variantData.sku,
          sale_price: variantSalePrice,
          mrp_price: variantMrpPrice,
          image_url: variantData.image_url,
          is_featured: variantData.is_featured,
          is_active: variantData.is_active,
          unit: variantData.unit,
          unit_type: variantData.unit_type,
          best_before: variantData.best_before,
          tax_id: variantData.tax_id,
          hsn: variantData.hsn,
          badge: variantData.badge,
          brand_id: variantData.brand_id,
        });
        createdVariants.push(variant);
      }
    }

    // Seed initial inventory for DEFAULT variant if warehouse is provided
    if (initialWarehouseId && initialStock > 0) {
      await supabaseAdmin
        .from('warehouse_inventory')
        .upsert({
          warehouse_id: initialWarehouseId,
          product_id: product.id,
          variant_id: defaultVariant.id,
          stock_count: initialStock,
          reserved_stock: 0,
          company_id: this.companyId,
        }, {
          onConflict: 'warehouse_id,product_id,variant_id',
        });
    } else if (initialWarehouseId) {
      // Create inventory record with 0 stock
      await supabaseAdmin
        .from('warehouse_inventory')
        .upsert({
          warehouse_id: initialWarehouseId,
          product_id: product.id,
          variant_id: defaultVariant.id,
          stock_count: 0,
          reserved_stock: 0,
          company_id: this.companyId,
        }, {
          onConflict: 'warehouse_id,product_id,variant_id',
        });
    }

    return {
      product,
      defaultVariant,
      variants: createdVariants,
    };
  }

  /**
   * Ensure product has exactly one DEFAULT variant with standard price entry
   * Creates DEFAULT variant and its standard price entry if they don't exist
   * 
   * @param productId - Product ID
   * @param productPrice - Product base price (used for standard price if variant doesn't have one)
   * @param variantFields - Optional variant-level fields (image_url, is_featured, etc.)
   * @returns Default variant (created or existing) with price_id set
   */
  async ensureDefaultVariant(
    productId: string, 
    productPrice: number,
    variantFields?: {
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
    }
  ): Promise<any> {
    // Check if default variant already exists
    const { data: existingDefault, error: checkError } = await supabaseAdmin
      .from('product_variants')
      .select('*, price:product_prices!price_id(*)')
      .eq('product_id', productId)
      .eq('is_default', true)
      .eq('company_id', this.companyId)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking for default variant:', checkError);
      throw new ApiError(500, `Failed to check for default variant: ${checkError.message}`);
    }

    if (existingDefault) {
      // Ensure variant has a price_id and standard price entry
      if (!existingDefault.price_id) {
        const standardPrice = await this.createStandardPriceForVariant(
          productId,
          existingDefault.id,
          productPrice,
          productPrice, // Use same price for MRP
          variantFields?.brand_id || null
        );
        // Update variant with price_id
        const { data: updatedVariant, error: updateError } = await supabaseAdmin
          .from('product_variants')
          .update({ price_id: standardPrice.id })
          .eq('id', existingDefault.id)
          .select()
          .single();

        if (updateError) {
          throw new ApiError(500, `Failed to link price to variant: ${updateError.message}`);
        }
        return updatedVariant;
      }
      return existingDefault;
    }

    // Get product to generate SKU, get price, and check active status
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('product_code, id, price, is_active')
      .eq('id', productId)
      .eq('company_id', this.companyId)
      .single();

    if (productError) {
      console.error('Error fetching product for variant creation:', productError);
      throw new ApiError(404, `Product ${productId} not found`);
    }

    // Determine variant active status: can only be true if product is active
    let variantActiveStatus = false;
    if (variantFields?.is_active !== undefined) {
      // If explicitly set to true, check product is active
      if (variantFields.is_active === true && product.is_active !== true) {
        // Product is inactive, so variant must be inactive
        variantActiveStatus = false;
      } else {
        variantActiveStatus = variantFields.is_active && product.is_active === true;
      }
    } else {
      // Default to product's active status
      variantActiveStatus = product.is_active === true;
    }

    // Generate SKU for DEFAULT variant
    const sku = product.product_code 
      ? `${product.product_code}-DEFAULT`
      : `${productId.substring(0, 8)}-DEFAULT`;

    // Create standard price entry first (with variant_id = null initially)
    // This is necessary because price_id is NOT NULL in product_variants
    const standardPrice = await this.createStandardPriceForVariant(
      productId,
      null, // variant_id will be set after variant is created
      productPrice,
      productPrice, // Use same price for MRP
      variantFields?.brand_id || null
    );

    // Create DEFAULT variant with price_id
    const { data: defaultVariant, error: variantError } = await supabaseAdmin
      .from('product_variants')
      .insert({
        product_id: productId,
        name: 'DEFAULT',
        sku,
        is_default: true,
        image_url: variantFields?.image_url || null,
        is_featured: variantFields?.is_featured || false,
        is_active: variantActiveStatus,
        unit: variantFields?.unit || null,
        unit_type: variantFields?.unit_type || 'piece',
        best_before: variantFields?.best_before || null,
        tax_id: variantFields?.tax_id || null,
        hsn: variantFields?.hsn || null,
        badge: variantFields?.badge || null,
        brand_id: variantFields?.brand_id || null,
        price_id: standardPrice.id, // Set price_id immediately
        company_id: this.companyId,
      })
      .select()
      .single();

    if (variantError) {
      // Rollback: delete price if variant creation fails
      await supabaseAdmin.from('product_prices').delete().eq('id', standardPrice.id);
      console.error('Error creating default variant:', variantError);
      throw new ApiError(500, `Failed to create default variant: ${variantError.message}`);
    }

    // Update price entry with variant_id to link them
    const { error: updatePriceError } = await supabaseAdmin
      .from('product_prices')
      .update({ variant_id: defaultVariant.id })
      .eq('id', standardPrice.id);

    if (updatePriceError) {
      // Rollback: delete variant and price if update fails
      await supabaseAdmin.from('product_variants').delete().eq('id', defaultVariant.id);
      await supabaseAdmin.from('product_prices').delete().eq('id', standardPrice.id);
      console.error('Error linking variant to price:', updatePriceError);
      throw new ApiError(500, `Failed to link variant to price: ${updatePriceError.message}`);
    }

    // Fetch the complete variant with price info
    const { data: finalVariant, error: fetchError } = await supabaseAdmin
      .from('product_variants')
      .select('*')
      .eq('id', defaultVariant.id)
      .single();

    if (fetchError) {
      throw new ApiError(500, `Failed to fetch created variant: ${fetchError.message}`);
    }

    return finalVariant;
  }

  /**
   * Create a standard price entry for a variant
   * 
   * @param productId - Product ID
   * @param variantId - Variant ID (can be NULL if creating price before variant)
   * @param salePrice - Sale price amount
   * @param mrpPrice - MRP price amount (defaults to salePrice if not provided)
   * @param brandId - Optional brand ID
   * @returns Created product_price entry
   */
  private async createStandardPriceForVariant(
    productId: string,
    variantId: string | null,
    salePrice: number,
    mrpPrice?: number | null,
    brandId?: string | null
  ): Promise<any> {
    const mrp = mrpPrice !== undefined && mrpPrice !== null ? mrpPrice : salePrice;
    
    const { data: price, error: priceError } = await supabaseAdmin
      .from('product_prices')
      .insert({
        product_id: productId,
        variant_id: variantId,
        outlet_id: null, // NULL = applies to all outlets
        price_type: 'standard',
        sale_price: salePrice,
        mrp_price: mrp,
        brand_id: brandId || null,
        company_id: this.companyId,
      })
      .select()
      .single();

    if (priceError) {
      console.error('Error creating standard price:', priceError);
      throw new ApiError(500, `Failed to create standard price: ${priceError.message}`);
    }

    return price;
  }

  /**
   * Get the default variant for a product
   * 
   * @param productId - Product ID
   * @returns Default variant with price_id set
   */
  async getDefaultVariant(productId: string): Promise<any> {
    // Get product price for fallback
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('price')
      .eq('id', productId)
      .eq('company_id', this.companyId)
      .single();

    if (productError) {
      throw new ApiError(404, `Product ${productId} not found`);
    }

    const productPrice = product?.price || 0;

    const { data: defaultVariant, error } = await supabaseAdmin
      .from('product_variants')
      .select('*')
      .eq('product_id', productId)
      .eq('is_default', true)
      .eq('company_id', this.companyId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching default variant:', error);
      throw new ApiError(500, `Failed to fetch default variant: ${error.message}`);
    }

    if (!defaultVariant) {
      // If no default variant exists, create one
      return await this.ensureDefaultVariant(productId, productPrice);
    }

    // Ensure variant has price_id
    if (!defaultVariant.price_id) {
      return await this.ensureDefaultVariant(productId, productPrice);
    }

    return defaultVariant;
  }

  /**
   * Create an additional variant (non-default) with standard price entry
   * 
   * @param productId - Product ID
   * @param variantData - Variant data (name, sku, sale_price, mrp_price, and variant-level fields)
   * @returns Created variant with price_id set
   */
  async createVariant(
    productId: string,
    variantData: {
      name: string;
      sku?: string | null;
      sale_price?: number | null; // Standard sale price (defaults to product.price)
      mrp_price?: number | null; // MRP price (defaults to sale_price)
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
    }
  ): Promise<any> {
    if (!variantData.name) {
      throw new ApiError(400, 'Variant name is required');
    }

    // Ensure product exists and get price and active status
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id, price, is_active')
      .eq('id', productId)
      .eq('company_id', this.companyId)
      .single();

    if (productError) {
      throw new ApiError(404, `Product ${productId} not found`);
    }

    // Determine variant active status: can only be true if product is active
    let variantActiveStatus = false;
    if (variantData.is_active !== undefined) {
      // If explicitly set to true, check product is active
      if (variantData.is_active === true && product.is_active !== true) {
        throw new ApiError(400, 'Cannot create active variant: product is inactive. Activate the product first.');
      }
      variantActiveStatus = variantData.is_active && product.is_active === true;
    } else {
      // Default to product's active status
      variantActiveStatus = product.is_active === true;
    }

    // Use provided sale_price or fallback to product price
    const variantSalePrice = variantData.sale_price || product.price;
    const variantMrpPrice = variantData.mrp_price || variantSalePrice;

    // Create standard price entry first (with variant_id = null initially)
    // This is necessary because price_id is NOT NULL in product_variants
    const standardPrice = await this.createStandardPriceForVariant(
      productId,
      null, // variant_id will be set after variant is created
      variantSalePrice,
      variantMrpPrice,
      variantData.brand_id || null
    );

    // Create variant with price_id
    const { data: variant, error: variantError } = await supabaseAdmin
      .from('product_variants')
      .insert({
        product_id: productId,
        name: variantData.name,
        sku: variantData.sku || null,
        is_default: false,
        image_url: variantData.image_url || null,
        is_featured: variantData.is_featured || false,
        is_active: variantActiveStatus,
        unit: variantData.unit || null,
        unit_type: variantData.unit_type || 'piece',
        best_before: variantData.best_before || null,
        tax_id: variantData.tax_id || null,
        hsn: variantData.hsn || null,
        badge: variantData.badge || null,
        brand_id: variantData.brand_id || null,
        price_id: standardPrice.id, // Set price_id immediately
        company_id: this.companyId,
      })
      .select()
      .single();

    if (variantError) {
      // Rollback: delete price if variant creation fails
      await supabaseAdmin.from('product_prices').delete().eq('id', standardPrice.id);
      console.error('Error creating variant:', variantError);
      throw new ApiError(500, `Failed to create variant: ${variantError.message}`);
    }

    // Update price entry with variant_id to link them
    const { error: updatePriceError } = await supabaseAdmin
      .from('product_prices')
      .update({ variant_id: variant.id })
      .eq('id', standardPrice.id);

    if (updatePriceError) {
      // Rollback: delete variant and price if update fails
      await supabaseAdmin.from('product_variants').delete().eq('id', variant.id);
      await supabaseAdmin.from('product_prices').delete().eq('id', standardPrice.id);
      console.error('Error linking variant to price:', updatePriceError);
      throw new ApiError(500, `Failed to link variant to price: ${updatePriceError.message}`);
    }

    // Fetch the complete variant with price info
    const { data: finalVariant, error: fetchError } = await supabaseAdmin
      .from('product_variants')
      .select('*')
      .eq('id', variant.id)
      .single();

    if (fetchError) {
      throw new ApiError(500, `Failed to fetch created variant: ${fetchError.message}`);
    }

    return finalVariant;
  }

  /**
   * Get variant price by price type
   * 
   * @param variantId - Variant ID
   * @param priceType - Price type (default: 'standard')
   * @param outletId - Optional outlet ID for outlet-specific pricing
   * @returns Price amount
   */
  async getVariantPrice(
    variantId: string,
    priceType: string = 'standard',
    outletId?: string | null
  ): Promise<number> {
    let query = supabaseAdmin
      .from('product_prices')
      .select('sale_price')
      .eq('variant_id', variantId)
      .eq('price_type', priceType)
      .eq('company_id', this.companyId)
      .lte('valid_from', new Date().toISOString())
      .or(`valid_until.is.null,valid_until.gte.${new Date().toISOString()}`)
      .order('outlet_id', { ascending: false }) // Prefer outlet-specific over NULL
      .limit(1);

    if (outletId) {
      query = query.or(`outlet_id.is.null,outlet_id.eq.${outletId}`);
    } else {
      query = query.is('outlet_id', null);
    }

    const { data: priceData, error } = await query.maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching variant price:', error);
      throw new ApiError(500, `Failed to fetch variant price: ${error.message}`);
    }

    if (priceData) {
      return parseFloat(priceData.sale_price.toString());
    }

    // Fallback: get standard price via price_id
    const { data: variant, error: variantError } = await supabaseAdmin
      .from('product_variants')
      .select('price_id, product:products(price)')
      .eq('id', variantId)
      .eq('company_id', this.companyId)
      .single();

    if (variantError) {
      throw new ApiError(404, `Variant ${variantId} not found`);
    }

    if (variant.price_id && priceType === 'standard') {
      const { data: standardPrice, error: priceError } = await supabaseAdmin
        .from('product_prices')
        .select('sale_price')
        .eq('id', variant.price_id)
        .single();

      if (!priceError && standardPrice) {
        return parseFloat(standardPrice.sale_price.toString());
      }
    }

    // Final fallback to product price
    const productPrice = Array.isArray(variant.product) 
      ? (variant.product[0] as any)?.price 
      : (variant.product as any)?.price;
    return parseFloat((productPrice || 0).toString());
  }

  /**
   * Update a variant
   * 
   * @param variantId - Variant ID to update
   * @param variantData - Variant data to update
   * @returns Updated variant
   */
  async updateVariant(
    variantId: string,
    variantData: {
      name?: string;
      sku?: string | null;
      sale_price?: number | null;
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
    }
  ): Promise<any> {
    // Get existing variant with product info
    const { data: existingVariant, error: variantFetchError } = await supabaseAdmin
      .from('product_variants')
      .select('*, product:products(id, name, is_active)')
      .eq('id', variantId)
      .eq('company_id', this.companyId)
      .single();

    if (variantFetchError || !existingVariant) {
      throw new ApiError(
        404,
        `Variant with ID '${variantId}' not found for product '${existingVariant?.product?.name || 'unknown'}'. Ensure variant belongs to the product and your company.`
      );
    }

    const product = Array.isArray(existingVariant.product)
      ? existingVariant.product[0]
      : existingVariant.product;

    // Validate is_active: variant can only be active if product is active
    if (variantData.is_active !== undefined) {
      if (variantData.is_active === true && product.is_active !== true) {
        throw new ApiError(
          400,
          `Cannot activate variant '${existingVariant.name}': Product '${product.name}' is currently inactive. Activate the product first before activating its variants.`
        );
      }
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (variantData.name !== undefined) {
      updateData.name = variantData.name;
    }
    if (variantData.sku !== undefined) {
      updateData.sku = variantData.sku;
    }
    if (variantData.image_url !== undefined) {
      updateData.image_url = variantData.image_url;
    }
    if (variantData.is_featured !== undefined) {
      updateData.is_featured = variantData.is_featured;
    }
    if (variantData.is_active !== undefined) {
      updateData.is_active = variantData.is_active && product.is_active === true;
    }
    if (variantData.unit !== undefined) {
      updateData.unit = variantData.unit;
    }
    if (variantData.unit_type !== undefined) {
      updateData.unit_type = variantData.unit_type;
    }
    if (variantData.best_before !== undefined) {
      updateData.best_before = variantData.best_before;
    }
    if (variantData.tax_id !== undefined) {
      // Convert empty string to null for UUID fields
      updateData.tax_id = variantData.tax_id === '' || variantData.tax_id === null ? null : variantData.tax_id;
    }
    if (variantData.hsn !== undefined) {
      updateData.hsn = variantData.hsn;
    }
    if (variantData.badge !== undefined) {
      updateData.badge = variantData.badge;
    }
    if (variantData.brand_id !== undefined) {
      // Convert empty string to null for UUID fields
      updateData.brand_id = variantData.brand_id === '' || variantData.brand_id === null ? null : variantData.brand_id;
    }

    // Update variant
    const { data: updatedVariant, error: updateError } = await supabaseAdmin
      .from('product_variants')
      .update(updateData)
      .eq('id', variantId)
      .eq('company_id', this.companyId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating variant:', updateError);
      throw new ApiError(500, `Failed to update variant: ${updateError.message}`);
    }

    // Update standard price if sale_price or mrp_price provided
    if (variantData.sale_price !== undefined || variantData.mrp_price !== undefined) {
      const salePrice = variantData.sale_price !== undefined 
        ? variantData.sale_price 
        : existingVariant.price_id 
          ? (await supabaseAdmin.from('product_prices').select('sale_price').eq('id', existingVariant.price_id).single()).data?.sale_price
          : product.price;
      
      const mrpPrice = variantData.mrp_price !== undefined 
        ? variantData.mrp_price 
        : variantData.sale_price !== undefined
          ? variantData.sale_price
          : existingVariant.price_id
            ? (await supabaseAdmin.from('product_prices').select('mrp_price').eq('id', existingVariant.price_id).single()).data?.mrp_price
            : salePrice;

      // Validate: sale_price <= mrp_price
      if (salePrice > mrpPrice) {
        throw new ApiError(
          400,
          `Invalid pricing for variant '${updatedVariant.name}': sale_price (${salePrice}) cannot be greater than mrp_price (${mrpPrice}). MRP must be equal to or greater than sale price.`
        );
      }

      if (existingVariant.price_id) {
        // Update existing standard price
        const { error: priceUpdateError } = await supabaseAdmin
          .from('product_prices')
          .update({
            sale_price: salePrice,
            mrp_price: mrpPrice,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingVariant.price_id);

        if (priceUpdateError) {
          console.error('Error updating variant price:', priceUpdateError);
          throw new ApiError(500, `Failed to update variant price: ${priceUpdateError.message}`);
        }
      } else {
        // Create new standard price if missing
        const standardPrice = await this.createStandardPriceForVariant(
          existingVariant.product_id,
          variantId,
          salePrice,
          mrpPrice,
          variantData.brand_id || existingVariant.brand_id || null
        );

        // Link price to variant
        const { error: linkError } = await supabaseAdmin
          .from('product_variants')
          .update({ price_id: standardPrice.id })
          .eq('id', variantId);

        if (linkError) {
          await supabaseAdmin.from('product_prices').delete().eq('id', standardPrice.id);
          throw new ApiError(500, `Failed to link price to variant: ${linkError.message}`);
        }
      }
    }

    // Fetch updated variant with price info
    const { data: finalVariant, error: fetchError } = await supabaseAdmin
      .from('product_variants')
      .select('*')
      .eq('id', variantId)
      .single();

    if (fetchError) {
      throw new ApiError(500, `Failed to fetch updated variant: ${fetchError.message}`);
    }

    return finalVariant;
  }

  /**
   * Delete a variant
   * Prevents deletion if variant is default or has orders referencing it
   * 
   * @param variantId - Variant ID to delete
   * @returns void
   */
  async deleteVariant(variantId: string): Promise<void> {
    // Get variant with product info
    const { data: variant, error: variantError } = await supabaseAdmin
      .from('product_variants')
      .select('*, product:products(id, name)')
      .eq('id', variantId)
      .eq('company_id', this.companyId)
      .single();

    if (variantError || !variant) {
      throw new ApiError(
        404,
        `Variant with ID '${variantId}' not found. Ensure variant belongs to your company.`
      );
    }

    const product = Array.isArray(variant.product)
      ? variant.product[0]
      : variant.product;

    // Prevent deletion of default variant
    if (variant.is_default) {
      throw new ApiError(
        400,
        `Cannot delete variant '${variant.name}': This is the default variant for product '${product.name}'. Only one default variant is allowed. To remove this variant, first set another variant as default.`
      );
    }

    // Check if any orders reference this variant
    const { data: orderItems, error: orderItemsError } = await supabaseAdmin
      .from('order_items')
      .select('id, order_id')
      .eq('variant_id', variantId)
      .eq('company_id', this.companyId)
      .limit(1);

    if (orderItemsError) {
      throw new ApiError(500, `Failed to check variant usage: ${orderItemsError.message}`);
    }

    if (orderItems && orderItems.length > 0) {
      const orderCount = await supabaseAdmin
        .from('order_items')
        .select('order_id', { count: 'exact', head: true })
        .eq('variant_id', variantId)
        .eq('company_id', this.companyId);

      throw new ApiError(
        400,
        `Cannot delete variant '${variant.name}': ${orderCount.count || orderItems.length} order(s) reference this variant. Archive the variant instead or update existing orders first.`
      );
    }

    // Delete variant (cascade will delete associated prices)
    const { error: deleteError } = await supabaseAdmin
      .from('product_variants')
      .delete()
      .eq('id', variantId)
      .eq('company_id', this.companyId);

    if (deleteError) {
      console.error('Error deleting variant:', deleteError);
      throw new ApiError(500, `Failed to delete variant: ${deleteError.message}`);
    }
  }
}

