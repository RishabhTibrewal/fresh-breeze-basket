import { supabaseAdmin } from '../config/supabase';
import { supabase } from '../config/supabase';

/**
 * Check and mark overdue invoices based on due_date
 * This function should be called periodically (e.g., daily via cron job)
 */
export const checkOverdueInvoices = async () => {
  try {
    console.log('Checking for overdue invoices...');
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Find all invoices with due_date < today and status = 'pending' or 'partial'
    const { data: overdueInvoices, error } = await (supabaseAdmin || supabase)
      .schema('procurement')
      .from('purchase_invoices')
      .select('id, invoice_number, due_date, status, company_id')
      .lt('due_date', today)
      .in('status', ['pending', 'partial'])
      .not('due_date', 'is', null);

    if (error) {
      console.error('Error fetching overdue invoices:', error);
      return;
    }

    if (!overdueInvoices || overdueInvoices.length === 0) {
      console.log('No overdue invoices found');
      return;
    }

    console.log(`Found ${overdueInvoices.length} overdue invoices`);

    // Update status to 'overdue' for each invoice
    const invoiceIds = overdueInvoices.map(inv => inv.id);
    
    const { error: updateError } = await (supabaseAdmin || supabase)
      .schema('procurement')
      .from('purchase_invoices')
      .update({
        status: 'overdue',
        updated_at: new Date().toISOString()
      })
      .in('id', invoiceIds);

    if (updateError) {
      console.error('Error updating overdue invoices:', updateError);
      return;
    }

    console.log(`Successfully marked ${invoiceIds.length} invoices as overdue`);
    
    // Log details for each overdue invoice
    overdueInvoices.forEach(invoice => {
      console.log(`Invoice ${invoice.invoice_number} (ID: ${invoice.id}) marked as overdue. Due date: ${invoice.due_date}`);
    });

    return {
      success: true,
      count: invoiceIds.length,
      invoices: overdueInvoices
    };
  } catch (error) {
    console.error('Error in checkOverdueInvoices:', error);
    throw error;
  }
};

/**
 * Initialize invoice scheduler
 * This should be called on server startup to check for overdue invoices
 * and set up periodic checks
 */
export const initInvoiceScheduler = async () => {
  try {
    console.log('Initializing invoice scheduler...');
    
    // Check for overdue invoices immediately on startup
    await checkOverdueInvoices();
    
    // Set up periodic check (every 24 hours)
    // Note: In production, you might want to use a proper cron job system
    // For now, we'll use setInterval (runs every 24 hours)
    const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
    
    setInterval(async () => {
      try {
        await checkOverdueInvoices();
      } catch (error) {
        console.error('Error in scheduled overdue invoice check:', error);
      }
    }, CHECK_INTERVAL_MS);
    
    console.log('Invoice scheduler initialized successfully. Will check for overdue invoices every 24 hours.');
  } catch (error) {
    console.error('Error initializing invoice scheduler:', error);
  }
};

