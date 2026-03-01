import { Request, Response, NextFunction } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { ApiError, ValidationError } from '../middleware/error';

/**
 * Generate invoice number (e.g., INV-2024-001)
 */
const generateInvoiceNumber = async (companyId: string): Promise<string> => {
  const year = new Date().getFullYear();
  
  const adminClient = supabaseAdmin || supabase;
  const { data: latestInvoice, error } = await adminClient
    .schema('procurement')
    .from('purchase_invoices')
    .select('invoice_number')
    .eq('company_id', companyId)
    .ilike('invoice_number', `INV-${year}-%`)
    .order('invoice_number', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching latest invoice:', error);
  }

  let sequence = 1;
  if (latestInvoice && latestInvoice.invoice_number) {
    const parts = latestInvoice.invoice_number.split('-');
    if (parts.length === 3) {
      sequence = parseInt(parts[2]) + 1;
    }
  }

  return `INV-${year}-${sequence.toString().padStart(3, '0')}`;
};

/**
 * Create a corresponding purchase order row in public.orders when a purchase
 * invoice is generated. This is the \"final\" purchase order used for
 * unified reporting across sales and purchase flows.
 */
const createPurchaseOrderFromInvoiceOrderRow = async (params: {
  companyId: string;
  userId: string;
  goodsReceipt: any;
  purchaseInvoice: any;
}) => {
  const { companyId, userId, goodsReceipt, purchaseInvoice } = params;

  const adminClient = supabaseAdmin || supabase;

  const { error } = await adminClient
    .from('orders')
    .insert({
      user_id: userId,
      company_id: companyId,
      status: 'pending',
      // Explicit purchase order semantics
      order_type: 'purchase',
      order_source: 'internal',
      fulfillment_type: 'delivery',
      // Map from invoice
      total_amount: purchaseInvoice.total_amount,
      shipping_address_id: null,
      billing_address_id: null,
      payment_method: null,
      payment_status: 'pending',
      notes:
        purchaseInvoice.notes ||
        `Purchase invoice ${purchaseInvoice.invoice_number} for GRN ${goodsReceipt.grn_number}`,
      // Use GRN warehouse as outlet
      outlet_id: goodsReceipt.warehouse_id,
      inventory_updated: true,
    })
    .single();

  if (error) {
    console.error('Error creating purchase order entry from invoice:', error);
    throw new ApiError(500, 'Failed to create purchase order from invoice');
  }
};

/**
 * Auto-create invoice from completed GRN
 * Pre-populates invoice with GRN data
 */
export const createInvoiceFromGRN = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { goods_receipt_id, supplier_invoice_number, invoice_date, due_date, tax_amount, discount_amount, notes } = req.body;

    if (!goods_receipt_id) {
      throw new ValidationError('Goods receipt ID is required');
    }

    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;
    
    // Fetch GRN
    const { data: goodsReceipt, error: grnError } = await adminClient
      .schema('procurement')
      .from('goods_receipts')
      .select('*')
      .eq('id', goods_receipt_id)
      .eq('company_id', req.companyId)
      .single();

    if (grnError || !goodsReceipt) {
      console.error('Error fetching GRN:', grnError);
      throw new ApiError(404, 'Goods receipt not found');
    }

    // Fetch purchase order separately
    let purchaseOrder = null;
    if (goodsReceipt.purchase_order_id) {
      const { data: poData, error: poError } = await adminClient
        .schema('procurement')
        .from('purchase_orders')
        .select('*')
        .eq('id', goodsReceipt.purchase_order_id)
        .eq('company_id', req.companyId)
        .single();
      
      if (!poError && poData) {
        purchaseOrder = poData;
      }
    }

    if (!purchaseOrder) {
      throw new ApiError(404, 'Purchase order not found for this goods receipt');
    }

    // Verify GRN is completed
    if (goodsReceipt.status !== 'completed') {
      throw new ValidationError(`Cannot create invoice from GRN with status '${goodsReceipt.status}'. GRN must be 'completed'.`);
    }

    // Check if invoice already exists for this GRN
    const { data: existingInvoice } = await adminClient
      .schema('procurement')
      .from('purchase_invoices')
      .select('id')
      .eq('goods_receipt_id', goods_receipt_id)
      .eq('company_id', req.companyId)
      .single();

    if (existingInvoice) {
      throw new ValidationError('An invoice already exists for this goods receipt');
    }

    // Purchase order is already fetched above

    // Generate invoice number
    const invoice_number = await generateInvoiceNumber(req.companyId);

    // Calculate amounts from GRN
    const calculatedSubtotal = goodsReceipt.total_received_amount || 0;
    const calculatedTax = tax_amount || 0;
    const calculatedDiscount = discount_amount || 0;
    const calculatedTotal = calculatedSubtotal + calculatedTax - calculatedDiscount;

    // Set default dates if not provided
    const invoiceDate = invoice_date || new Date().toISOString().split('T')[0];
    const dueDate = due_date || (purchaseOrder?.expected_delivery_date 
      ? new Date(purchaseOrder.expected_delivery_date).toISOString().split('T')[0]
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]); // Default 30 days

    // Create purchase invoice
    const { data: purchaseInvoice, error: invoiceError } = await adminClient
      .schema('procurement')
      .from('purchase_invoices')
      .insert({
        purchase_order_id: goodsReceipt.purchase_order_id,
        goods_receipt_id,
        invoice_number,
        supplier_invoice_number,
        invoice_date: invoiceDate,
        due_date: dueDate,
        subtotal: calculatedSubtotal,
        tax_amount: calculatedTax,
        discount_amount: calculatedDiscount,
        total_amount: calculatedTotal,
        paid_amount: 0,
        status: 'pending',
        notes: notes || `Auto-generated from GRN ${goodsReceipt.grn_number}`,
        created_by: userId,
        company_id: req.companyId
      })
      .select()
      .single();

    if (invoiceError) {
      console.error('Error creating purchase invoice from GRN:', invoiceError);
      throw new ApiError(500, `Failed to create purchase invoice: ${invoiceError.message}`);
    }

    // Fetch GRN items to create invoice items
    const { data: grnItems, error: grnItemsError } = await adminClient
      .schema('procurement')
      .from('goods_receipt_items')
      .select('*')
      .eq('goods_receipt_id', goods_receipt_id)
      .eq('company_id', req.companyId);

    if (grnItemsError) {
      console.error('Error fetching GRN items:', grnItemsError);
      // Don't fail the invoice creation, but log the error
    }

    // Create invoice items from GRN items
    // Only use accepted quantity for invoicing (rejected items should not be invoiced)
    if (grnItems && grnItems.length > 0) {
      const invoiceItems = grnItems.map((grnItem: any) => {
        // Use only accepted quantity - rejected items should not be invoiced
        const quantity = grnItem.quantity_accepted || 0;
        
        if (quantity <= 0) {
          // Skip items with no accepted quantity
          return null;
        }
        
        const unitPrice = grnItem.unit_price || 0;
        const taxPercentage = grnItem.tax_percentage || 0;
        const taxAmount = (quantity * unitPrice * taxPercentage) / 100;
        const lineTotal = (quantity * unitPrice) + taxAmount - (grnItem.discount_amount || 0);

        return {
          purchase_invoice_id: purchaseInvoice.id,
          product_id: grnItem.product_id,
          goods_receipt_item_id: grnItem.id,
          quantity,
          unit: grnItem.unit || 'piece',
          unit_price: unitPrice,
          tax_percentage: taxPercentage,
          tax_amount: taxAmount,
          discount_amount: 0,
          line_total: lineTotal,
          hsn_code: grnItem.hsn_code || '',
          product_code: grnItem.product_code || '',
          company_id: req.companyId
        };
      }).filter((item: any) => item !== null); // Remove null items (those with no accepted quantity)

      const { error: itemsError } = await adminClient
        .schema('procurement')
        .from('purchase_invoice_items')
        .insert(invoiceItems);

      if (itemsError) {
        console.error('Error creating invoice items:', itemsError);
        // Don't fail the invoice creation, but log the error
      }
    }

    // Also create a corresponding purchase order row in public.orders
    await createPurchaseOrderFromInvoiceOrderRow({
      companyId: req.companyId,
      userId,
      goodsReceipt,
      purchaseInvoice,
    });

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully from GRN',
      data: purchaseInvoice
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new purchase invoice from goods receipt
 */
export const createPurchaseInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      goods_receipt_id,
      purchase_order_id,
      supplier_invoice_number,
      invoice_date,
      due_date,
      subtotal,
      tax_amount,
      discount_amount,
      total_amount,
      notes
    } = req.body;

    if (!goods_receipt_id) {
      throw new ValidationError('Goods receipt ID is required');
    }

    if (!invoice_date) {
      throw new ValidationError('Invoice date is required');
    }

    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    // Verify goods receipt exists
    const adminClient = supabaseAdmin || supabase;
    const { data: goodsReceipt, error: grnError } = await adminClient
      .schema('procurement')
      .from('goods_receipts')
      .select('*')
      .eq('id', goods_receipt_id)
      .eq('company_id', req.companyId)
      .single();

    if (grnError || !goodsReceipt) {
      throw new ApiError(404, 'Goods receipt not found');
    }

    // Generate invoice number
    const invoice_number = await generateInvoiceNumber(req.companyId);

    // Calculate amounts if not provided
    const calculatedSubtotal = subtotal || goodsReceipt.total_received_amount || 0;
    const calculatedTax = tax_amount || 0;
    const calculatedDiscount = discount_amount || 0;
    const calculatedTotal = calculatedSubtotal + calculatedTax - calculatedDiscount;

    // Create purchase invoice
    const { data: purchaseInvoice, error: invoiceError } = await adminClient
      .schema('procurement')
      .from('purchase_invoices')
      .insert({
        purchase_order_id: purchase_order_id || goodsReceipt.purchase_order_id,
        goods_receipt_id,
        invoice_number,
        supplier_invoice_number,
        invoice_date,
        due_date,
        subtotal: calculatedSubtotal,
        tax_amount: calculatedTax,
        discount_amount: calculatedDiscount,
        total_amount: calculatedTotal,
        paid_amount: 0,
        status: 'pending',
        notes,
        created_by: userId,
        company_id: req.companyId
      })
      .select()
      .single();

    if (invoiceError) {
      console.error('Error creating purchase invoice:', invoiceError);
      throw new ApiError(500, `Failed to create purchase invoice: ${invoiceError.message}`);
    }

    // Create invoice items if items array is provided
    if (req.body.items && Array.isArray(req.body.items) && req.body.items.length > 0) {
      // Validate all items before processing
      for (const item of req.body.items) {
        if (!item.product_id || item.product_id === '' || 
            item.quantity == null || item.quantity <= 0 || 
            item.unit_price == null || item.unit_price < 0) {
          throw new ValidationError(
            `Each item must have a valid product_id (non-empty), quantity (greater than 0), and unit_price (non-negative). ` +
            `Found: product_id=${item.product_id}, quantity=${item.quantity}, unit_price=${item.unit_price}`
          );
        }
      }

      // Fetch product details for all items
      const productIds = req.body.items.map((item: any) => item.product_id).filter(Boolean);
      let productsMap = new Map();
      
      if (productIds.length > 0) {
        const { data: products, error: productsError } = await adminClient
          .from('products')
          .select('id, unit_type, product_code, hsn_code, tax')
          .in('id', productIds)
          .eq('company_id', req.companyId);

        if (productsError) {
          console.error('Error fetching products:', productsError);
          throw new ApiError(500, 'Failed to fetch product details');
        }

        productsMap = new Map(products?.map((p: any) => [p.id, p]) || []);
      }

      const invoiceItems = req.body.items.map((item: any) => {
        const product = productsMap.get(item.product_id);
        const quantity = item.quantity || 0;
        const unitPrice = item.unit_price || 0;
        const taxPercentage = item.tax_percentage !== undefined ? item.tax_percentage : (product?.tax || 0);
        const taxAmount = (quantity * unitPrice * taxPercentage) / 100;
        const discountAmount = item.discount_amount || 0;
        const lineTotal = (quantity * unitPrice) + taxAmount - discountAmount;

        return {
          purchase_invoice_id: purchaseInvoice.id,
          product_id: item.product_id,
          goods_receipt_item_id: item.goods_receipt_item_id || null,
          quantity,
          unit: item.unit || product?.unit_type || 'piece',
          unit_price: unitPrice,
          tax_percentage: taxPercentage,
          tax_amount: taxAmount,
          discount_amount: discountAmount,
          line_total: lineTotal,
          hsn_code: item.hsn_code || product?.hsn_code || '',
          product_code: item.product_code || product?.product_code || '',
          company_id: req.companyId
        };
      });

      const { error: itemsError } = await adminClient
        .schema('procurement')
        .from('purchase_invoice_items')
        .insert(invoiceItems);

      if (itemsError) {
        console.error('Error creating invoice items:', itemsError);
        throw new ApiError(500, `Failed to create invoice items: ${itemsError.message}`);
      }
    }

    // After invoice creation, also create a corresponding purchase order row
    await createPurchaseOrderFromInvoiceOrderRow({
      companyId: req.companyId,
      userId,
      goodsReceipt,
      purchaseInvoice,
    });

    // Return the created invoice (relations can be fetched via getPurchaseInvoiceById if needed)
    res.status(201).json({
      success: true,
      data: purchaseInvoice
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all purchase invoices with optional filters
 */
export const getPurchaseInvoices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, supplier_id, purchase_order_id, date_from, date_to } = req.query;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;
    let query = adminClient
      .schema('procurement')
      .from('purchase_invoices')
      .select('*')
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (purchase_order_id) {
      query = query.eq('purchase_order_id', purchase_order_id);
    }

    if (date_from) {
      query = query.gte('invoice_date', date_from);
    }

    if (date_to) {
      query = query.lte('invoice_date', date_to);
    }

    const { data: invoices, error } = await query;

    if (error) {
      console.error('Error fetching purchase invoices:', error);
      throw new ApiError(500, 'Failed to fetch purchase invoices');
    }

    // Fetch related purchase orders and goods receipts separately
    const purchaseOrderIds = [...new Set(invoices?.map((inv: any) => inv.purchase_order_id).filter(Boolean) || [])];
    const goodsReceiptIds = [...new Set(invoices?.map((inv: any) => inv.goods_receipt_id).filter(Boolean) || [])];

    const purchaseOrdersMap = new Map();
    const goodsReceiptsMap = new Map();
    const suppliersMap = new Map();

    if (purchaseOrderIds.length > 0) {
      const { data: purchaseOrders } = await adminClient
        .schema('procurement')
        .from('purchase_orders')
        .select('*')
        .in('id', purchaseOrderIds)
        .eq('company_id', req.companyId);
      
      purchaseOrders?.forEach((po: any) => {
        purchaseOrdersMap.set(po.id, po);
        if (po.supplier_id) {
          suppliersMap.set(po.supplier_id, po.supplier_id); // Store ID for later fetch
        }
      });
    }

    if (goodsReceiptIds.length > 0) {
      const { data: goodsReceipts } = await adminClient
        .schema('procurement')
        .from('goods_receipts')
        .select('*')
        .in('id', goodsReceiptIds)
        .eq('company_id', req.companyId);
      
      goodsReceipts?.forEach((gr: any) => {
        goodsReceiptsMap.set(gr.id, gr);
      });
    }

    // Fetch suppliers if needed
    const supplierIds = [...suppliersMap.keys()];
    if (supplierIds.length > 0) {
      const { data: suppliers } = await adminClient
        .from('suppliers')
        .select('*')
        .in('id', supplierIds)
        .eq('company_id', req.companyId);
      
      suppliers?.forEach((supplier: any) => {
        suppliersMap.set(supplier.id, supplier);
      });
    }

    // Fetch invoice items for all invoices
    const invoiceIds = invoices?.map((inv: any) => inv.id) || [];
    const invoiceItemsMap = new Map();
    const productIdsSet = new Set<string>();

    if (invoiceIds.length > 0) {
      const { data: allInvoiceItems } = await adminClient
        .schema('procurement')
        .from('purchase_invoice_items')
        .select('*')
        .in('purchase_invoice_id', invoiceIds)
        .eq('company_id', req.companyId);

      // Group items by invoice_id
      allInvoiceItems?.forEach((item: any) => {
        if (!invoiceItemsMap.has(item.purchase_invoice_id)) {
          invoiceItemsMap.set(item.purchase_invoice_id, []);
        }
        invoiceItemsMap.get(item.purchase_invoice_id).push(item);
        if (item.product_id) {
          productIdsSet.add(item.product_id);
        }
      });
    }

    // Fetch products for invoice items
    const productsMap = new Map();
    if (productIdsSet.size > 0) {
      const { data: products } = await adminClient
        .from('products')
        .select('*')
        .in('id', Array.from(productIdsSet))
        .eq('company_id', req.companyId);
      
      products?.forEach((product: any) => {
        productsMap.set(product.id, product);
      });
    }

    // Enrich invoice items with products
    invoiceItemsMap.forEach((items, invoiceId) => {
      const enrichedItems = items.map((item: any) => ({
        ...item,
        products: item.product_id ? productsMap.get(item.product_id) : null
      }));
      invoiceItemsMap.set(invoiceId, enrichedItems);
    });

    // Join the data
    let enrichedInvoices = (invoices || []).map((inv: any) => {
      const po = inv.purchase_order_id ? purchaseOrdersMap.get(inv.purchase_order_id) : null;
      const supplier = po?.supplier_id ? suppliersMap.get(po.supplier_id) : null;
      return {
        ...inv,
        purchase_orders: po ? { ...po, suppliers: supplier } : null,
        goods_receipts: inv.goods_receipt_id ? goodsReceiptsMap.get(inv.goods_receipt_id) : null,
        purchase_invoice_items: invoiceItemsMap.get(inv.id) || []
      };
    });

    // Filter by supplier_id if provided
    if (supplier_id) {
      enrichedInvoices = enrichedInvoices.filter((invoice: any) => 
        invoice.purchase_orders?.supplier_id === supplier_id
      );
    }

    res.json({
      success: true,
      data: enrichedInvoices
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get purchase invoice by ID
 */
export const getPurchaseInvoiceById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;
    
    // Fetch purchase invoice from procurement schema
    const { data: purchaseInvoice, error } = await adminClient
      .schema('procurement')
      .from('purchase_invoices')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'Purchase invoice not found');
      }
      console.error('Error fetching purchase invoice:', error);
      throw new ApiError(500, 'Failed to fetch purchase invoice');
    }

    // Fetch related purchase order, goods receipt, and supplier payments separately
    const [purchaseOrderResult, goodsReceiptResult, paymentsResult] = await Promise.all([
      purchaseInvoice.purchase_order_id 
        ? adminClient.schema('procurement').from('purchase_orders').select('*').eq('id', purchaseInvoice.purchase_order_id).eq('company_id', req.companyId).single()
        : Promise.resolve({ data: null, error: null }),
      purchaseInvoice.goods_receipt_id
        ? adminClient.schema('procurement').from('goods_receipts').select('*').eq('id', purchaseInvoice.goods_receipt_id).eq('company_id', req.companyId).single()
        : Promise.resolve({ data: null, error: null }),
      adminClient.schema('procurement').from('supplier_payments').select('*').eq('purchase_invoice_id', id).eq('company_id', req.companyId)
    ]);

    const purchaseOrder = purchaseOrderResult.error ? null : purchaseOrderResult.data;
    const goodsReceipt = goodsReceiptResult.error ? null : goodsReceiptResult.data;
    const payments = paymentsResult.error ? [] : (paymentsResult.data || []);

    // Fetch supplier if purchase order exists
    let supplier = null;
    if (purchaseOrder?.supplier_id) {
      const { data: supplierData } = await adminClient
        .from('suppliers')
        .select('*')
        .eq('id', purchaseOrder.supplier_id)
        .eq('company_id', req.companyId)
        .single();
      supplier = supplierData || null;
    }

    // Fetch invoice items
    const { data: invoiceItems, error: itemsError } = await adminClient
      .schema('procurement')
      .from('purchase_invoice_items')
      .select('*')
      .eq('purchase_invoice_id', id)
      .eq('company_id', req.companyId);

    if (itemsError) {
      console.error('Error fetching invoice items:', itemsError);
      // Don't fail, just log the error
    }

    // Fetch products for invoice items
    const productIds = invoiceItems?.map((item: any) => item.product_id).filter(Boolean) || [];
    const productsMap = new Map();
    if (productIds.length > 0) {
      const { data: products } = await adminClient
        .from('products')
        .select('*')
        .in('id', productIds)
        .eq('company_id', req.companyId);
      
      products?.forEach((product: any) => {
        productsMap.set(product.id, product);
      });
    }

    // Enrich invoice items with products
    const enrichedInvoiceItems = (invoiceItems || []).map((item: any) => ({
      ...item,
      products: item.product_id ? productsMap.get(item.product_id) : null
    }));

    res.json({
      success: true,
      data: {
        ...purchaseInvoice,
        purchase_orders: purchaseOrder ? { ...purchaseOrder, suppliers: supplier } : null,
        goods_receipts: goodsReceipt,
        supplier_payments: payments,
        purchase_invoice_items: enrichedInvoiceItems
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update purchase invoice
 */
export const updatePurchaseInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      supplier_invoice_number,
      invoice_date,
      due_date,
      subtotal,
      tax_amount,
      discount_amount,
      total_amount,
      notes,
      status
    } = req.body;

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (supplier_invoice_number !== undefined) updateData.supplier_invoice_number = supplier_invoice_number;
    if (invoice_date !== undefined) updateData.invoice_date = invoice_date;
    if (due_date !== undefined) updateData.due_date = due_date;
    if (subtotal !== undefined) updateData.subtotal = subtotal;
    if (tax_amount !== undefined) updateData.tax_amount = tax_amount;
    if (discount_amount !== undefined) updateData.discount_amount = discount_amount;
    if (total_amount !== undefined) updateData.total_amount = total_amount;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;
    const { data: purchaseInvoice, error: updateError } = await adminClient
      .schema('procurement')
      .from('purchase_invoices')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        throw new ApiError(404, 'Purchase invoice not found');
      }
      console.error('Error updating purchase invoice:', updateError);
      throw new ApiError(500, 'Failed to update purchase invoice');
    }

    // Update items if provided
    if (req.body.items && Array.isArray(req.body.items)) {
      // Delete existing items
      await adminClient
        .schema('procurement')
        .from('purchase_invoice_items')
        .delete()
        .eq('purchase_invoice_id', id)
        .eq('company_id', req.companyId);

      // Insert new items
      if (req.body.items.length > 0) {
        // Validate all items before processing
        for (const item of req.body.items) {
          if (!item.product_id || item.product_id === '' || 
              item.quantity == null || item.quantity <= 0 || 
              item.unit_price == null || item.unit_price < 0) {
            throw new ValidationError(
              `Each item must have a valid product_id (non-empty), quantity (greater than 0), and unit_price (non-negative). ` +
              `Found: product_id=${item.product_id}, quantity=${item.quantity}, unit_price=${item.unit_price}`
            );
          }
        }

        // Fetch product details for all items
        const productIds = req.body.items.map((item: any) => item.product_id).filter(Boolean);
        let productsMap = new Map();
        
        if (productIds.length > 0) {
          const { data: products, error: productsError } = await adminClient
            .from('products')
            .select('id, unit_type, product_code, hsn_code, tax')
            .in('id', productIds)
            .eq('company_id', req.companyId);

          if (productsError) {
            console.error('Error fetching products:', productsError);
            throw new ApiError(500, 'Failed to fetch product details');
          }

          productsMap = new Map(products?.map((p: any) => [p.id, p]) || []);
        }

        const invoiceItems = req.body.items.map((item: any) => {
          const product = productsMap.get(item.product_id);
          const quantity = item.quantity || 0;
          const unitPrice = item.unit_price || 0;
          const taxPercentage = item.tax_percentage !== undefined ? item.tax_percentage : (product?.tax || 0);
          const taxAmount = (quantity * unitPrice * taxPercentage) / 100;
          const discountAmount = item.discount_amount || 0;
          const lineTotal = (quantity * unitPrice) + taxAmount - discountAmount;

          return {
            purchase_invoice_id: id,
            product_id: item.product_id,
            goods_receipt_item_id: item.goods_receipt_item_id || null,
            quantity,
            unit: item.unit || product?.unit_type || 'piece',
            unit_price: unitPrice,
            tax_percentage: taxPercentage,
            tax_amount: taxAmount,
            discount_amount: discountAmount,
            line_total: lineTotal,
            hsn_code: item.hsn_code || product?.hsn_code || '',
            product_code: item.product_code || product?.product_code || '',
            company_id: req.companyId
          };
        });

        const { error: itemsError } = await adminClient
          .schema('procurement')
          .from('purchase_invoice_items')
          .insert(invoiceItems);

        if (itemsError) {
          console.error('Error updating invoice items:', itemsError);
          throw new ApiError(500, `Failed to update invoice items: ${itemsError.message}`);
        }

        // Recalculate totals from items
        const calculatedSubtotal = invoiceItems.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0);
        const calculatedTax = invoiceItems.reduce((sum: number, item: any) => sum + item.tax_amount, 0);
        const calculatedDiscount = invoiceItems.reduce((sum: number, item: any) => sum + item.discount_amount, 0);
        const calculatedTotal = calculatedSubtotal + calculatedTax - calculatedDiscount;

        // Update invoice totals
        await adminClient
          .schema('procurement')
          .from('purchase_invoices')
          .update({
            subtotal: calculatedSubtotal,
            tax_amount: calculatedTax,
            discount_amount: calculatedDiscount,
            total_amount: calculatedTotal
          })
          .eq('id', id)
          .eq('company_id', req.companyId);
      }
    }

    // Update status based on paid amount
    if (purchaseInvoice.paid_amount >= purchaseInvoice.total_amount) {
      await adminClient
        .schema('procurement')
        .from('purchase_invoices')
        .update({ status: 'paid' })
        .eq('id', id)
        .eq('company_id', req.companyId);
    } else if (purchaseInvoice.paid_amount > 0) {
      await adminClient
        .schema('procurement')
        .from('purchase_invoices')
        .update({ status: 'partial' })
        .eq('id', id)
        .eq('company_id', req.companyId);
    }

    // Fetch updated invoice with relations (reuse getPurchaseInvoiceById logic)
    const { data: updatedInvoice } = await adminClient
      .schema('procurement')
      .from('purchase_invoices')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    res.json({
      success: true,
      data: updatedInvoice || purchaseInvoice
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload invoice file
 */
export const uploadInvoiceFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { invoice_file_url } = req.body;

    if (!invoice_file_url) {
      throw new ValidationError('Invoice file URL is required');
    }

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;
    const { data: purchaseInvoice, error } = await adminClient
      .schema('procurement')
      .from('purchase_invoices')
      .update({
        invoice_file_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'Purchase invoice not found');
      }
      console.error('Error updating invoice file URL:', error);
      throw new ApiError(500, 'Failed to update invoice file URL');
    }

    res.json({
      success: true,
      message: 'Invoice file uploaded successfully',
      data: purchaseInvoice
    });
  } catch (error) {
    next(error);
  }
};
