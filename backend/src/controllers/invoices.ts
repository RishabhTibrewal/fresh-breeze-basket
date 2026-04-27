import { Request, Response, NextFunction } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { ApiError } from '../middleware/error';

function formatThermalItemName(productName?: string | null, variantName?: string | null): string {
  const p = (productName || '').trim();
  const v = (variantName || '').trim();
  if (!p && !v) return 'Item';
  if (!v) return p || 'Item';
  if (!p) return v;
  if (p.toLowerCase() === v.toLowerCase()) return p;
  return `${p} (${v})`;
}

/**
 * Generate 80mm thermal-optimized HTML for KOT/Customer Bills
 */
const generateThermalKOTHTML = async (orderId: string, companyId: string, type: 'kitchen' | 'customer') => {
  // 1. Fetch Data (including modifiers)
  const [companyRes, orderRes] = await Promise.all([
    (supabaseAdmin || supabase).from('companies').select('*').eq('id', companyId).single(),
    (supabaseAdmin || supabase).from('orders').select(`
      *,
      order_items (
        *,
        product:products(name),
        variant:product_variants(name, unit_type),
        order_item_modifiers (
          *,
          modifier:modifiers(name)
        )
      )
    `).eq('id', orderId).eq('company_id', companyId).single()
  ]);

  const company = companyRes.data;
  const order = orderRes.data;

  if (!order) throw new ApiError(404, 'Order not found');

  const isKitchen = type === 'kitchen';
  const companyName = company?.name || 'Store';
  const dateStr = new Date(order.created_at).toLocaleString('en-IN', {
    dateStyle: 'short',
    timeStyle: 'short'
  });

  // Extract Table/Customer info from notes/customer_id
  let tableNo = '';
  if (order.notes) {
    const tableMatch = order.notes.match(/Table:\s*([^\s|]+)/i);
    if (tableMatch) tableNo = tableMatch[1];
  }

  let customerName = 'Walk-in';
  if (order.customer_id) {
    const { data: cust } = await (supabaseAdmin || supabase)
      .from('customers')
      .select('name')
      .eq('id', order.customer_id)
      .single();
    if (cust) customerName = cust.name;
  }

  // Styles for 80mm printing
  const styles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Courier New', Courier, monospace; 
      width: 300px; 
      padding: 10px; 
      font-size: 13px; 
      line-height: 1.2;
      color: #000;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
    .header { margin-bottom: 10px; }
    .header h2 { font-size: 18px; margin-bottom: 4px; }
    .fulfillment-badge { 
      display: block; 
      border: 2px solid #000; 
      padding: 5px; 
      margin: 10px 0; 
      font-size: 20px; 
      font-weight: bold; 
      text-align: center;
    }
    .items-table { width: 100%; border-collapse: collapse; margin-top: 5px; }
    .items-table th { border-bottom: 1px solid #000; padding: 5px 0; font-size: 11px; text-transform: uppercase; }
    .items-table td { vertical-align: top; padding: 6px 0; font-size: 12px; }
    .item-name { font-weight: bold; font-size: 13px; display: block; }
    .item-qty { text-align: center; }
    .item-amount { text-align: right; font-weight: bold; }
    .modifier { font-size: 10px; padding-left: 5px; font-style: italic; color: #333; }
    .totals-section { margin-top: 10px; }
    .totals-row { display: flex; justify-content: space-between; padding: 2px 0; }
    .grand-total { border-top: 1px solid #000; margin-top: 5px; padding-top: 5px; font-size: 16px; font-weight: bold; }
    .footer { margin-top: 20px; font-size: 10px; }
    @media print {
      @page { margin: 0; }
      body { width: 100%; padding: 5mm; }
    }
  `;

  // Items List
  let itemsHTML = '';
  order.order_items.forEach((item: any) => {
    const itemName = formatThermalItemName(item.product?.name, item.variant?.name);
    const mods = item.order_item_modifiers || [];
    const modsHTML = mods.map((m: any) => `<div class="modifier">- ${m.modifier?.name}</div>`).join('');
    
    if (isKitchen) {
      itemsHTML += `
        <tr>
          <td width="30" class="bold">${item.quantity}x</td>
          <td>
            <span class="item-name">${itemName.toUpperCase()}</span>
            ${modsHTML}
          </td>
        </tr>
      `;
    } else {
      const unitPrice = Number(item.unit_price || 0);
      const lineTotal = Number(item.line_total || (unitPrice * item.quantity));
      itemsHTML += `
        <tr>
          <td width="160">
            <span class="item-name">${itemName}</span>
            ${modsHTML}
          </td>
          <td width="40" class="item-qty">${item.quantity}</td>
          <td width="100" class="item-amount">${lineTotal.toFixed(2)}</td>
        </tr>
      `;
    }
  });

  // Totals Section (Customer only)
  let totalsHTML = '';
  if (!isKitchen) {
    const subtotal = Number(order.subtotal || 0);
    const itemDiscount = Number(order.total_discount || 0);
    const extraDiscount = Number(order.extra_discount_amount || 0);
    const totalTax = Number(order.total_tax || 0);
    const roundOff = Number(order.round_off_amount || 0);
    const grandTotal = Number(order.total_amount || 0);

    totalsHTML = `
      <div class="totals-section">
        <div class="totals-row">
          <span>Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        ${itemDiscount > 0 ? `
          <div class="totals-row">
            <span>Item Discount</span>
            <span>-${itemDiscount.toFixed(2)}</span>
          </div>
        ` : ''}
        ${extraDiscount > 0 ? `
          <div class="totals-row">
            <span>Extra Discount ${order.extra_discount_percentage > 0 ? `(${order.extra_discount_percentage}%)` : ''}</span>
            <span>-${extraDiscount.toFixed(2)}</span>
          </div>
        ` : ''}
        <div class="totals-row">
          <span>Tax</span>
          <span>${totalTax.toFixed(2)}</span>
        </div>
        ${roundOff !== 0 ? `
          <div class="totals-row">
            <span>Round Off</span>
            <span>${roundOff > 0 ? '+' : ''}${roundOff.toFixed(2)}</span>
          </div>
        ` : ''}
        <div class="totals-row grand-total">
          <span>TOTAL</span>
          <span>${grandTotal.toFixed(2)}</span>
        </div>
      </div>
    `;
  }

  const title = isKitchen ? 'KITCHEN ORDER TICKET' : 'CUSTOMER BILL';
  const fulfillmentLabel = (order.fulfillment_type || 'Take Away').replace('_', ' ').toUpperCase();

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>${styles}</style>
    </head>
    <body>
      <div class="header text-center">
        ${!isKitchen ? `<h2 class="bold">${companyName}</h2>` : ''}
        <div class="bold">${title}</div>
        <div>${order.receipt_number || `ORD-${order.id.substring(0, 8)}`}</div>
        <div>${dateStr}</div>
      </div>

      <div class="divider"></div>

      <div class="meta-info">
        ${tableNo ? `<div><span class="bold">TABLE:</span> ${tableNo}</div>` : ''}
        <div><span class="bold">CUST:</span> ${customerName}</div>
      </div>

      <div class="fulfillment-badge">${fulfillmentLabel}</div>

      <div class="divider"></div>

      <table class="items-table">
        ${isKitchen ? '' : `
          <thead>
            <tr>
              <th style="text-align: left;">Item</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
        `}
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>

      <div class="divider"></div>

      ${totalsHTML}

      ${order.notes ? `<div class="footer"><span class="bold">NOTES:</span> ${order.notes}</div>` : ''}
      
      ${!isKitchen ? `
        <div class="text-center footer" style="margin-top: 20px;">
          <p>Thank you for visit!</p>
          <p>Please come again</p>
        </div>
      ` : ''}
    </body>
    </html>
  `;
};

type KotSnapshotLine = {
  quantity: number;
  kitchen_display_name: string;
  modifiers_snapshot?: Array<{ name: string }>;
};

const kitchenThermalStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Courier New', Courier, monospace; 
      width: 300px; 
      padding: 10px; 
      font-size: 13px; 
      line-height: 1.2;
      color: #000;
    }
    .text-center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
    .header { margin-bottom: 10px; }
    .header h2 { font-size: 18px; margin-bottom: 4px; }
    .fulfillment-badge { 
      display: block; 
      border: 2px solid #000; 
      padding: 5px; 
      margin: 10px 0; 
      font-size: 20px; 
      font-weight: bold; 
      text-align: center;
    }
    .items-table { width: 100%; border-collapse: collapse; margin-top: 5px; }
    .items-table td { vertical-align: top; padding: 6px 0; font-size: 12px; }
    .item-name { font-weight: bold; font-size: 13px; display: block; }
    .modifier { font-size: 10px; padding-left: 5px; font-style: italic; color: #333; }
    .ticket-block { margin-bottom: 16px; page-break-inside: avoid; }
    @media print {
      @page { margin: 0; }
      body { width: 100%; padding: 5mm; }
    }
  `;

async function loadKotOrderMeta(orderId: string, companyId: string) {
  const { data: order } = await (supabaseAdmin || supabase)
    .from('orders')
    .select('created_at, notes, fulfillment_type, customer_id')
    .eq('id', orderId)
    .eq('company_id', companyId)
    .single();

  if (!order) throw new ApiError(404, 'Order not found');

  const dateStr = new Date(order.created_at).toLocaleString('en-IN', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  let tableNo = '';
  if (order.notes) {
    const tableMatch = String(order.notes).match(/Table:\s*([^\s|]+)/i);
    if (tableMatch) tableNo = tableMatch[1];
  }

  let customerName = 'Walk-in';
  if (order.customer_id) {
    const { data: cust } = await (supabaseAdmin || supabase)
      .from('customers')
      .select('name')
      .eq('id', order.customer_id)
      .single();
    if (cust?.name) customerName = cust.name;
  }

  const fulfillmentLabel = (order.fulfillment_type || 'Take Away').replace('_', ' ').toUpperCase();
  return { dateStr, tableNo, customerName, fulfillmentLabel };
}

function parseTicketSnapshot(raw: unknown): KotSnapshotLine[] {
  if (Array.isArray(raw)) return raw as KotSnapshotLine[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as KotSnapshotLine[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function renderSnapshotLinesHtml(lines: KotSnapshotLine[]): string {
  return lines
    .map((item) => {
      const mods = item.modifiers_snapshot || [];
      const modsHTML = mods.map((m) => `<div class="modifier">- ${m.name}</div>`).join('');
      return `
        <tr>
          <td width="30" class="bold">${item.quantity}x</td>
          <td>
            <span class="item-name">${String(item.kitchen_display_name || 'Item').toUpperCase()}</span>
            ${modsHTML}
          </td>
        </tr>`;
    })
    .join('');
}

async function generateKitchenHtmlFromTicketSnapshots(
  orderId: string,
  companyId: string,
  tickets: Array<{ kot_number_text: string; ticket_items_snapshot: unknown }>
): Promise<string> {
  const meta = await loadKotOrderMeta(orderId, companyId);
  const blocks = tickets
    .map((t) => {
      const lines = parseTicketSnapshot(t.ticket_items_snapshot);
      const rows = renderSnapshotLinesHtml(lines);
      return `
      <div class="ticket-block">
        <div class="header text-center">
          <div class="bold">KITCHEN ORDER TICKET</div>
          <div class="bold">${t.kot_number_text}</div>
          <div>${meta.dateStr}</div>
        </div>
        <div class="divider"></div>
        <div class="meta-info">
          ${meta.tableNo ? `<div><span class="bold">TABLE:</span> ${meta.tableNo}</div>` : ''}
          <div><span class="bold">CUST:</span> ${meta.customerName}</div>
        </div>
        <div class="fulfillment-badge">${meta.fulfillmentLabel}</div>
        <div class="divider"></div>
        <table class="items-table"><tbody>${rows}</tbody></table>
      </div>`;
    })
    .join('<div class="divider"></div>');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Kitchen KOT</title>
      <style>${kitchenThermalStyles}</style>
    </head>
    <body>
      ${blocks}
    </body>
    </html>
  `;
}

/**
 * GET /api/invoices/kot/ticket/:ticketId/kitchen — thermal HTML from JSONB snapshot only
 */
export const getKitchenKOTByTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ticketId } = req.params;
    const companyId = req.companyId!;
    const { data: ticket, error } = await (supabaseAdmin || supabase)
      .from('pos_kot_tickets')
      .select('order_id, kot_number_text, ticket_items_snapshot')
      .eq('id', ticketId)
      .eq('company_id', companyId)
      .single();

    if (error || !ticket) throw new ApiError(404, 'KOT ticket not found');

    const html = await generateKitchenHtmlFromTicketSnapshots(
      ticket.order_id,
      companyId,
      [{ kot_number_text: ticket.kot_number_text, ticket_items_snapshot: ticket.ticket_items_snapshot }]
    );
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Get Kitchen KOT (Thermal)
 */
export const getKitchenKOT = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const companyId = req.companyId!;

    const { data: tickets } = await (supabaseAdmin || supabase)
      .from('pos_kot_tickets')
      .select('kot_number_text, ticket_items_snapshot')
      .eq('order_id', orderId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });

    if (tickets && tickets.length > 0) {
      const html = await generateKitchenHtmlFromTicketSnapshots(
        orderId,
        companyId,
        tickets as Array<{ kot_number_text: string; ticket_items_snapshot: unknown }>
      );
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
      return;
    }

    const html = await generateThermalKOTHTML(orderId, companyId, 'kitchen');
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Get Customer KOT/Bill (Thermal)
 */
export const getCustomerKOT = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const companyId = req.companyId!;
    const html = await generateThermalKOTHTML(orderId, companyId, 'customer');
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    next(error);
  }
};

function numberToWords(num: number): string {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    if (num === 0) return 'Zero';
    if (num < 0) return 'Minus ' + numberToWords(Math.abs(num));
    
    let str = num.toString().split('.')[0];
    if (str.length > 9) return 'Overflow';
    
    const n = ('000000000' + str).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    let res = '';
    res += (Number(n[1]) != 0) ? (a[Number(n[1])] || b[n[1][0] as any] + ' ' + a[n[1][1] as any]) + 'Crore ' : '';
    res += (Number(n[2]) != 0) ? (a[Number(n[2])] || b[n[2][0] as any] + ' ' + a[n[2][1] as any]) + 'Lakh ' : '';
    res += (Number(n[3]) != 0) ? (a[Number(n[3])] || b[n[3][0] as any] + ' ' + a[n[3][1] as any]) + 'Thousand ' : '';
    res += (Number(n[4]) != 0) ? (a[Number(n[4])] || b[n[4][0] as any] + ' ' + a[n[4][1] as any]) + 'Hundred ' : '';
    res += (Number(n[5]) != 0) ? ((res != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0] as any] + ' ' + a[n[5][1] as any]) : '';
    return res.trim() + ' Only';
}

const generateInvoiceHTML = async (orderId: string, companyId: string, documentTitle: string = 'TAX INVOICE') => {
    // 1. Data Fetching
    const [companyRes, orderRes, creditPeriodRes] = await Promise.all([
      (supabaseAdmin || supabase).from('companies').select('*').eq('id', companyId).single(),
      (supabaseAdmin || supabase).from('orders').select(`
        *,
        order_items (*, variant:product_variants(*), product:products(*))
      `).eq('id', orderId).eq('company_id', companyId).single(),
      (supabaseAdmin || supabase).from('credit_periods').select('end_date').eq('order_id', orderId).maybeSingle()
    ]);

    const company = companyRes.data;
    const order = orderRes.data;
    if (!order) throw new ApiError(404, 'Order not found');

    const dueDate = creditPeriodRes.data?.end_date;

    // Fetch customer
    let customer: any = null;
    if (order.customer_id || order.user_id) {
      const q = (supabaseAdmin || supabase).from('customers').select('*').eq('company_id', companyId);
      q.eq(order.customer_id ? 'id' : 'user_id', order.customer_id || order.user_id);
      customer = (await q.single()).data;
    }

    // Fetch Address
    let address: any = null;
    if (order.shipping_address_id) {
      address = (await (supabaseAdmin || supabase).from('addresses').select('*').eq('id', order.shipping_address_id).single()).data;
    }
    
    // Format variables
    const companyName = company?.name || 'Your Company';
    const companyGST = company?.gstin || '';
    const companyAddress = [company?.address, company?.city, company?.state, company?.postal_code].filter(Boolean).join(', ');
    const companyPhone = company?.phone || '';
    const companyEmail = company?.email || '';
    
    const invoiceNo = `ORD-${order.id.substring(0,8).toUpperCase()}`;
    const invoiceDate = new Date(order.created_at).toLocaleDateString('en-IN');
    const paymentTerms = dueDate ? `${Math.ceil((new Date(dueDate).getTime() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24))} Days` : 'Due on Receipt';
    
    const custName = customer?.name || 'Walk-in Customer';
    const custAddress = [address?.address_line1, address?.address_line2, address?.city, address?.state, address?.postal_code].filter(Boolean).join(', ');
    const custGST = customer?.trn_number || '';
    
    const subtotal = Number(order.subtotal || 0);
    const totalDiscount = Number(order.total_discount || 0);
    const afterItemDisc = subtotal - totalDiscount;
    const extraDiscount = Number(order.extra_discount_amount || 0);
    const showExtraDisc = extraDiscount > 0;
    
    const cdAmount = Number(order.cd_amount || 0);
    const totalTax = Number(order.total_tax || 0);
    const taxBaseInvoiceLevel = Number(order.taxable_value || 0); // taxable value A or B depending on how logic sets it
    const extraCharges = Number(order.total_extra_charges || 0);
    const roundOff = Number(order.round_off_amount || 0);
    const grandTotal = Number(order.total_amount || 0);

    // Calculate line items
    let itemsHTML = '';
    let totalQty = 0;
    
    // Aggregated tax summary
    const taxSummary: Record<string, { taxable: number, taxRate: number, cgst: number, sgst: number }> = {};
    
    let totalLineAmounts = 0;
    
    order.order_items.forEach((item: any, idx: number) => {
        const qty = Number(item.quantity) || 0;
        totalQty += qty;
        
        const price = Number(item.unit_price) || 0;
        const lineDiscount = Number(item.discount_amount || 0);
        
        const taxableAmtA = (price * qty) - lineDiscount;
        let extraDiscShare = 0;
        if (showExtraDisc && afterItemDisc > 0) {
            extraDiscShare = (taxableAmtA / afterItemDisc) * extraDiscount;
        }
        const netTaxableB = taxableAmtA - extraDiscShare;
        
        const taxRate = Number(item.tax_percentage || 0);
        const cgstSgstRate = taxRate / 2;
        const taxVal = Number(item.tax_amount || 0);
        const totalLineAmount = netTaxableB + taxVal;
        
        totalLineAmounts += totalLineAmount;
        
        const desc = item.variant?.name || item.product?.name || 'Item';
        const hsn = item.variant?.hsn || '-';
        const unit = item.variant?.unit_type || 'PCS';
        const discPct = Number(item.discount_percentage || 0);

        if (showExtraDisc) {
            itemsHTML += `
                <tr class="item-row">
                    <td class="text-center">${idx + 1}</td>
                    <td>${desc}</td>
                    <td class="text-center">${hsn}</td>
                    <td class="text-center">${qty.toFixed(3)} ${unit}</td>
                    <td class="text-right">${price.toFixed(2)}</td>
                    <td class="text-right">${discPct ? discPct + '%' : '-'}</td>
                    <td class="text-right">${taxableAmtA.toFixed(2)}</td>
                    <td class="text-right">${extraDiscShare.toFixed(2)}</td>
                    <td class="text-right">${netTaxableB.toFixed(2)}</td>
                    <td class="text-center">${taxRate}%</td>
                    <td class="text-right">${totalLineAmount.toFixed(2)}</td>
                </tr>
            `;
        } else {
            itemsHTML += `
                <tr class="item-row">
                    <td class="text-center">${idx + 1}</td>
                    <td>${desc}</td>
                    <td class="text-center">${hsn}</td>
                    <td class="text-center">${qty.toFixed(3)} ${unit}</td>
                    <td class="text-right">${price.toFixed(2)}</td>
                    <td class="text-right">${discPct ? discPct + '%' : '-'}</td>
                    <td class="text-right">${taxableAmtA.toFixed(2)}</td>
                    <td class="text-center">${taxRate}%</td>
                    <td class="text-right">${totalLineAmount.toFixed(2)}</td>
                </tr>
            `;
        }
        
        // Add to tax summary
        if (taxRate > 0) {
            const key = taxRate.toString();
            if (!taxSummary[key]) {
                taxSummary[key] = { taxable: 0, taxRate, cgst: 0, sgst: 0 };
            }
            taxSummary[key].taxable += netTaxableB;
            taxSummary[key].cgst += taxVal / 2;
            taxSummary[key].sgst += taxVal / 2;
        }
    });

    // Add extra charges to tax summary
    if (order.extra_charges && Array.isArray(order.extra_charges)) {
        order.extra_charges.forEach((ec: any) => {
            const taxRate = Number(ec.tax_percent) || 0;
            if (taxRate > 0) {
                const amount = Number(ec.amount) || 0;
                const taxVal = amount * taxRate / 100;
                
                const key = taxRate.toString();
                if (!taxSummary[key]) {
                    taxSummary[key] = { taxable: 0, taxRate, cgst: 0, sgst: 0 };
                }
                taxSummary[key].taxable += amount;
                taxSummary[key].cgst += taxVal / 2;
                taxSummary[key].sgst += taxVal / 2;
            }
        });
    }

    // Fill remaining rows to ensure full page height if few items
    const minRows = 12;
    const emptyRowsCount = Math.max(0, minRows - order.order_items.length);
    for (let i = 0; i < emptyRowsCount; i++) {
        if (showExtraDisc) {
            itemsHTML += `
                <tr class="item-row empty-row">
                    <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                    <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                </tr>
            `;
        } else {
            itemsHTML += `
                <tr class="item-row empty-row">
                    <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                    <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                </tr>
            `;
        }
    }
    
    let taxSummaryHTML = '';
    Object.values(taxSummary).forEach(ts => {
        taxSummaryHTML += `
            <tr>
                <td class="text-center">${ts.taxRate}%</td>
                <td class="text-right">${ts.taxable.toFixed(2)}</td>
                <td class="text-right">${ts.cgst.toFixed(2)}</td>
                <td class="text-right">${ts.sgst.toFixed(2)}</td>
                <td class="text-right">${(ts.cgst + ts.sgst).toFixed(2)}</td>
            </tr>
        `;
    });
    
    if (Object.keys(taxSummary).length === 0) {
        taxSummaryHTML = `
            <tr><td colspan="5" class="text-center" style="color:#666">No tax applied</td></tr>
        `;
    }

    let totalsSummaryHTML = '';

    totalsSummaryHTML += `
        <div class="totals-row border-bottom">
            <div class="totals-label" style="font-weight:bold;">Subtotal (Sum of Items)</div>
            <div class="totals-value" style="font-weight:bold;">${subtotal.toFixed(2)}</div>
        </div>
    `;

    if (totalDiscount > 0) {
        totalsSummaryHTML += `
            <div class="totals-row border-bottom">
                <div class="totals-label" style="color:#ef4444;">Less: Total Discount (Item Level) (-)</div>
                <div class="totals-value" style="color:#ef4444;">-${totalDiscount.toFixed(2)}</div>
            </div>
        `;
    }

    const taxableValue = afterItemDisc;
    const total = taxableValue + totalTax;

    totalsSummaryHTML += `
        <div class="totals-row border-bottom">
            <div class="totals-label" style="color:#52525b;">Taxable Amount</div>
            <div class="totals-value" style="color:#52525b;">${taxableValue.toFixed(2)}</div>
        </div>
    `;

    totalsSummaryHTML += `
        <div class="totals-row border-bottom">
            <div class="totals-label" style="color:#52525b;">Total Item Tax</div>
            <div class="totals-value" style="color:#52525b;">${totalTax.toFixed(2)}</div>
        </div>
    `;

    totalsSummaryHTML += `
        <div class="totals-row border-bottom" style="background-color:#f4f4f5; font-weight:bold;">
            <div class="totals-label">Total</div>
            <div class="totals-value">${total.toFixed(2)}</div>
        </div>
    `;

    if (extraDiscount > 0) {
        totalsSummaryHTML += `
            <div class="totals-row border-bottom">
                <div class="totals-label" style="color:#ef4444;">Less: Extra Discount (-)</div>
                <div class="totals-value" style="color:#ef4444;">-${extraDiscount.toFixed(2)}</div>
            </div>
        `;
    }

    if (extraCharges > 0) {
        // Find if we have specific extra charges formatted to list their tax
        let chargeDetails = 'Extra Charges';
        if (order.extra_charges && Array.isArray(order.extra_charges) && order.extra_charges.length > 0) {
            const names = order.extra_charges.map((ec: any) => {
                const taxStr = ec.tax_percent ? ` @ ${ec.tax_percent}% GST` : '';
                return `${ec.name}${taxStr}`;
            });
            chargeDetails = `Extra Charges (${names.join(', ')})`;
        }

        totalsSummaryHTML += `
            <div class="totals-row border-bottom">
                <div class="totals-label" style="color:#ea580c;">Add: ${chargeDetails} (+)</div>
                <div class="totals-value" style="color:#ea580c;">+${extraCharges.toFixed(2)}</div>
            </div>
        `;
    }

    if (roundOff !== 0) {
        totalsSummaryHTML += `
            <div class="totals-row border-bottom">
                <div class="totals-label" style="color:#52525b;">Round Off (+/-)</div>
                <div class="totals-value" style="color:#52525b;">${roundOff > 0 ? '+' : ''}${roundOff.toFixed(2)}</div>
            </div>
        `;
    }

    const amountInWords = 'Rupees ' + numberToWords(Math.round(grandTotal));
    
    // Bank Details HTML
    const bankDetailsObj = company?.bank_details && company.bank_details.length > 0 ? company.bank_details[0] : null;
    let bankHTML = '';
    if (bankDetailsObj) {
        bankHTML = `
            <strong>BANK NAME :</strong> ${bankDetailsObj.bank_name || ''} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <strong>A/C No. :</strong> ${bankDetailsObj.account_number || ''} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <strong>IFSC CODE :</strong> ${bankDetailsObj.ifsc_code || ''}
            ${bankDetailsObj.upi_id ? `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>UPI :</strong> ${bankDetailsObj.upi_id}` : ''}
        `;
    } else {
        bankHTML = `<em>Bank details not configured. Add bank details in Company Settings.</em>`;
    }

    const tncText = order.notes || "1. Due date has been calculated as per agreed payment terms\n2. Interest @ 18% will be charged if payment is delayed beyond due date.\n3. No complaints in respect of material supplied vide this invoice will be entertained unless the same is lodged in writing within 10 days of dispatch.\n4. All disputes are subject to local Jurisdiction\n5. All ex-factory dispatch of goods are at owner's risk.";
    const formattedTnc = tncText.split('\n').map((line: string) => `<div>${line}</div>`).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tax Invoice - ${invoiceNo}</title>
    <style>
        body { 
            font-family: Arial, Helvetica, sans-serif; 
            font-size: 11px; 
            margin: 0; 
            padding: 20px; 
            color: #000;
            background: #fff;
        }
        * { box-sizing: border-box; }
        .invoice-box {
            max-width: 800px;
            margin: auto;
            border: 1px solid #000;
            background: #fff;
        }
        .header-top {
            display: flex;
            justify-content: space-between;
            padding: 5px 10px;
            font-weight: bold;
        }
        .header-main {
            text-align: center;
            padding: 10px;
            border-bottom: 1px solid #000;
            border-top: 1px solid #000;
            position: relative;
        }
        .header-main h1 {
            color: #d32f2f;
            margin: 5px 0;
            font-size: 24px;
        }
        .header-main p {
            margin: 2px 0;
            font-size: 10px;
        }
        .logo-placeholder {
            position: absolute;
            left: 20px;
            top: 20px;
            width: 80px;
            height: 80px;
            object-fit: contain;
        }
        .meta-section {
            display: flex;
            border-bottom: 1px solid #000;
        }
        .meta-col {
            flex: 1;
            padding: 5px 10px;
        }
        .meta-col:first-child { border-right: 1px solid #000; }
        .meta-table { width: 100%; font-size: 10px; }
        .meta-table td { padding: 2px 0; vertical-align: top; }
        .meta-table td:first-child { width: 100px; }
        
        .address-section {
            display: flex;
            border-bottom: 1px solid #000;
            min-height: 120px;
        }
        .address-col {
            flex: 1;
            padding: 10px;
        }
        .address-col:first-child { border-right: 1px solid #000; }
        .address-col p { margin: 2px 0; line-height: 1.4; }
        
        .items-section {
            border-bottom: 1px solid #000;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
        }
        .items-table th, .items-table td {
            border-right: 1px solid #000;
            padding: 5px;
        }
        .items-table th { border-bottom: 1px solid #000; text-align: center; font-weight: bold; }
        .items-table th:last-child, .items-table td:last-child { border-right: none; }
        .item-row td { border-bottom: none; }
        .empty-row td { color: transparent; height: 18px; }
        
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .font-bold { font-weight: bold; }
        .text-blue-600 { color: #2563eb; }
        
        .totals-section {

        }
        .border-bottom {
            border-bottom: 1px solid #000;
        }
        .totals-row {
            display: flex;
        }
        .totals-row > div {
            padding: 5px 10px;
        }
        .totals-label { flex: 1; text-align: right; border-right: 1px solid #000; }
        .totals-qty { width: 100px; text-align: center; font-weight: bold; border-right: 1px solid #000; padding: 5px 0 !important; }
        .totals-value { width: 100px; text-align: right; font-weight: bold; padding: 5px 0 !important;}
        
        .tax-summary {
            border-bottom: 1px solid #000;
            border-top: 1px solid #000;
            padding: 5px;
            display: flex;
        }
        .tax-table { width: 350px; border-collapse: collapse; font-size: 9px; margin: 0 10px; border-right: 1px solid #ccc; padding-right: 10px; }
        .tax-table th, .tax-table td { padding: 3px; border: none; }
        .tax-table th { border-bottom: 1px solid #000; text-align: right; }
        .tax-table th:first-child { text-align: center; }
        
        .words-section { padding: 10px; font-weight: bold; border-bottom: 1px solid #000; font-size: 12px; }
        
        .bank-section { padding: 5px 10px; border-bottom: 1px solid #000; font-size: 10px; }
        
        .footer-section { display: flex; min-height: 140px; }
        .tnc-box { flex: 2; padding: 10px; border-right: 1px solid #000; font-size: 9px; line-height: 1.5; }
        .tnc-box h4 { margin: 0 0 5px 0; text-decoration: underline; font-size: 10px; }
        .sign-box { flex: 1; position: relative; padding: 10px; padding-top: 20px;}
        .sign-box h4 { margin: 0 0 70px 0; text-align: center; font-size: 11px; }
        .sign-box p { position: absolute; bottom: 10px; width: 100%; text-align: center; font-weight: bold; margin: 0; left: 0; }
        
        .regd-office { text-align: center; padding: 5px; font-size: 9px; border-top: 1px solid #000; }
        
        @media print {
            body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .invoice-box { border: 1px solid #000; border-collapse: collapse; box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="invoice-box">
        <div class="header-top">
            <div>GSTIN : ${companyGST}</div>
            <div style="text-decoration: underline; font-size: 14px;">${documentTitle}</div>
            <div>Original Copy</div>
        </div>
        
        <div class="header-main">
            ${company?.logo_url ? `<img src="${company.logo_url}" class="logo-placeholder" alt="Logo">` : ''}
            <h1>${companyName.toUpperCase()}</h1>
            <p><strong>WORK :</strong> ${companyAddress}</p>
            <p><strong>Tel.:</strong> ${companyPhone} ${companyEmail ? `&nbsp;|&nbsp; <strong>Email :</strong> ${companyEmail}` : ''}</p>
        </div>
        
        <div class="meta-section">
            <div class="meta-col">
                <table class="meta-table">
                    <tr><td>Invoice No.</td><td>: <strong>${invoiceNo}</strong></td></tr>
                    <tr><td>Dated</td><td>: ${invoiceDate}</td></tr>
                    <tr><td>Place of Supply</td><td>: ${address?.state || company?.state || ''}</td></tr>
                    <tr><td>Reference No.</td><td>: ${order.order_number || order.id.substring(0,8).toUpperCase()}</td></tr>
                </table>
            </div>
            <div class="meta-col">
                <table class="meta-table">
                    <tr><td>Reverse Charge</td><td>: N</td></tr>
                    <tr><td>Terms of Payment</td><td>: ${paymentTerms}</td></tr>
                </table>
            </div>
        </div>
        
        <div class="address-section">
            <div class="address-col">
                <p><strong>Billed to : ${custName.toUpperCase()}</strong></p>
                <p>${custAddress}</p>
                ${address?.phone || customer?.phone ? `<p>MOB. NO.-${address?.phone || customer?.phone}</p>` : ''}
                <p style="margin-top: 5px;"><strong>GSTIN / UIN &nbsp;&nbsp;&nbsp;: ${custGST}</strong></p>
            </div>
            <div class="address-col">
                <p><strong>Shipped to : ${custName.toUpperCase()}</strong></p>
                <p>${custAddress}</p>
                ${address?.phone || customer?.phone ? `<p>MOB. NO.-${address?.phone || customer?.phone}</p>` : ''}
                <p style="margin-top: 5px;"><strong>GSTIN / UIN &nbsp;&nbsp;&nbsp;: ${custGST}</strong></p>
            </div>
        </div>
        
        <div class="items-section">
            <table class="items-table">
                <thead>
                    ${showExtraDisc ? `
                    <tr>
                        <th style="width: 3%;">S.N.</th>
                        <th style="width: 25%;">Description of Goods</th>
                        <th style="width: 8%;">HSN/SAC</th>
                        <th style="width: 7%;">Qty</th>
                        <th style="width: 6%;">Price</th>
                        <th style="width: 6%;">Disc%</th>
                        <th style="width: 10%;">Taxable Value (A)</th>
                        <th style="width: 8%;">Extra Disc</th>
                        <th style="width: 9%;">Net Taxable (B)</th>
                        <th style="width: 6%;">GST%</th>
                        <th style="width: 12%;">Total(₹)</th>
                    </tr>
                    ` : `
                    <tr>
                        <th style="width: 4%;">S.N.</th>
                        <th style="width: 35%;">Description of Goods</th>
                        <th style="width: 10%;">HSN/SAC</th>
                        <th style="width: 10%;">Qty</th>
                        <th style="width: 8%;">Price</th>
                        <th style="width: 7%;">Disc%</th>
                        <th style="width: 10%;">Taxable Value (A)</th>
                        <th style="width: 6%;">GST%</th>
                        <th style="width: 10%;">Total(₹)</th>
                    </tr>
                    `}
                </thead>
                <tbody>
                    ${itemsHTML}
                </tbody>
            </table>
        </div>
        
        <div class="totals-section">
            ${totalsSummaryHTML}
            <div class="totals-row">
                <div class="totals-label font-bold">Grand Total</div>
                <div class="totals-qty">${totalQty.toFixed(3)} ${order.order_items[0]?.variant?.unit_type || ''}</div>
                <div class="totals-value font-bold">${grandTotal.toFixed(2)}</div>
            </div>
        </div>
        
        <div class="tax-summary">
            <table class="tax-table">
                <thead>
                    <tr>
                        <th>Tax Rate</th>
                        <th>Taxable Amt.</th>
                        <th>CGST Amt.</th>
                        <th>SGST Amt.</th>
                        <th>Total Tax</th>
                    </tr>
                </thead>
                <tbody>
                    ${taxSummaryHTML}
                </tbody>
            </table>
        </div>
        
        <div class="words-section">
            ${amountInWords}
        </div>
        
        <div class="bank-section">
            <div style="font-weight: bold; margin-bottom: 5px;">Bank Details :</div>
            ${bankHTML}
        </div>
        
        <div class="footer-section">
            <div class="tnc-box">
                <h4>Terms & Conditions</h4>
                ${formattedTnc}
            </div>
            <div class="sign-box">
                <h4>For ${companyName.toUpperCase()}</h4>
                <p>Authorised Signatory</p>
            </div>
        </div>
        
        ${companyAddress ? `<div class="regd-office">Regd. Office : ${companyAddress}</div>` : ''}
    </div>
</body>
</html>`;
};

/**
 * Generate HTML invoice for POS thermal printer (80mm width, professional format)
 * GET /api/invoices/pos/:orderId
 */
export const getPOSInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const companyId = req.companyId;

    if (!companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const html = await generateInvoiceHTML(orderId, companyId);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    next(error);
  }
};

/**
 * Generate A4 PDF invoice for customers
 * GET /api/invoices/customer/:orderId
 */
export const getCustomerBill = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const companyId = req.companyId;

    if (!companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const html = await generateInvoiceHTML(orderId, companyId);

    // Send as attachment to force download in browser
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice_${orderId.substring(0,8).toUpperCase()}.html"`);
    res.send(html);
  } catch (error) {
    next(error);
  }
};

/**
 * Generates and streams a Quotation document (QUOTATION header).
 * GET /api/invoices/quotations/:quotationId?download=true
 */
export const getQuotationDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { quotationId } = req.params;
    const companyId = req.companyId;
    if (!companyId) throw new ApiError(400, 'Company context is required');

    // Fetch quotation & items
    const { data: quotation, error: qErr } = await (supabaseAdmin || supabase)
      .from('quotations')
      .select('*, quotation_items(*, variant:product_variants(*), product:products(*)), customers(*), leads(*)')
      .eq('id', quotationId)
      .eq('company_id', companyId)
      .single();

    if (qErr || !quotation) throw new ApiError(404, 'Quotation not found');

    const { data: company } = await (supabaseAdmin || supabase)
      .from('companies').select('*').eq('id', companyId).single();

    const companyName = company?.name || 'Your Company';
    const companyGST = company?.gstin || '';
    const companyAddress = [company?.address, company?.city, company?.state, company?.postal_code].filter(Boolean).join(', ');
    const companyPhone = company?.phone || '';
    const companyEmail = company?.email || '';

    const docNo = quotation.quotation_number || `QUO-${quotation.id.substring(0, 8).toUpperCase()}`;
    const docDate = new Date(quotation.created_at).toLocaleDateString('en-IN');
    const validUntil = quotation.valid_until ? new Date(quotation.valid_until).toLocaleDateString('en-IN') : 'N/A';
    const custName = quotation.customers?.name || quotation.leads?.company_name || quotation.leads?.contact_name || 'Prospective Customer';
    const custGST = quotation.customers?.trn_number || '';

    const subtotal = Number(quotation.subtotal || 0);
    const totalDiscount = Number(quotation.total_discount || 0);
    const afterItemDisc = subtotal - totalDiscount;
    const extraDiscount = Number(quotation.extra_discount_amount || 0);
    const showExtraDisc = extraDiscount > 0;
    const totalTax = Number(quotation.total_tax || 0);
    const grandTotal = Number(quotation.total_amount || 0);
    const rawExtraCharges: any[] = Array.isArray(quotation.extra_charges) ? quotation.extra_charges : [];
    const totalExtraCharges = Number(quotation.total_extra_charges || 0);
    const roundOff = Number(quotation.round_off_amount || 0);

    const taxSummary: Record<string, { taxable: number; taxRate: number; cgst: number; sgst: number }> = {};
    let itemsHTML = '';

    (quotation.quotation_items || []).forEach((item: any, idx: number) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      const lineDiscount = Number(item.discount_amount || 0);
      const taxableAmtA = (price * qty) - lineDiscount;
      let extraDiscShare = 0;
      if (showExtraDisc && afterItemDisc > 0) extraDiscShare = (taxableAmtA / afterItemDisc) * extraDiscount;
      const netTaxableB = taxableAmtA - extraDiscShare;
      const taxRate = Number(item.tax_percentage || 0);
      const cgstSgstRate = taxRate / 2;
      const taxVal = Number(item.tax_amount || 0);
      const totalLineAmount = netTaxableB + taxVal;
      const desc = item.variant?.name || item.product?.name || 'Item';
      const hsn = item.variant?.hsn || '-';
      const unit = item.variant?.unit_type || 'PCS';
      const discPct = Number(item.discount_percentage || 0);

      const key = `${taxRate}`;
      if (!taxSummary[key]) taxSummary[key] = { taxable: 0, taxRate, cgst: 0, sgst: 0 };
      taxSummary[key].taxable += netTaxableB;
      taxSummary[key].cgst += (netTaxableB * cgstSgstRate) / 100;
      taxSummary[key].sgst += (netTaxableB * cgstSgstRate) / 100;

      if (showExtraDisc) {
        itemsHTML += `<tr class="item-row"><td class="text-center">${idx + 1}</td><td>${desc}</td><td class="text-center">${hsn}</td><td class="text-center">${qty.toFixed(3)} ${unit}</td><td class="text-right">${price.toFixed(2)}</td><td class="text-right">${discPct ? discPct + '%' : '-'}</td><td class="text-right">${taxableAmtA.toFixed(2)}</td><td class="text-right">${extraDiscShare.toFixed(2)}</td><td class="text-right">${netTaxableB.toFixed(2)}</td><td class="text-center">${taxRate}%</td><td class="text-right">${totalLineAmount.toFixed(2)}</td></tr>`;
      } else {
        itemsHTML += `<tr class="item-row"><td class="text-center">${idx + 1}</td><td>${desc}</td><td class="text-center">${hsn}</td><td class="text-center">${qty.toFixed(3)} ${unit}</td><td class="text-right">${price.toFixed(2)}</td><td class="text-right">${discPct ? discPct + '%' : '-'}</td><td class="text-right">${taxableAmtA.toFixed(2)}</td><td class="text-center">${taxRate}%</td><td class="text-right">${totalLineAmount.toFixed(2)}</td></tr>`;
      }
    });

    const taxSummaryHTML = Object.values(taxSummary).map(t => {
      const igst = t.cgst + t.sgst;
      return `<tr><td>${t.taxRate}%</td><td class="text-right">${t.taxable.toFixed(2)}</td><td class="text-right">${t.cgst.toFixed(2)}</td><td class="text-right">${t.sgst.toFixed(2)}</td><td class="text-right">${igst.toFixed(2)}</td></tr>`;
    }).join('');

    const extraChargesHTML = rawExtraCharges.map((ec: any) => {
      const taxPct = Number(ec.tax_percent || 0);
      const total = ec.amount + (ec.amount * taxPct / 100);
      const colSpan = showExtraDisc ? 10 : 8;
      return `<tr><td colspan="${colSpan}" class="text-right" style="color:#2563eb;">${ec.name}${taxPct > 0 ? ` (incl. ${taxPct}% tax)` : ''}</td><td class="text-right">${total.toFixed(2)}</td></tr>`;
    }).join('');

    const amountInWords = numberToWords(Math.round(grandTotal));

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Quotation ${docNo}</title><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; font-size: 11px; padding: 10px; background: #f9f9f9; }
      .invoice-box { max-width: 900px; margin: auto; background: #fff; border: 2px solid #000; }
      .header-top { display: flex; justify-content: space-between; align-items: center; padding: 5px 10px; border-bottom: 1px solid #000; font-size: 11px; font-weight: bold; }
      .header-main { text-align: center; padding: 10px; border-bottom: 1px solid #000; }
      .header-main h1 { color: #d32f2f; margin: 5px 0; font-size: 24px; }
      .header-main p { margin: 2px 0; font-size: 10px; }
      .logo-placeholder { position: absolute; left: 20px; top: 20px; width: 80px; height: 80px; object-fit: contain; }
      .meta-section { display: flex; border-bottom: 1px solid #000; }
      .meta-col { flex: 1; padding: 5px 10px; }
      .meta-col:first-child { border-right: 1px solid #000; }
      .meta-table { width: 100%; font-size: 10px; }
      .meta-table td { padding: 2px 0; vertical-align: top; }
      .meta-table td:first-child { width: 110px; }
      .items-table { width: 100%; border-collapse: collapse; font-size: 10px; }
      .items-table th, .items-table td { border-right: 1px solid #000; padding: 5px; }
      .items-table th { border-bottom: 1px solid #000; text-align: center; font-weight: bold; }
      .items-table th:last-child, .items-table td:last-child { border-right: none; }
      .item-row td { border-bottom: none; }
      .totals-section { border-top: 1px solid #000; }
      .totals-row { display: flex; }
      .totals-left { flex: 1; padding: 10px; border-right: 1px solid #000; }
      .totals-right { width: 260px; }
      .total-line { display: flex; justify-content: space-between; padding: 3px 10px; font-size: 10px; }
      .total-line.grand { font-weight: bold; font-size: 12px; border-top: 2px solid #000; background: #f5f5f5; }
      .tax-summary-table { width: 100%; border-collapse: collapse; font-size: 10px; }
      .tax-summary-table th, .tax-summary-table td { border: 1px solid #000; padding: 4px; text-align: center; }
      .amount-words { padding: 8px 10px; font-size: 10px; border-top: 1px solid #000; }
      .text-right { text-align: right; } .text-center { text-align: center; }
      @media print { body { padding: 0; } .invoice-box { border: 2px solid #000; box-shadow: none; } }
    </style></head><body>
    <div class="invoice-box">
      <div class="header-top">
        <div>GSTIN : ${companyGST}</div>
        <div style="text-decoration: underline; font-size: 14px;">QUOTATION</div>
        <div>Copy</div>
      </div>
      <div class="header-main" style="position:relative;">
        ${company?.logo_url ? `<img src="${company.logo_url}" class="logo-placeholder" alt="Logo">` : ''}
        <h1>${companyName.toUpperCase()}</h1>
        <p><strong>WORK :</strong> ${companyAddress}</p>
        <p><strong>Tel.:</strong> ${companyPhone}${companyEmail ? ` &nbsp;|&nbsp; <strong>Email :</strong> ${companyEmail}` : ''}</p>
      </div>
      <div class="meta-section">
        <div class="meta-col">
          <table class="meta-table"><tbody>
            <tr><td><strong>Quotation No.</strong></td><td>: ${docNo}</td></tr>
            <tr><td><strong>Date</strong></td><td>: ${docDate}</td></tr>
            <tr><td><strong>Valid Until</strong></td><td>: ${validUntil}</td></tr>
          </tbody></table>
        </div>
        <div class="meta-col">
          <table class="meta-table"><tbody>
            <tr><td><strong>Customer</strong></td><td>: ${custName}</td></tr>
            ${custGST ? `<tr><td><strong>GSTIN</strong></td><td>: ${custGST}</td></tr>` : ''}
            <tr><td><strong>Status</strong></td><td>: ${(quotation.status || '').toUpperCase()}</td></tr>
          </tbody></table>
        </div>
      </div>
      <div style="border-bottom: 1px solid #000;">
        <table class="items-table">
          <thead><tr>
            ${showExtraDisc
              ? `<th>#</th><th>Description</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Disc%</th><th>Taxable(A)</th><th>Extra Disc</th><th>Net Taxable(B)</th><th>GST%</th><th>Total</th>`
              : `<th>#</th><th>Description</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Disc%</th><th>Taxable Value</th><th>GST%</th><th>Total</th>`}
          </tr></thead>
          <tbody>${itemsHTML}${extraChargesHTML}</tbody>
        </table>
      </div>
      <div class="totals-section">
        <div class="totals-row">
          <div class="totals-left">
            <table class="tax-summary-table">
              <thead><tr><th>GST%</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>Total Tax</th></tr></thead>
              <tbody>${taxSummaryHTML}</tbody>
            </table>
          </div>
          <div class="totals-right">
            <div class="total-line"><span>Subtotal</span><span>&#8377; ${subtotal.toFixed(2)}</span></div>
            ${totalDiscount > 0 ? `<div class="total-line"><span>Item Discount</span><span>-&#8377; ${totalDiscount.toFixed(2)}</span></div>` : ''}
            ${showExtraDisc ? `<div class="total-line"><span>Extra Discount</span><span>-&#8377; ${extraDiscount.toFixed(2)}</span></div>` : ''}
            <div class="total-line"><span>Total Tax</span><span>&#8377; ${totalTax.toFixed(2)}</span></div>
            ${totalExtraCharges > 0 ? `<div class="total-line"><span>Extra Charges</span><span>&#8377; ${totalExtraCharges.toFixed(2)}</span></div>` : ''}
            ${roundOff !== 0 ? `<div class="total-line"><span>Round Off</span><span>${roundOff > 0 ? '+' : ''}${roundOff.toFixed(2)}</span></div>` : ''}
            <div class="total-line grand"><span>Grand Total</span><span>&#8377; ${grandTotal.toFixed(2)}</span></div>
          </div>
        </div>
      </div>
      <div class="amount-words"><strong>Amount in Words:</strong> ${amountInWords} Rupees</div>
      ${quotation.notes ? `<div style="padding:8px 10px;font-size:10px;border-top:1px solid #000;"><strong>Notes:</strong> ${quotation.notes}</div>` : ''}
      ${quotation.terms_and_conditions ? `<div style="padding:8px 10px;font-size:10px;border-top:1px solid #000;"><strong>Terms &amp; Conditions:</strong> ${quotation.terms_and_conditions}</div>` : ''}
      <div style="padding:10px;text-align:right;border-top:1px solid #000;font-size:10px;">For ${companyName}<br><br><br>Authorised Signatory</div>
    </div>
    </body></html>`;

    const isDownload = req.query.download === 'true';
    res.setHeader('Content-Type', 'text/html');
    if (isDownload) {
      res.setHeader('Content-Disposition', `attachment; filename="Quotation_${docNo}.html"`);
    }
    res.send(html);
  } catch (error) {
    next(error);
  }
};
