import { Request, Response, NextFunction } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { ValidationError, ApiError } from './error';

/**
 * Valid status transitions for Purchase Orders
 */
const VALID_PO_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['approved', 'cancelled'],
  approved: ['ordered', 'cancelled'],
  ordered: ['partially_received', 'received', 'cancelled'],
  partially_received: ['received', 'cancelled'],
  received: [], // Terminal state
  cancelled: [] // Terminal state
};

/**
 * Valid status transitions for Goods Receipts
 */
const VALID_GRN_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['inspected', 'rejected'],
  inspected: ['approved', 'rejected'],
  approved: ['completed', 'rejected'],
  rejected: [], // Terminal state
  completed: [] // Terminal state
};

/**
 * Valid status transitions for Purchase Invoices
 */
const VALID_INVOICE_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['partial', 'paid', 'overdue', 'cancelled'],
  partial: ['paid', 'overdue', 'cancelled'],
  paid: [], // Terminal state
  overdue: ['paid', 'partial', 'cancelled'],
  cancelled: [] // Terminal state
};

/**
 * Valid status transitions for Supplier Payments
 */
const VALID_PAYMENT_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['completed', 'failed', 'cancelled'],
  completed: [], // Terminal state
  failed: ['pending', 'processing', 'cancelled'],
  cancelled: [] // Terminal state
};

/**
 * Middleware to validate PO status transitions
 */
export const validatePOStatusTransition = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return next(); // No status change, skip validation
    }

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    // Fetch current PO status
    const adminClient = supabaseAdmin || supabase;
    const { data: po, error } = await adminClient
      .schema('procurement')
      .from('purchase_orders')
      .select('status')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (error || !po) {
      throw new ApiError(404, 'Purchase order not found');
    }

    const currentStatus = po.status;
    const allowedTransitions = VALID_PO_STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowedTransitions.includes(status)) {
      throw new ValidationError(
        `Invalid status transition: Cannot change PO status from '${currentStatus}' to '${status}'. ` +
        `Allowed transitions: ${allowedTransitions.join(', ') || 'none (terminal state)'}`
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to validate GRN can only be created for approved/ordered POs
 */
export const validateGRNCreation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { purchase_order_id } = req.body;

    if (!purchase_order_id) {
      return next(); // Will be validated by controller
    }

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;
    const { data: po, error } = await adminClient
      .schema('procurement')
      .from('purchase_orders')
      .select('status')
      .eq('id', purchase_order_id)
      .eq('company_id', req.companyId)
      .single();

    if (error || !po) {
      throw new ApiError(404, 'Purchase order not found');
    }

    const validStatuses = ['approved', 'ordered', 'partially_received'];
    if (!validStatuses.includes(po.status)) {
      throw new ValidationError(
        `Cannot create GRN for PO with status '${po.status}'. ` +
        `PO must be in one of these statuses: ${validStatuses.join(', ')}`
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to validate GRN status transitions
 */
export const validateGRNStatusTransition = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return next(); // No status change, skip validation
    }

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;
    const { data: grn, error } = await adminClient
      .schema('procurement')
      .from('goods_receipts')
      .select('status')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (error || !grn) {
      throw new ApiError(404, 'Goods receipt not found');
    }

    const currentStatus = grn.status;
    const allowedTransitions = VALID_GRN_STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowedTransitions.includes(status)) {
      throw new ValidationError(
        `Invalid status transition: Cannot change GRN status from '${currentStatus}' to '${status}'. ` +
        `Allowed transitions: ${allowedTransitions.join(', ') || 'none (terminal state)'}`
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to validate invoice can only be created for completed GRNs
 */
export const validateInvoiceCreation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { goods_receipt_id } = req.body;

    if (!goods_receipt_id) {
      return next(); // Will be validated by controller
    }

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;
    const { data: grn, error } = await adminClient
      .schema('procurement')
      .from('goods_receipts')
      .select('status')
      .eq('id', goods_receipt_id)
      .eq('company_id', req.companyId)
      .single();

    if (error || !grn) {
      throw new ApiError(404, 'Goods receipt not found');
    }

    if (grn.status !== 'completed') {
      throw new ValidationError(
        `Cannot create invoice for GRN with status '${grn.status}'. ` +
        `GRN must be 'completed' before creating an invoice.`
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to validate invoice status transitions
 */
export const validateInvoiceStatusTransition = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return next(); // No status change, skip validation
    }

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;
    const { data: invoice, error } = await adminClient
      .schema('procurement')
      .from('purchase_invoices')
      .select('status')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (error || !invoice) {
      throw new ApiError(404, 'Purchase invoice not found');
    }

    const currentStatus = invoice.status;
    const allowedTransitions = VALID_INVOICE_STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowedTransitions.includes(status)) {
      throw new ValidationError(
        `Invalid status transition: Cannot change invoice status from '${currentStatus}' to '${status}'. ` +
        `Allowed transitions: ${allowedTransitions.join(', ') || 'none (terminal state)'}`
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to validate payment amount doesn't exceed invoice balance (for creating new payments)
 */
export const validatePaymentAmount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { purchase_invoice_id, amount } = req.body;

    if (!purchase_invoice_id || !amount) {
      return next(); // Will be validated by controller
    }

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;
    
    // Fetch invoice details
    const { data: invoice, error: invoiceError } = await adminClient
      .schema('procurement')
      .from('purchase_invoices')
      .select('total_amount, paid_amount, status')
      .eq('id', purchase_invoice_id)
      .eq('company_id', req.companyId)
      .single();

    if (invoiceError || !invoice) {
      throw new ApiError(404, 'Purchase invoice not found');
    }

    if (invoice.status === 'cancelled') {
      throw new ValidationError('Cannot create payment for a cancelled invoice');
    }

    if (invoice.status === 'paid') {
      throw new ValidationError('Invoice is already fully paid');
    }

    const currentPaidAmount = invoice.paid_amount || 0;
    const remainingBalance = invoice.total_amount - currentPaidAmount;

    if (amount > remainingBalance) {
      throw new ValidationError(
        `Payment amount (${amount}) exceeds invoice balance (${remainingBalance}). ` +
        `Total invoice amount: ${invoice.total_amount}, Already paid: ${currentPaidAmount}`
      );
    }

    if (amount <= 0) {
      throw new ValidationError('Payment amount must be greater than 0');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to validate payment amount update doesn't exceed invoice balance
 */
export const validatePaymentAmountUpdate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    // If amount is not being updated, skip validation
    if (amount === undefined) {
      return next();
    }

    if (amount <= 0) {
      throw new ValidationError('Payment amount must be greater than 0');
    }

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;
    
    // Fetch current payment details
    const { data: payment, error: paymentError } = await adminClient
      .schema('procurement')
      .from('supplier_payments')
      .select('purchase_invoice_id, amount, status')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (paymentError || !payment) {
      throw new ApiError(404, 'Supplier payment not found');
    }

    if (!payment.purchase_invoice_id) {
      return next(); // No invoice associated, skip validation
    }

    // Fetch invoice details
    const { data: invoice, error: invoiceError } = await adminClient
      .schema('procurement')
      .from('purchase_invoices')
      .select('total_amount, paid_amount, status')
      .eq('id', payment.purchase_invoice_id)
      .eq('company_id', req.companyId)
      .single();

    if (invoiceError || !invoice) {
      throw new ApiError(404, 'Purchase invoice not found');
    }

    if (invoice.status === 'cancelled') {
      throw new ValidationError('Cannot update payment for a cancelled invoice');
    }

    // Calculate current paid amount excluding this payment (if it was completed)
    // We need to recalculate what the paid_amount would be without this payment
    const { data: allPayments } = await adminClient
      .schema('procurement')
      .from('supplier_payments')
      .select('id, amount, status')
      .eq('purchase_invoice_id', payment.purchase_invoice_id)
      .eq('company_id', req.companyId);

    // Calculate paid amount excluding the current payment being updated
    const paidAmountExcludingThis = (allPayments || [])
      .filter((p: any) => p.status === 'completed' && p.id !== id)
      .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    // Calculate remaining balance after excluding current payment
    const remainingBalance = invoice.total_amount - paidAmountExcludingThis;

    // Check if new amount exceeds remaining balance
    if (amount > remainingBalance) {
      throw new ValidationError(
        `Payment amount (${amount}) exceeds invoice balance (${remainingBalance}). ` +
        `Total invoice amount: ${invoice.total_amount}, Already paid (excluding this payment): ${paidAmountExcludingThis}`
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to validate payment status transitions
 */
export const validatePaymentStatusTransition = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return next(); // No status change, skip validation
    }

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;
    const { data: payment, error } = await adminClient
      .schema('procurement')
      .from('supplier_payments')
      .select('status')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (error || !payment) {
      throw new ApiError(404, 'Supplier payment not found');
    }

    const currentStatus = payment.status;
    const allowedTransitions = VALID_PAYMENT_STATUS_TRANSITIONS[currentStatus] || [];

    // Admin override: Allow admins to skip 'processing' and go directly from 'pending' to 'completed'
    const isAdmin = req.user?.roles?.includes('admin') || false;
    const isAllowedTransition = allowedTransitions.includes(status) || 
      (isAdmin && currentStatus === 'pending' && status === 'completed');

    if (!isAllowedTransition) {
      throw new ValidationError(
        `Invalid status transition: Cannot change payment status from '${currentStatus}' to '${status}'. ` +
        `Allowed transitions: ${allowedTransitions.join(', ') || 'none (terminal state)'}`
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to validate PO items can't be modified when PO is approved/ordered
 */
export const validatePOItemModification = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return next(); // No items to modify, skip validation
    }

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;
    const { data: po, error } = await adminClient
      .schema('procurement')
      .from('purchase_orders')
      .select('status')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (error || !po) {
      throw new ApiError(404, 'Purchase order not found');
    }

    const restrictedStatuses = ['approved', 'ordered', 'partially_received', 'received'];
    if (restrictedStatuses.includes(po.status)) {
      throw new ValidationError(
        `Cannot modify PO items when PO status is '${po.status}'. ` +
        `Items can only be modified when PO is in 'draft' or 'pending' status.`
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to validate GRN quantities don't exceed ordered quantities
 */
export const validateGRNQuantities = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { items, purchase_order_id } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return next(); // Will be validated by controller
    }

    if (!purchase_order_id) {
      return next(); // Will be validated by controller
    }

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;
    
    // Fetch PO items with their quantities
    const { data: poItems, error: poError } = await adminClient
      .schema('procurement')
      .from('purchase_order_items')
      .select('id, quantity, received_quantity')
      .eq('purchase_order_id', purchase_order_id)
      .eq('company_id', req.companyId);

    if (poError) {
      throw new ApiError(500, 'Failed to fetch purchase order items');
    }

    if (!poItems || poItems.length === 0) {
      throw new ApiError(404, 'Purchase order items not found');
    }

    // Fetch all existing GRNs for this PO (completed, pending, inspected) to calculate total received
    const { data: existingGRNs, error: grnsError } = await adminClient
      .schema('procurement')
      .from('goods_receipts')
      .select('id, status')
      .eq('purchase_order_id', purchase_order_id)
      .eq('company_id', req.companyId)
      .in('status', ['pending', 'inspected', 'completed']);

    const existingGRNIds = existingGRNs?.map((grn: any) => grn.id) || [];
    const completedGRNIds = existingGRNs?.filter((grn: any) => grn.status === 'completed').map((grn: any) => grn.id) || [];
    const pendingGRNIds = existingGRNIds.filter((id: string) => !completedGRNIds.includes(id));
    
    let existingReceivedQuantities = new Map<string, number>();

    if (existingGRNIds.length > 0) {
      // For completed GRNs, use quantity_accepted (what was actually received and updated PO)
      if (completedGRNIds.length > 0) {
        const { data: completedGRNItems } = await adminClient
          .schema('procurement')
          .from('goods_receipt_items')
          .select('purchase_order_item_id, quantity_accepted')
          .in('goods_receipt_id', completedGRNIds)
          .eq('company_id', req.companyId);

        completedGRNItems?.forEach((grnItem: any) => {
          const currentTotal = existingReceivedQuantities.get(grnItem.purchase_order_item_id) || 0;
          existingReceivedQuantities.set(
            grnItem.purchase_order_item_id,
            currentTotal + (grnItem.quantity_accepted || 0)
          );
        });
      }

      // For pending/inspected GRNs, use quantity_received (what's planned to be received)
      if (pendingGRNIds.length > 0) {
        const { data: pendingGRNItems } = await adminClient
          .schema('procurement')
          .from('goods_receipt_items')
          .select('purchase_order_item_id, quantity_received')
          .in('goods_receipt_id', pendingGRNIds)
          .eq('company_id', req.companyId);

        pendingGRNItems?.forEach((grnItem: any) => {
          const currentTotal = existingReceivedQuantities.get(grnItem.purchase_order_item_id) || 0;
          existingReceivedQuantities.set(
            grnItem.purchase_order_item_id,
            currentTotal + (grnItem.quantity_received || 0)
          );
        });
      }
    }

    // Create a map of PO item ID to available quantity
    // Available = ordered - (all GRN quantities including pending)
    const poItemsMap = new Map(poItems.map((item: any) => {
      const totalInAllGRNs = existingReceivedQuantities.get(item.id) || 0;
      const available = Math.max(0, item.quantity - totalInAllGRNs);
      
      return [
        item.id,
        {
          ordered: item.quantity,
          alreadyReceived: totalInAllGRNs, // Total across all GRNs
          available: available
        }
      ];
    }));

    // Validate each GRN item
    for (const grnItem of items) {
      if (!grnItem.purchase_order_item_id || !grnItem.quantity_received) {
        continue; // Will be validated by controller
      }

      const poItem = poItemsMap.get(grnItem.purchase_order_item_id);
      if (!poItem) {
        throw new ValidationError(
          `Purchase order item ${grnItem.purchase_order_item_id} not found in the purchase order`
        );
      }

      const requestedQuantity = grnItem.quantity_received || 0;
      if (requestedQuantity > poItem.available) {
        throw new ValidationError(
          `Cannot receive ${requestedQuantity} units. ` +
          `Only ${poItem.available} units available (ordered: ${poItem.ordered}, already in GRNs: ${poItem.alreadyReceived})`
        );
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to validate invoice amounts don't exceed received amounts
 */
export const validateInvoiceAmounts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { goods_receipt_id, subtotal, total_amount } = req.body;

    if (!goods_receipt_id) {
      return next(); // Will be validated by controller
    }

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    const adminClient = supabaseAdmin || supabase;
    
    // Fetch GRN total amount
    const { data: grn, error: grnError } = await adminClient
      .schema('procurement')
      .from('goods_receipts')
      .select('total_received_amount')
      .eq('id', goods_receipt_id)
      .eq('company_id', req.companyId)
      .single();

    if (grnError || !grn) {
      throw new ApiError(404, 'Goods receipt not found');
    }

    const grnAmount = grn.total_received_amount || 0;
    const invoiceSubtotal = subtotal || total_amount || 0;

    // Allow some tolerance for tax/discount adjustments, but warn if significantly different
    // Invoice can be slightly higher due to tax, or lower due to discounts
    // But if it's more than 20% higher, that's suspicious
    if (invoiceSubtotal > grnAmount * 1.2) {
      throw new ValidationError(
        `Invoice amount (${invoiceSubtotal}) significantly exceeds GRN received amount (${grnAmount}). ` +
        `Please verify the amounts.`
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

