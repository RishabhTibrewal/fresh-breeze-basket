import { Request, Response, NextFunction } from 'express';
import QRCode from 'qrcode';
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

  let outletName = companyName;
  if (order.outlet_id) {
    const { data: w } = await (supabaseAdmin || supabase)
      .from('warehouses')
      .select('name')
      .eq('id', order.outlet_id)
      .single();
    if (w?.name) outletName = w.name;
  }

  // Fetch KOT numbers for customer bill
  let kotNumbers = '';
  if (!isKitchen) {
    const { data: kotTickets } = await (supabaseAdmin || supabase)
      .from('pos_kot_tickets')
      .select('kot_number_seq')
      .eq('order_id', orderId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });
    if (kotTickets && kotTickets.length > 0) {
      kotNumbers = kotTickets.map((k: any) => k.kot_number_seq).join(', ');
    }
  }

  // Short receipt/order number: last segment of receipt_number e.g. '8765'
  const rawReceipt = order.receipt_number || '';
  const shortReceiptNo = rawReceipt.split('-').pop() || order.id.substring(0, 6).toUpperCase();

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
    @page { margin: 0; }
    @media print {
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
        <h2 class="bold">${outletName}</h2>
        <div class="bold">${title}</div>
        <div>Bill No : ${shortReceiptNo}</div>
        ${kotNumbers ? `<div>KOT No : ${kotNumbers}</div>` : ''}
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
    @page { margin: 0; }
    @media print {
      body { width: 100%; padding: 5mm; }
    }
  `;

async function loadKotOrderMeta(orderId: string, companyId: string) {
  const { data: order } = await (supabaseAdmin || supabase)
    .from('orders')
    .select('created_at, notes, fulfillment_type, customer_id, outlet_id, user_id, receipt_number')
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

  let billedBy = '';
  if (order.user_id) {
    const { data: prof } = await (supabaseAdmin || supabase)
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('id', order.user_id)
      .single();
    if (prof) {
      const name = [prof.first_name, prof.last_name].filter(Boolean).join(' ').trim();
      billedBy = name || (prof.email ? prof.email.split('@')[0] : '');
    }
  }

  let outletName = 'Store';
  if (order.outlet_id) {
    const { data: w } = await (supabaseAdmin || supabase)
      .from('warehouses')
      .select('name')
      .eq('id', order.outlet_id)
      .single();
    if (w?.name) outletName = w.name;
  }

  const fulfillmentLabel = (order.fulfillment_type || 'Take Away').replace('_', ' ').toUpperCase();
  return { dateStr, tableNo, customerName, fulfillmentLabel, outletName, billedBy, receiptNumber: order.receipt_number as string | null };
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
          <h2 class="bold">${meta.outletName}</h2>
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
      .select('order_id, kot_number_seq, kot_number_text, ticket_items_snapshot, outlet_id')
      .eq('id', ticketId)
      .eq('company_id', companyId)
      .single();

    if (error || !ticket) throw new ApiError(404, 'KOT ticket not found');

    const html = await generateQuickBillKOTHTML(
      ticket.order_id,
      companyId,
      { kot_number_seq: ticket.kot_number_seq, kot_number_text: ticket.kot_number_text, ticket_items_snapshot: ticket.ticket_items_snapshot, outlet_id: ticket.outlet_id }
    );
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Get Kitchen KOT (Thermal) — ALL items from ALL counters merged into one KOT
 */
export const getKitchenKOT = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const companyId = req.companyId!;

    const { data: tickets } = await (supabaseAdmin || supabase)
      .from('pos_kot_tickets')
      .select('id, kot_number_seq, kot_number_text, ticket_items_snapshot, outlet_id')
      .eq('order_id', orderId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });

    if (tickets && tickets.length > 0) {
      // Merge ALL items from ALL ticket snapshots into one combined list
      const allLines: KotSnapshotLine[] = [];
      for (const t of tickets) {
        allLines.push(...parseTicketSnapshot(t.ticket_items_snapshot));
      }
      const allKotSeqs = tickets.map((t) => t.kot_number_seq).join(', ');
      // Build a synthetic merged ticket using the first ticket's outlet/seq info
      const firstTicket = tickets[0];
      const mergedTicket = {
        kot_number_seq: firstTicket.kot_number_seq,
        kot_number_text: allKotSeqs, // displayed as "7, 8" etc.
        ticket_items_snapshot: allLines,
        outlet_id: firstTicket.outlet_id,
      };
      const html = await generateQuickBillKOTHTML(orderId, companyId, mergedTicket, allKotSeqs);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
      return;
    }

    // Fallback: no tickets in DB — use legacy generator
    const html = await generateThermalKOTHTML(orderId, companyId, 'kitchen');
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    next(error);
  }
};

/**
 * Generate a sharp, professional thermal Quick Bill KOT for the customer.
 * Shows: outlet name, KOT No (seq only), Quick Bill, Order No, timestamp,
 * Billed By, ITEM/QTY table, Total Qty.
 * Full kot_number_text is stored in the data layer; only the seq # is printed.
 */
async function generateQuickBillKOTHTML(
  orderId: string,
  companyId: string,
  ticket: { kot_number_seq: number; kot_number_text: string; ticket_items_snapshot: unknown; outlet_id?: string | null } | null,
  kotSeqOverride?: string
): Promise<string> {
  const meta = await loadKotOrderMeta(orderId, companyId);

  const resolvedOutletId = ticket?.outlet_id || null;
  let outletName = meta.outletName;
  if (resolvedOutletId) {
    const { data: w } = await (supabaseAdmin || supabase)
      .from('warehouses')
      .select('name')
      .eq('id', resolvedOutletId)
      .single();
    if (w?.name) outletName = w.name;
  }

  let items: Array<{ name: string; qty: number }> = [];

  if (ticket?.ticket_items_snapshot) {
    const lines = parseTicketSnapshot(ticket.ticket_items_snapshot) as KotSnapshotLine[];
    items = lines.map((l) => ({
      name: String(l.kitchen_display_name || 'Item'),
      qty: Number(l.quantity) || 1,
    }));
  }

  if (items.length === 0) {
    const { data: orderItems } = await (supabaseAdmin || supabase)
      .from('order_items')
      .select('quantity, product:products(name), variant:product_variants(name)')
      .eq('order_id', orderId);
    if (orderItems) {
      items = (orderItems as any[]).map((oi) => ({
        name: formatThermalItemName(oi.product?.name, oi.variant?.name),
        qty: Number(oi.quantity) || 1,
      }));
    }
  }

  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const kotDisplay = kotSeqOverride ?? String(ticket?.kot_number_seq ?? 0);
  const rawReceipt = meta.receiptNumber || '';
  const orderNoShort = rawReceipt.split('-').pop() || orderId.substring(0, 6).toUpperCase();

  const itemRows = items
    .map(
      (item) => `
    <tr>
      <td class="item-name">${item.name}</td>
      <td class="item-qty">${item.qty}</td>
    </tr>`
    )
    .join('');

  const thermalStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      width: 300px;
      padding: 10px 8px;
      font-size: 12px;
      line-height: 1.35;
      color: #000;
      background: #fff;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .outlet-name {
      font-size: 15px;
      font-weight: bold;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
    }
    .kot-no {
      font-size: 13px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 1px;
    }
    .bill-type {
      font-size: 12px;
      text-align: center;
      font-weight: bold;
      margin-bottom: 4px;
    }
    .meta-line {
      font-size: 11px;
      margin: 1px 0;
    }
    .divider-solid { border: none; border-top: 1px solid #000; margin: 6px 0; }
    .divider-dashed { border: none; border-top: 1px dashed #000; margin: 6px 0; }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
    }
    .items-table th {
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      padding: 3px 0;
      border-bottom: 1px solid #000;
    }
    .items-table th.left { text-align: left; }
    .items-table th.right { text-align: right; }
    .item-name { text-align: left; font-size: 12px; padding: 3px 0; }
    .item-qty  { text-align: right; font-size: 12px; padding: 3px 0; width: 36px; }
    .total-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: bold;
      padding: 3px 0;
    }
    @page { margin: 0; size: 80mm auto; }
    @media print {
      body { width: 100%; padding: 4mm 4mm; }
    }
  `;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Quick Bill</title>
  <style>${thermalStyles}</style>
</head>
<body>
  <div class="outlet-name">${outletName}</div>
  <div class="kot-no">KOT No : ${kotDisplay}</div>
  <div class="bill-type">Quick Bill</div>

  <hr class="divider-dashed" />

  <div class="meta-line">Order No : ${orderNoShort}</div>
  ${meta.billedBy ? `<div class="meta-line">Billed By: ${meta.billedBy}</div>` : ''}

  <hr class="divider-solid" />

  <table class="items-table">
    <thead>
      <tr>
        <th class="left">ITEM</th>
        <th class="right">QTY</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <hr class="divider-solid" />

  <div class="total-row">
    <span>Total Qty:</span>
    <span>${totalQty.toFixed(2)}</span>
  </div>

</body>
</html>`;
}

/**
 * Controller: Get Customer KOT/Bill (Thermal) — Quick Bill format
 */
export const getCustomerKOT = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const companyId = req.companyId!;

    // Prefer the latest KOT ticket for this order; include outlet_id for accurate outlet name
    const { data: ticket } = await (supabaseAdmin || supabase)
      .from('pos_kot_tickets')
      .select('kot_number_seq, kot_number_text, ticket_items_snapshot, outlet_id')
      .eq('order_id', orderId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const html = await generateQuickBillKOTHTML(orderId, companyId, ticket ?? null);
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

function paginateItems<T>(items: T[], p1SingleCap: number, p1MultiCap: number, middleCap: number, lastCap: number): T[][] {
    if (items.length <= p1SingleCap) {
        return [items];
    }
    
    const pages: T[][] = [];
    let currentIndex = 0;
    
    // Page 1
    let p1Count = p1MultiCap;
    if (items.length - p1Count < 1) {
        p1Count = items.length - 1;
    }
    pages.push(items.slice(currentIndex, currentIndex + p1Count));
    currentIndex += p1Count;
    
    // Middle and Last pages
    while (currentIndex < items.length) {
        const remaining = items.length - currentIndex;
        if (remaining <= lastCap) {
            pages.push(items.slice(currentIndex));
            break;
        } else {
            let middleCount = middleCap;
            if (remaining - middleCount < 1) {
                middleCount = remaining - 1;
            }
            pages.push(items.slice(currentIndex, currentIndex + middleCount));
            currentIndex += middleCount;
        }
    }
    return pages;
}

function generateEmptyRowsHTML(count: number, columnsCount: number): string {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += '<tr class="item-row">';
        for (let j = 0; j < columnsCount; j++) {
            html += '<td>&nbsp;</td>';
        }
        html += '</tr>';
    }
    return html;
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

    // Generate QR codes
    let paymentQrDataUrl = '';
    if (company?.payment_qr_code_url) {
        paymentQrDataUrl = company.payment_qr_code_url;
    } else if (company?.payment_upi_id) {
        const upiLink = `upi://pay?pa=${company.payment_upi_id}&pn=${encodeURIComponent(companyName)}&am=${grandTotal.toFixed(2)}&cu=INR`;
        try {
            paymentQrDataUrl = await QRCode.toDataURL(upiLink, { margin: 1, width: 200 });
        } catch (err) {
            console.error('Failed to generate UPI QR code:', err);
        }
    }

    let websiteQrDataUrl = '';
    if (company?.website_qr_code_url) {
        websiteQrDataUrl = company.website_qr_code_url;
    } else if (company?.website_url) {
        try {
            websiteQrDataUrl = await QRCode.toDataURL(company.website_url, { margin: 1, width: 200 });
        } catch (err) {
            console.error('Failed to generate Website QR code:', err);
        }
    }

    // 2. Global Calculations & Preparations
    let totalQty = 0;
    const taxSummary: Record<string, { taxable: number, taxRate: number, cgst: number, sgst: number }> = {};
    let totalLineAmounts = 0;
    
    const computedItems = order.order_items.map((item: any, idx: number) => {
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
        const taxVal = Number(item.tax_amount || 0);
        const totalLineAmount = netTaxableB + taxVal;
        
        totalLineAmounts += totalLineAmount;
        
        const desc = item.variant?.name || item.product?.name || 'Item';
        const hsn = item.variant?.hsn || '-';
        const unit = item.variant?.unit_type || 'PCS';
        const discPct = Number(item.discount_percentage || 0);

        if (taxRate > 0) {
            const key = taxRate.toString();
            if (!taxSummary[key]) {
                taxSummary[key] = { taxable: 0, taxRate, cgst: 0, sgst: 0 };
            }
            taxSummary[key].taxable += netTaxableB;
            taxSummary[key].cgst += taxVal / 2;
            taxSummary[key].sgst += taxVal / 2;
        }

        return {
            sn: idx + 1,
            desc,
            hsn,
            qty,
            unit,
            price,
            discPct,
            taxableAmtA,
            extraDiscShare,
            netTaxableB,
            taxRate,
            totalLineAmount
        };
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
    
    const bankDetailsObj = company?.bank_details && company.bank_details.length > 0 ? company.bank_details[0] : null;
    let bankHTML = '';
    if (bankDetailsObj) {
        bankHTML = `
            <strong>BANK NAME :</strong> ${bankDetailsObj.bank_name || ''} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <strong>A/C No. :</strong> ${bankDetailsObj.account_number || ''} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <strong>IFSC CODE :</strong> ${bankDetailsObj.ifsc_code || ''}
        `;
    } else {
        bankHTML = `<em>Bank details not configured. Add bank details in Company Settings.</em>`;
    }

    const tncText = order.notes || "1. Due date has been calculated as per agreed payment terms\n2. Interest @ 18% will be charged if payment is delayed beyond due date.\n3. No complaints in respect of material supplied vide this invoice will be entertained unless the same is lodged in writing within 10 days of dispatch.\n4. All disputes are subject to local Jurisdiction\n5. All ex-factory dispatch of goods are at owner's risk.";
    const formattedTnc = tncText.split('\n').map((line: string) => `<div>${line}</div>`).join('');

    // Pagination & Pages HTML generation
    const pages = paginateItems(computedItems, 10, 18, 25, 12);
    const totalPages = pages.length;
    let pagesHTML = '';

    for (let p = 1; p <= totalPages; p++) {
        const pageItems = pages[p - 1];
        const pageItemsCount = pageItems.length;
        
        let targetRows = 10;
        if (totalPages > 1) {
            if (p === 1) targetRows = 18;
            else if (p === totalPages) targetRows = 12;
            else targetRows = 25;
        }
        const paddingCount = Math.max(0, targetRows - pageItemsCount);
        const colsCount = showExtraDisc ? 11 : 9;
        
        let tableRowsHTML = '';
        pageItems.forEach((item: any) => {
            if (showExtraDisc) {
                tableRowsHTML += `
                    <tr class="item-row">
                        <td class="text-center">${item.sn}</td>
                        <td>${item.desc}</td>
                        <td class="text-center">${item.hsn}</td>
                        <td class="text-center">${item.qty.toFixed(3)} ${item.unit}</td>
                        <td class="text-right">${item.price.toFixed(2)}</td>
                        <td class="text-right">${item.discPct ? item.discPct + '%' : '-'}</td>
                        <td class="text-right">${item.taxableAmtA.toFixed(2)}</td>
                        <td class="text-right">${item.extraDiscShare.toFixed(2)}</td>
                        <td class="text-right">${item.netTaxableB.toFixed(2)}</td>
                        <td class="text-center">${item.taxRate}%</td>
                        <td class="text-right">${item.totalLineAmount.toFixed(2)}</td>
                    </tr>
                `;
            } else {
                tableRowsHTML += `
                    <tr class="item-row">
                        <td class="text-center">${item.sn}</td>
                        <td>${item.desc}</td>
                        <td class="text-center">${item.hsn}</td>
                        <td class="text-center">${item.qty.toFixed(3)} ${item.unit}</td>
                        <td class="text-right">${item.price.toFixed(2)}</td>
                        <td class="text-right">${item.discPct ? item.discPct + '%' : '-'}</td>
                        <td class="text-right">${item.taxableAmtA.toFixed(2)}</td>
                        <td class="text-center">${item.taxRate}%</td>
                        <td class="text-right">${item.totalLineAmount.toFixed(2)}</td>
                    </tr>
                `;
            }
        });
        
        tableRowsHTML += generateEmptyRowsHTML(paddingCount, colsCount);
        
        tableRowsHTML += `
            <tr class="item-row spacer-row">
                ${Array(colsCount).fill('<td>&nbsp;</td>').join('')}
            </tr>
        `;

        let pageHeaderHTML = '';
        if (p === 1) {
            pageHeaderHTML = `
                <div class="header-top">
                    <div>GSTIN : ${companyGST}</div>
                    <div style="text-decoration: underline; font-size: 14px;">${documentTitle}</div>
                    <div>Original Copy</div>
                </div>
                
                <div class="header-main ${company?.logo_url ? 'has-logo' : ''}">
                    ${company?.logo_url ? `<img src="${company.logo_url}" class="logo-img" alt="Logo">` : ''}
                    <div class="header-text">
                        <h1>${companyName.toUpperCase()}</h1>
                        <p><strong>WORK :</strong> ${companyAddress}</p>
                        <p><strong>Tel.:</strong> ${companyPhone} ${companyEmail ? `&nbsp;|&nbsp; <strong>Email :</strong> ${companyEmail}` : ''}</p>
                    </div>
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
            `;
        } else {
            pageHeaderHTML = `
                <div class="header-top" style="border-bottom: 1px solid #000; padding: 5px 10px;">
                    <div>GSTIN : ${companyGST}</div>
                    <div style="text-decoration: underline; font-size: 12px; font-weight: bold;">${documentTitle} (Page ${p} of ${totalPages})</div>
                    <div>Invoice No: <strong>${invoiceNo}</strong></div>
                </div>
                <div class="header-mini-meta" style="display: flex; justify-content: space-between; padding: 5px 10px; border-bottom: 1px solid #000; font-size: 10px;">
                    <div><strong>Dated:</strong> ${invoiceDate}</div>
                    <div><strong>Billed to:</strong> ${custName.toUpperCase()}</div>
                </div>
            `;
        }

        let pageFooterHTML = '';
        if (p === totalPages) {
            pageFooterHTML = `
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
                
                <div class="payment-info-section">
                    <div class="payment-info-col bank-details">
                        <div style="font-weight: bold; margin-bottom: 5px;">Bank Details :</div>
                        ${bankHTML}
                    </div>
                    ${(company?.payment_upi_id || paymentQrDataUrl) ? `
                    <div class="payment-info-col payment-upi" style="display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div style="font-weight: bold; margin-bottom: 5px;">UPI Payment :</div>
                            ${company.payment_upi_id ? `<div><strong>UPI ID:</strong> ${company.payment_upi_id}</div>` : ''}
                        </div>
                        ${paymentQrDataUrl ? `
                        <div style="margin-top: 5px; display: flex; align-items: center; gap: 10px;">
                            <img src="${paymentQrDataUrl}" style="width: 60px; height: 60px; object-fit: contain;" alt="Payment QR" />
                            <span style="font-size: 8px; font-weight: bold; line-height: 1.2;">Scan QR Code<br/>to Pay ₹${grandTotal.toFixed(2)}</span>
                        </div>
                        ` : ''}
                    </div>
                    ` : ''}
                    ${(company?.website_url || websiteQrDataUrl) ? `
                    <div class="payment-info-col website-info" style="display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div style="font-weight: bold; margin-bottom: 5px;">Website :</div>
                            ${company.website_url ? `<div><a href="${company.website_url}" target="_blank" style="color: #000; text-decoration: none;">${company.website_url}</a></div>` : ''}
                        </div>
                        ${websiteQrDataUrl ? `
                        <div style="margin-top: 5px; display: flex; align-items: center; gap: 10px;">
                            <img src="${websiteQrDataUrl}" style="width: 60px; height: 60px; object-fit: contain;" alt="Website QR" />
                            <span style="font-size: 8px; font-weight: bold; line-height: 1.2;">Scan QR Code<br/>to Visit Website</span>
                        </div>
                        ` : ''}
                    </div>
                    ` : ''}
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
                
                ${company?.invoice_custom_message ? `
                <div class="custom-message-section" style="text-align: center; padding: 8px; font-style: italic; border-top: 1px solid #000; font-size: 10px; font-weight: bold; background-color: #fcfcfc;">
                    ${company.invoice_custom_message}
                </div>
                ` : ''}
                ${companyAddress ? `<div class="regd-office">Regd. Office : ${companyAddress}</div>` : ''}
            `;
        } else {
            pageFooterHTML = `
                <div class="continued-line">Continued on Page ${p + 1}...</div>
                <div style="flex-grow: 1;"></div>
                ${company?.invoice_custom_message ? `
                <div class="custom-message-section" style="text-align: center; padding: 8px; font-style: italic; border-top: 1px solid #000; font-size: 10px; font-weight: bold; background-color: #fcfcfc;">
                    ${company.invoice_custom_message}
                </div>
                ` : ''}
                ${companyAddress ? `<div class="regd-office">Regd. Office : ${companyAddress}</div>` : ''}
            `;
        }

        pagesHTML += `
            <div class="page">
                <div class="page-content">
                    <div>
                        ${pageHeaderHTML}
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
                                    ${tableRowsHTML}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div>
                        ${pageFooterHTML}
                    </div>
                </div>
            </div>
        `;
    }

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
            padding: 0; 
            color: #000;
            background: #f3f4f6;
        }
        * { box-sizing: border-box; }
        .page {
            width: 210mm;
            height: 297mm;
            margin: 20px auto;
            border: 1px solid #000;
            background: #fff;
            display: flex;
            flex-direction: column;
            padding: 8mm 10mm;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            position: relative;
        }
        .page-content {
            display: flex;
            flex-direction: column;
            height: 100%;
            justify-content: space-between;
            border: 1px solid #000;
        }
        .header-top {
            display: flex;
            justify-content: space-between;
            padding: 5px 10px;
            font-weight: bold;
        }
        .header-main {
            text-align: center;
            padding: 6px 10px;
            border-bottom: 1px solid #000;
            border-top: 1px solid #000;
            position: relative;
        }
        .header-main.has-logo {
            position: relative;
            text-align: center;
            padding: 6px 20px;
        }
        .logo-img {
            position: absolute;
            left: 20px;
            top: 50%;
            transform: translateY(-50%);
            max-width: 120px;
            max-height: 60px;
            object-fit: contain;
        }
        .header-text {
            flex: 1;
        }
        .header-main h1 {
            color: #d32f2f;
            margin: 3px 0;
            font-size: 20px;
        }
        .header-main p {
            margin: 1px 0;
            font-size: 10px;
        }
        .logo-placeholder {
            position: absolute;
            left: 20px;
            top: 15px;
            width: 60px;
            height: 60px;
            object-fit: contain;
        }
        .payment-info-section {
            display: flex;
            border-bottom: 1px solid #000;
            font-size: 10px;
        }
        .payment-info-col {
            flex: 1;
            padding: 8px 10px;
        }
        .payment-info-col.bank-details {
            flex: 1.8;
        }
        .payment-info-col.payment-upi,
        .payment-info-col.website-info {
            flex: 1;
        }
        .payment-info-col:not(:last-child) {
            border-right: 1px solid #000;
        }
        .payment-info-col strong {
            display: inline-block;
            margin-bottom: 4px;
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
            min-height: 80px;
        }
        .address-col {
            flex: 1;
            padding: 6px 10px;
        }
        .address-col:first-child { border-right: 1px solid #000; }
        .address-col p { margin: 2px 0; line-height: 1.4; }
        
        .items-section {
            border-bottom: 1px solid #000;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            margin-bottom: 5px;
        }
        .items-table {
            width: 100%;
            height: 100%;
            border-collapse: collapse;
            font-size: 10px;
        }
        .items-table th, .items-table td {
            border-right: 1px solid #000;
            border-bottom: none;
            padding: 4px;
        }
        .items-table th { border-bottom: 1px solid #000; text-align: center; font-weight: bold; }
        .items-table th:last-child, .items-table td:last-child { border-right: none; }
        .item-row { height: 24px; }
        .spacer-row td { height: auto; border-bottom: none; color: transparent; }
        
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
            padding: 4px 10px;
        }
        .totals-label { flex: 1; text-align: right; border-right: 1px solid #000; }
        .totals-qty { width: 100px; text-align: center; font-weight: bold; border-right: 1px solid #000; padding: 4px 0 !important; }
        .totals-value { width: 100px; text-align: right; font-weight: bold; padding: 4px 0 !important;}
        
        .tax-summary {
            border-bottom: 1px solid #000;
            border-top: 1px solid #000;
            padding: 4px 5px;
            display: flex;
        }
        .tax-table { width: 350px; border-collapse: collapse; font-size: 9px; margin: 0 10px; border-right: 1px solid #ccc; padding-right: 10px; }
        .tax-table th, .tax-table td { padding: 2px 3px; border: none; }
        .tax-table th { border-bottom: 1px solid #000; text-align: right; }
        .tax-table th:first-child { text-align: center; }
        
        .words-section { padding: 6px 10px; font-weight: bold; border-bottom: 1px solid #000; font-size: 11px; }
        
        .bank-section { padding: 5px 10px; border-bottom: 1px solid #000; font-size: 10px; }
        
        .footer-section { display: flex; min-height: 95px; }
        .tnc-box { flex: 2; padding: 6px 10px; border-right: 1px solid #000; font-size: 9px; line-height: 1.4; }
        .tnc-box h4 { margin: 0 0 4px 0; text-decoration: underline; font-size: 10px; }
        .sign-box { flex: 1; position: relative; padding: 6px 10px; padding-top: 15px;}
        .sign-box h4 { margin: 0 0 45px 0; text-align: center; font-size: 11px; }
        .sign-box p { position: absolute; bottom: 8px; width: 100%; text-align: center; font-weight: bold; margin: 0; left: 0; }
        
        .regd-office { text-align: center; padding: 4px; font-size: 9px; border-top: 1px solid #000; }
        .continued-line { text-align: right; font-weight: bold; font-style: italic; font-size: 10px; padding: 5px 10px; }
        
        @page { margin: 0; size: A4; }
        @media print {
            body { padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page { 
                margin: 0; 
                border: 1px solid #000; 
                box-shadow: none; 
                page-break-after: always; 
                height: 297mm;
                width: 210mm;
            }
            .page:last-child {
                page-break-after: avoid;
            }
        }
    </style>
</head>
<body>
    ${pagesHTML}
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

    // Thermal customer bill: outlet name header, items with prices, subtotal, tax, grand total
    const html = await generateThermalKOTHTML(orderId, companyId, 'customer');

    res.setHeader('Content-Type', 'text/html');
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

    // Bank Details HTML
    const bankDetailsObj = company?.bank_details && company.bank_details.length > 0 ? company.bank_details[0] : null;
    let bankHTML = '';
    if (bankDetailsObj) {
        bankHTML = `
            <strong>BANK NAME :</strong> ${bankDetailsObj.bank_name || ''} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <strong>A/C No. :</strong> ${bankDetailsObj.account_number || ''} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <strong>IFSC CODE :</strong> ${bankDetailsObj.ifsc_code || ''}
        `;
    } else {
        bankHTML = `<em>Bank details not configured. Add bank details in Company Settings.</em>`;
    }

    // Generate QR codes
    let paymentQrDataUrl = '';
    if (company?.payment_qr_code_url) {
        paymentQrDataUrl = company.payment_qr_code_url;
    } else if (company?.payment_upi_id) {
        const upiLink = `upi://pay?pa=${company.payment_upi_id}&pn=${encodeURIComponent(companyName)}&am=${grandTotal.toFixed(2)}&cu=INR`;
        try {
            paymentQrDataUrl = await QRCode.toDataURL(upiLink, { margin: 1, width: 200 });
        } catch (err) {
            console.error('Failed to generate UPI QR code for quotation:', err);
        }
    }

    let websiteQrDataUrl = '';
    if (company?.website_qr_code_url) {
        websiteQrDataUrl = company.website_qr_code_url;
    } else if (company?.website_url) {
        try {
            websiteQrDataUrl = await QRCode.toDataURL(company.website_url, { margin: 1, width: 200 });
        } catch (err) {
            console.error('Failed to generate Website QR code for quotation:', err);
        }
    }

    const taxSummary: Record<string, { taxable: number; taxRate: number; cgst: number; sgst: number }> = {};
    let totalQty = 0;

    const computedItems = (quotation.quotation_items || []).map((item: any, idx: number) => {
      const qty = Number(item.quantity) || 0;
      totalQty += qty;
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

      return {
        sn: idx + 1,
        desc,
        hsn,
        qty,
        unit,
        price,
        discPct,
        taxableAmtA,
        extraDiscShare,
        netTaxableB,
        taxRate,
        totalLineAmount
      };
    });

    const taxSummaryHTML = Object.values(taxSummary).map(t => {
      const igst = t.cgst + t.sgst;
      return `<tr><td>${t.taxRate}%</td><td class="text-right">${t.taxable.toFixed(2)}</td><td class="text-right">${t.cgst.toFixed(2)}</td><td class="text-right">${t.sgst.toFixed(2)}</td><td class="text-right">${igst.toFixed(2)}</td></tr>`;
    }).join('');

    const extraChargesHTML = rawExtraCharges.map((ec: any) => {
      const taxPct = Number(ec.tax_percent || 0);
      const total = ec.amount + (ec.amount * taxPct / 100);
      const colSpan = showExtraDisc ? 10 : 8;
      return `<tr class="item-row"><td colspan="${colSpan}" class="text-right" style="color:#2563eb; font-weight: bold;">${ec.name}${taxPct > 0 ? ` (incl. ${taxPct}% tax)` : ''}</td><td class="text-right font-bold">${total.toFixed(2)}</td></tr>`;
    }).join('');

    const amountInWordsStr = 'Rupees ' + numberToWords(Math.round(grandTotal));

    // Quotations pagination budgets:
    // Single page: Max 12 items.
    // Page 1 multi-page: Max 20 items.
    // Middle pages: Max 25 items.
    // Last page: Max 14 items.
    const pages = paginateItems(computedItems, 12, 20, 25, 14);
    const totalPages = pages.length;
    let pagesHTML = '';

    for (let p = 1; p <= totalPages; p++) {
        const pageItems = pages[p - 1];
        const pageItemsCount = pageItems.length;
        
        let targetRows = 12;
        if (totalPages > 1) {
            if (p === 1) targetRows = 20;
            else if (p === totalPages) targetRows = 14;
            else targetRows = 25;
        }
        
        const extraRowsCount = (p === totalPages) ? rawExtraCharges.length : 0;
        const paddingCount = Math.max(0, targetRows - pageItemsCount - extraRowsCount);
        const colsCount = showExtraDisc ? 11 : 9;
        
        let tableRowsHTML = '';
        pageItems.forEach((item: any) => {
            if (showExtraDisc) {
                tableRowsHTML += `
                    <tr class="item-row">
                        <td class="text-center">${item.sn}</td>
                        <td>${item.desc}</td>
                        <td class="text-center">${item.hsn}</td>
                        <td class="text-center">${item.qty.toFixed(3)} ${item.unit}</td>
                        <td class="text-right">${item.price.toFixed(2)}</td>
                        <td class="text-right">${item.discPct ? item.discPct + '%' : '-'}</td>
                        <td class="text-right">${item.taxableAmtA.toFixed(2)}</td>
                        <td class="text-right">${item.extraDiscShare.toFixed(2)}</td>
                        <td class="text-right">${item.netTaxableB.toFixed(2)}</td>
                        <td class="text-center">${item.taxRate}%</td>
                        <td class="text-right">${item.totalLineAmount.toFixed(2)}</td>
                    </tr>
                `;
            } else {
                tableRowsHTML += `
                    <tr class="item-row">
                        <td class="text-center">${item.sn}</td>
                        <td>${item.desc}</td>
                        <td class="text-center">${item.hsn}</td>
                        <td class="text-center">${item.qty.toFixed(3)} ${item.unit}</td>
                        <td class="text-right">${item.price.toFixed(2)}</td>
                        <td class="text-right">${item.discPct ? item.discPct + '%' : '-'}</td>
                        <td class="text-right">${item.taxableAmtA.toFixed(2)}</td>
                        <td class="text-center">${item.taxRate}%</td>
                        <td class="text-right">${item.totalLineAmount.toFixed(2)}</td>
                    </tr>
                `;
            }
        });
        
        // Add padding rows
        tableRowsHTML += generateEmptyRowsHTML(paddingCount, colsCount);
        
        // Add extra charges rows on last page
        if (p === totalPages && extraChargesHTML) {
            tableRowsHTML += extraChargesHTML;
        }
        
        // Add spacer row
        tableRowsHTML += `
            <tr class="item-row spacer-row">
                ${Array(colsCount).fill('<td>&nbsp;</td>').join('')}
            </tr>
        `;

        let pageHeaderHTML = '';
        if (p === 1) {
            pageHeaderHTML = `
                <div class="header-top">
                    <div>GSTIN : ${companyGST}</div>
                    <div style="text-decoration: underline; font-size: 14px;">QUOTATION</div>
                    <div>Copy</div>
                </div>
                
                <div class="header-main ${company?.logo_url ? 'has-logo' : ''}">
                    ${company?.logo_url ? `<img src="${company.logo_url}" class="logo-img" alt="Logo">` : ''}
                    <div class="header-text">
                        <h1>${companyName.toUpperCase()}</h1>
                        <p><strong>WORK :</strong> ${companyAddress}</p>
                        <p><strong>Tel.:</strong> ${companyPhone} ${companyEmail ? `&nbsp;|&nbsp; <strong>Email :</strong> ${companyEmail}` : ''}</p>
                    </div>
                </div>
                
                <div class="meta-section">
                    <div class="meta-col">
                        <table class="meta-table">
                            <tr><td><strong>Quotation No.</strong></td><td>: <strong>${docNo}</strong></td></tr>
                            <tr><td><strong>Date</strong></td><td>: ${docDate}</td></tr>
                            <tr><td><strong>Valid Until</strong></td><td>: ${validUntil}</td></tr>
                        </table>
                    </div>
                    <div class="meta-col">
                        <table class="meta-table">
                            <tr><td><strong>Customer</strong></td><td>: ${custName}</td></tr>
                            ${custGST ? `<tr><td><strong>GSTIN</strong></td><td>: ${custGST}</td></tr>` : ''}
                            <tr><td><strong>Status</strong></td><td>: ${(quotation.status || '').toUpperCase()}</td></tr>
                        </table>
                    </div>
                </div>
            `;
        } else {
            pageHeaderHTML = `
                <div class="header-top" style="border-bottom: 1px solid #000; padding: 5px 10px;">
                    <div>GSTIN : ${companyGST}</div>
                    <div style="text-decoration: underline; font-size: 12px; font-weight: bold;">QUOTATION (Page ${p} of ${totalPages})</div>
                    <div>Quotation No: <strong>${docNo}</strong></div>
                </div>
                <div class="header-mini-meta" style="display: flex; justify-content: space-between; padding: 5px 10px; border-bottom: 1px solid #000; font-size: 10px;">
                    <div><strong>Date:</strong> ${docDate}</div>
                    <div><strong>Customer:</strong> ${custName}</div>
                </div>
            `;
        }

        let pageFooterHTML = '';
        if (p === totalPages) {
            pageFooterHTML = `
                <div class="totals-section">
                    <div class="totals-row" style="display: flex; border-bottom: 1px solid #000;">
                        <div class="totals-left" style="flex: 1; padding: 10px; border-right: 1px solid #000;">
                            <table class="tax-summary-table">
                                <thead>
                                    <tr>
                                        <th>GST%</th>
                                        <th>Taxable</th>
                                        <th>CGST</th>
                                        <th>SGST</th>
                                        <th>Total Tax</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${taxSummaryHTML}
                                </tbody>
                            </table>
                        </div>
                        <div class="totals-right" style="width: 260px;">
                            <div class="total-line"><span>Subtotal</span><span>&#8377; ${subtotal.toFixed(2)}</span></div>
                            ${totalDiscount > 0 ? `<div class="total-line"><span>Item Discount</span><span>-&#8377; ${totalDiscount.toFixed(2)}</span></div>` : ''}
                            ${showExtraDisc ? `<div class="total-line"><span>Extra Discount</span><span>-&#8377; ${extraDiscount.toFixed(2)}</span></div>` : ''}
                            <div class="total-line"><span>Total Tax</span><span>&#8377; ${totalTax.toFixed(2)}</span></div>
                            ${totalExtraCharges > 0 ? `<div class="total-line"><span>Extra Charges</span><span>&#8377; ${totalExtraCharges.toFixed(2)}</span></div>` : ''}
                            ${roundOff !== 0 ? `<div class="total-line"><span>Round Off</span><span>${roundOff > 0 ? '+' : ''}${roundOff.toFixed(2)}</span></div>` : ''}
                            <div class="total-line grand" style="font-weight: bold; font-size: 12px; border-top: 2px solid #000; background: #f5f5f5;">
                                <span>Grand Total</span><span>&#8377; ${grandTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="amount-words" style="padding: 6px 10px; font-size: 10px; border-bottom: 1px solid #000; font-weight: bold;">
                    Amount in Words: ${amountInWordsStr}
                </div>
                
                <div class="payment-info-section">
                    <div class="payment-info-col bank-details">
                        <div style="font-weight: bold; margin-bottom: 5px;">Bank Details :</div>
                        ${bankHTML}
                    </div>
                    ${(company?.payment_upi_id || paymentQrDataUrl) ? `
                    <div class="payment-info-col payment-upi" style="display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div style="font-weight: bold; margin-bottom: 5px;">UPI Payment :</div>
                            ${company.payment_upi_id ? `<div><strong>UPI ID:</strong> ${company.payment_upi_id}</div>` : ''}
                        </div>
                        ${paymentQrDataUrl ? `
                        <div style="margin-top: 5px; display: flex; align-items: center; gap: 10px;">
                            <img src="${paymentQrDataUrl}" style="width: 60px; height: 60px; object-fit: contain;" alt="Payment QR" />
                            <span style="font-size: 8px; font-weight: bold; line-height: 1.2;">Scan QR Code<br/>to Pay ₹${grandTotal.toFixed(2)}</span>
                        </div>
                        ` : ''}
                    </div>
                    ` : ''}
                    ${(company?.website_url || websiteQrDataUrl) ? `
                    <div class="payment-info-col website-info" style="display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div style="font-weight: bold; margin-bottom: 5px;">Website :</div>
                            ${company.website_url ? `<div><a href="${company.website_url}" target="_blank" style="color: #000; text-decoration: none;">${company.website_url}</a></div>` : ''}
                        </div>
                        ${websiteQrDataUrl ? `
                        <div style="margin-top: 5px; display: flex; align-items: center; gap: 10px;">
                            <img src="${websiteQrDataUrl}" style="width: 60px; height: 60px; object-fit: contain;" alt="Website QR" />
                            <span style="font-size: 8px; font-weight: bold; line-height: 1.2;">Scan QR Code<br/>to Visit Website</span>
                        </div>
                        ` : ''}
                    </div>
                    ` : ''}
                </div>
                
                ${quotation.notes ? `<div style="padding:8px 10px;font-size:10px;border-bottom:1px solid #000;"><strong>Notes:</strong> ${quotation.notes}</div>` : ''}
                ${quotation.terms_and_conditions ? `<div style="padding:8px 10px;font-size:10px;border-bottom:1px solid #000;"><strong>Terms &amp; Conditions:</strong> ${quotation.terms_and_conditions}</div>` : ''}
                
                <div class="footer-section" style="display: flex; min-height: 75px; justify-content: flex-end;">
                    <div class="sign-box" style="width: 250px; position: relative; padding: 6px 10px; text-align: right;">
                        <h4 style="margin: 0 0 35px 0; font-size: 11px; text-align: right;">For ${companyName.toUpperCase()}</h4>
                        <p style="font-weight: bold; margin: 0; text-align: right;">Authorised Signatory</p>
                    </div>
                </div>
                
                ${company?.invoice_custom_message ? `
                <div class="custom-message-section" style="text-align: center; padding: 8px; font-style: italic; border-top: 1px solid #000; font-size: 10px; font-weight: bold; background-color: #fcfcfc;">
                    ${company.invoice_custom_message}
                </div>
                ` : ''}
                ${companyAddress ? `<div class="regd-office" style="text-align: center; padding: 4px; font-size: 9px; border-top: 1px solid #000;">Regd. Office : ${companyAddress}</div>` : ''}
            `;
        } else {
            pageFooterHTML = `
                <div class="continued-line">Continued on Page ${p + 1}...</div>
                <div style="flex-grow: 1;"></div>
                ${company?.invoice_custom_message ? `
                <div class="custom-message-section" style="text-align: center; padding: 8px; font-style: italic; border-top: 1px solid #000; font-size: 10px; font-weight: bold; background-color: #fcfcfc;">
                    ${company.invoice_custom_message}
                </div>
                ` : ''}
                ${companyAddress ? `<div class="regd-office" style="text-align: center; padding: 4px; font-size: 9px; border-top: 1px solid #000;">Regd. Office : ${companyAddress}</div>` : ''}
            `;
        }

        pagesHTML += `
            <div class="page">
                <div class="page-content">
                    <div>
                        ${pageHeaderHTML}
                        <div class="items-section">
                            <table class="items-table">
                                <thead>
                                    ${showExtraDisc ? `
                                    <tr>
                                        <th style="width: 3%;">#</th>
                                        <th style="width: 25%;">Description</th>
                                        <th style="width: 8%;">HSN</th>
                                        <th style="width: 7%;">Qty</th>
                                        <th style="width: 6%;">Rate</th>
                                        <th style="width: 6%;">Disc%</th>
                                        <th style="width: 10%;">Taxable(A)</th>
                                        <th style="width: 8%;">Extra Disc</th>
                                        <th style="width: 9%;">Net Taxable(B)</th>
                                        <th style="width: 6%;">GST%</th>
                                        <th style="width: 12%;">Total</th>
                                    </tr>
                                    ` : `
                                    <tr>
                                        <th style="width: 4%;">#</th>
                                        <th style="width: 35%;">Description</th>
                                        <th style="width: 10%;">HSN</th>
                                        <th style="width: 10%;">Qty</th>
                                        <th style="width: 8%;">Rate</th>
                                        <th style="width: 7%;">Disc%</th>
                                        <th style="width: 10%;">Taxable Value</th>
                                        <th style="width: 6%;">GST%</th>
                                        <th style="width: 10%;">Total</th>
                                    </tr>
                                    `}
                                </thead>
                                <tbody>
                                    ${tableRowsHTML}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div>
                        ${pageFooterHTML}
                    </div>
                </div>
            </div>
        `;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quotation - ${docNo}</title>
    <style>
        body { 
            font-family: Arial, Helvetica, sans-serif; 
            font-size: 11px; 
            margin: 0; 
            padding: 0; 
            color: #000;
            background: #f3f4f6;
        }
        * { box-sizing: border-box; }
        .page {
            width: 210mm;
            height: 297mm;
            margin: 20px auto;
            border: 1px solid #000;
            background: #fff;
            display: flex;
            flex-direction: column;
            padding: 8mm 10mm;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            position: relative;
        }
        .page-content {
            display: flex;
            flex-direction: column;
            height: 100%;
            justify-content: space-between;
            border: 1px solid #000;
        }
        .header-top {
            display: flex;
            justify-content: space-between;
            padding: 5px 10px;
            font-weight: bold;
        }
        .header-main {
            text-align: center;
            padding: 6px 10px;
            border-bottom: 1px solid #000;
            border-top: 1px solid #000;
            position: relative;
        }
        .header-main.has-logo {
            position: relative;
            text-align: center;
            padding: 6px 20px;
        }
        .logo-img {
            position: absolute;
            left: 20px;
            top: 50%;
            transform: translateY(-50%);
            max-width: 120px;
            max-height: 60px;
            object-fit: contain;
        }
        .header-text {
            flex: 1;
        }
        .header-main h1 {
            color: #d32f2f;
            margin: 3px 0;
            font-size: 20px;
        }
        .header-main p {
            margin: 1px 0;
            font-size: 10px;
        }
        .payment-info-section {
            display: flex;
            border-bottom: 1px solid #000;
            font-size: 10px;
        }
        .payment-info-col {
            flex: 1;
            padding: 8px 10px;
        }
        .payment-info-col.bank-details {
            flex: 1.8;
        }
        .payment-info-col.payment-upi,
        .payment-info-col.website-info {
            flex: 1;
        }
        .payment-info-col:not(:last-child) {
            border-right: 1px solid #000;
        }
        .payment-info-col strong {
            display: inline-block;
            margin-bottom: 4px;
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
        .meta-table td:first-child { width: 110px; }
        
        .items-section {
            border-bottom: 1px solid #000;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            margin-bottom: 5px;
        }
        .items-table {
            width: 100%;
            height: 100%;
            border-collapse: collapse;
            font-size: 10px;
        }
        .items-table th, .items-table td {
            border-right: 1px solid #000;
            border-bottom: none;
            padding: 4px;
        }
        .items-table th { border-bottom: 1px solid #000; text-align: center; font-weight: bold; }
        .items-table th:last-child, .items-table td:last-child { border-right: none; }
        .item-row { height: 24px; }
        .spacer-row td { height: auto; border-bottom: none; color: transparent; }
        
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .font-bold { font-weight: bold; }
        
        .totals-section {
        }
        .border-bottom {
            border-bottom: 1px solid #000;
        }
        .totals-row {
            display: flex;
        }
        .totals-left { flex: 1; padding: 10px; border-right: 1px solid #000; }
        .totals-right { width: 260px; }
        .total-line { display: flex; justify-content: space-between; padding: 3px 10px; font-size: 10px; }
        .total-line.grand { font-weight: bold; font-size: 12px; border-top: 2px solid #000; background: #f5f5f5; }
        
        .tax-summary-table { width: 100%; border-collapse: collapse; font-size: 9px; }
        .tax-summary-table th, .tax-summary-table td { border: none; padding: 2px 3px; }
        .tax-summary-table th { border-bottom: 1px solid #000; text-align: right; }
        .tax-summary-table th:first-child { text-align: center; }
        .tax-summary-table td { text-align: right; }
        .tax-summary-table td:first-child { text-align: center; }
        
        .amount-words { padding: 6px 10px; font-weight: bold; border-bottom: 1px solid #000; font-size: 11px; }
        
        .footer-section { display: flex; min-height: 75px; }
        
        .regd-office { text-align: center; padding: 4px; font-size: 9px; border-top: 1px solid #000; }
        .continued-line { text-align: right; font-weight: bold; font-style: italic; font-size: 10px; padding: 5px 10px; }
        
        @page { margin: 0; size: A4; }
        @media print {
            body { padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page { 
                margin: 0; 
                border: 1px solid #000; 
                box-shadow: none; 
                page-break-after: always; 
                height: 297mm;
                width: 210mm;
            }
            .page:last-child {
                page-break-after: avoid;
            }
        }
    </style>
</head>
<body>
    ${pagesHTML}
</body>
</html>`;

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

/**
 * GET /api/invoices/reports/thermal
 * Generate an 80mm thermal-optimized daily or session report HTML.
 */
export const getThermalReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const {
      period = 'daily',
      from_date,
      to_date,
      pos_session_id,
      outlet_id
    } = req.query as Record<string, string>;

    const todayStr = new Date().toISOString().split('T')[0];
    const targetFromDate = from_date || todayStr;
    const targetToDate = to_date || todayStr;

    // 1. Fetch Company details
    const { data: company } = await (supabaseAdmin || supabase)
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    // 2. Fetch Printed By user profile
    let printedBy = 'Unknown';
    if (req.user?.id) {
      const { data: profile } = await (supabaseAdmin || supabase)
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', req.user.id)
        .maybeSingle();
      if (profile) {
        printedBy = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown';
      }
    }

    // 3. Fetch POS Session & Cashier details if period is session
    let session = null;
    let targetOutletId = outlet_id;
    let cashierName = '-';
    if (period === 'session' && pos_session_id) {
      const { data: sData } = await (supabaseAdmin || supabase)
        .from('pos_sessions')
        .select('*')
        .eq('id', pos_session_id)
        .eq('company_id', companyId)
        .maybeSingle();

      if (sData) {
        session = sData;
        targetOutletId = sData.outlet_id;
        
        // Fetch cashier profile
        if (sData.cashier_id) {
          const { data: cProfile } = await (supabaseAdmin || supabase)
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('id', sData.cashier_id)
            .maybeSingle();
          if (cProfile) {
            cashierName = `${cProfile.first_name || ''} ${cProfile.last_name || ''}`.trim() || cProfile.email || '-';
          }
        }
      }
    }

    // 4. Fetch Outlet/Warehouse details
    let outlet = null;
    if (targetOutletId) {
      const { data: oData } = await (supabaseAdmin || supabase)
        .from('warehouses')
        .select('*')
        .eq('id', targetOutletId)
        .maybeSingle();
      outlet = oData;
    }

    // 5. Query orders in scope
    let ordersQuery = (supabaseAdmin || supabase)
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          product:products(name, category:categories!category_id(name)),
          variant:product_variants(name)
        )
      `)
      .eq('company_id', companyId)
      .eq('order_source', 'pos');

    if (period === 'session' && pos_session_id) {
      ordersQuery = ordersQuery.eq('pos_session_id', pos_session_id);
    } else {
      ordersQuery = ordersQuery
        .gte('created_at', `${targetFromDate}T00:00:00`)
        .lte('created_at', `${targetToDate}T23:59:59.999`);
      if (targetOutletId) {
        ordersQuery = ordersQuery.eq('outlet_id', targetOutletId);
      }
    }

    const { data: orders, error: ordersErr } = await ordersQuery;
    if (ordersErr) {
      throw new ApiError(500, `Failed to query orders: ${ordersErr.message}`);
    }

    // 6. Query POS returns in scope
    let returnsQuery = (supabaseAdmin || supabase)
      .from('orders')
      .select('*')
      .eq('company_id', companyId)
      .eq('order_type', 'return')
      .eq('order_source', 'pos');

    if (period === 'session' && pos_session_id) {
      returnsQuery = returnsQuery.eq('pos_session_id', pos_session_id);
    } else {
      returnsQuery = returnsQuery
        .gte('created_at', `${targetFromDate}T00:00:00`)
        .lte('created_at', `${targetToDate}T23:59:59.999`);
      if (targetOutletId) {
        returnsQuery = returnsQuery.eq('outlet_id', targetOutletId);
      }
    }

    const { data: returns } = await returnsQuery;

    // 7. Query payments for orders in scope
    const orderIds = (orders || []).map((o: any) => o.id);
    let payments: any[] = [];
    if (orderIds.length > 0) {
      const { data: pData } = await (supabaseAdmin || supabase)
        .from('payments')
        .select('*')
        .in('order_id', orderIds);
      payments = pData || [];
    }

    // 8. Generate Report HTML
    const html = generateThermalReportHTML({
      company,
      printedBy,
      period,
      from_date: targetFromDate,
      to_date: targetToDate,
      session,
      cashierName,
      outlet,
      orders: orders || [],
      returns: returns || [],
      payments
    });

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    next(error);
  }
};

/**
 * Helper to build the 80mm monospace thermal report HTML template
 */
function generateThermalReportHTML(data: {
  company: any;
  printedBy: string;
  period: string;
  from_date: string;
  to_date: string;
  session: any;
  cashierName: string;
  outlet: any;
  orders: any[];
  returns: any[];
  payments: any[];
}) {
  const {
    company,
    printedBy,
    period,
    from_date,
    to_date,
    session,
    cashierName,
    outlet,
    orders,
    returns,
    payments
  } = data;

  const isSession = period === 'session';
  const companyName = company?.name || 'Store';
  const companyAddress = [company?.address, company?.city, company?.state].filter(Boolean).join(', ');
  const companyPhone = company?.phone || '';

  // Get current timestamp formatted locally
  const printedOn = new Date().toLocaleString('en-IN', {
    dateStyle: 'short',
    timeStyle: 'medium'
  });

  // Calculate Date Range display
  let dateRangeStr = '';
  if (isSession && session) {
    const openedStr = new Date(session.opened_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
    const closedStr = session.closed_at 
      ? new Date(session.closed_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) 
      : 'OPEN';
    dateRangeStr = `Session: ${openedStr} to ${closedStr}`;
  } else {
    dateRangeStr = `Period: ${from_date} to ${to_date}`;
  }

  // Filter cancelled orders
  const activeOrders = orders.filter((o: any) => o.status !== 'cancelled');
  const cancelledOrders = orders.filter((o: any) => o.status === 'cancelled');

  // Sales Summary computations
  const grossSales = activeOrders.reduce((sum, o) => sum + Number(o.subtotal || 0), 0);
  const totalDiscount = activeOrders.reduce((sum, o) => sum + Number(o.total_discount || 0), 0);
  const totalTax = activeOrders.reduce((sum, o) => sum + Number(o.tax_amount || 0), 0);
  const netSales = activeOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const totalOrdersCount = activeOrders.length;
  const voidedOrdersCount = cancelledOrders.length;

  const totalReturnsValue = returns.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const totalReturnsCount = returns.length;

  // Payments Mix computation
  const paymentTotals: Record<string, { amount: number; count: number }> = {};
  const standardMethods = ['cash', 'card', 'upi', 'credit'];
  standardMethods.forEach(m => { paymentTotals[m] = { amount: 0, count: 0 }; });

  activeOrders.forEach((o: any) => {
    const method = (o.payment_method || 'cash').toLowerCase();
    const amount = Number(o.total_amount || 0);
    if (method === 'split') {
      const orderPayments = payments.filter((p: any) => p.order_id === o.id && p.status !== 'failed');
      orderPayments.forEach((p: any) => {
        const pm = (p.payment_method || 'other').toLowerCase();
        if (!paymentTotals[pm]) paymentTotals[pm] = { amount: 0, count: 0 };
        paymentTotals[pm].amount += Number(p.amount || 0);
        paymentTotals[pm].count += 1;
      });
    } else {
      if (!paymentTotals[method]) paymentTotals[method] = { amount: 0, count: 0 };
      paymentTotals[method].amount += amount;
      paymentTotals[method].count += 1;
    }
  });

  // Expected Cash calculation (opening cash + cash payments - cash refunds)
  let openingCash = 0;
  let closingCash = null;
  let expectedCash = 0;
  let cashVariance = null;
  let cashRefunds = 0;

  returns.forEach((r: any) => {
    if ((r.payment_method || '').toLowerCase() === 'cash') {
      cashRefunds += Number(r.total_amount || 0);
    }
  });

  if (isSession && session) {
    openingCash = Number(session.opening_cash || 0);
    closingCash = session.closing_cash !== null ? Number(session.closing_cash) : null;
    expectedCash = openingCash + (paymentTotals['cash']?.amount || 0) - cashRefunds;
    cashVariance = closingCash !== null ? (closingCash - expectedCash) : null;
  }

  // 1. Order Type Summary
  const orderTypeSummary: Record<string, { type: string; orders: number; charges: number; discount: number; netSale: number; grossSale: number }> = {};
  activeOrders.forEach((o: any) => {
    const typeRaw = o.fulfillment_type || 'cash_counter';
    const type = typeRaw.replace(/_/g, ' ').toUpperCase();
    if (!orderTypeSummary[type]) {
      orderTypeSummary[type] = { type, orders: 0, charges: 0, discount: 0, netSale: 0, grossSale: 0 };
    }
    const entry = orderTypeSummary[type];
    entry.orders += 1;
    entry.charges += Number(o.total_extra_charges || 0);
    entry.discount += Number(o.total_discount || 0);
    entry.netSale += Number(o.total_amount || 0);
    entry.grossSale += Number(o.subtotal || 0);
  });

  // 2. Category Summary
  const categorySummary: Record<string, { name: string; qty: number; amount: number }> = {};
  activeOrders.forEach((o: any) => {
    (o.order_items || []).forEach((it: any) => {
      const catName = it.product?.category?.name || 'UNCATEGORIZED';
      const qty = Number(it.quantity || 0);
      const amt = Number(it.unit_price || 0) * qty - Number(it.discount_amount || 0);
      if (!categorySummary[catName]) {
        categorySummary[catName] = { name: catName, qty: 0, amount: 0 };
      }
      categorySummary[catName].qty += qty;
      categorySummary[catName].amount += amt;
    });
  });

  // 3. Sold Items Summary
  const itemSummary: Record<string, { name: string; qty: number; amount: number }> = {};
  activeOrders.forEach((o: any) => {
    (o.order_items || []).forEach((it: any) => {
      const pName = it.product?.name || 'Item';
      const vName = it.variant?.name || '';
      const name = vName ? `${pName} (${vName})` : pName;
      const qty = Number(it.quantity || 0);
      const amt = Number(it.unit_price || 0) * qty - Number(it.discount_amount || 0);
      if (!itemSummary[name]) {
        itemSummary[name] = { name, qty: 0, amount: 0 };
      }
      itemSummary[name].qty += qty;
      itemSummary[name].amount += amt;
    });
  });

  // Helper formatting routines
  const formatCurrency = (val: any) => {
    if (val === null || val === undefined) return '-';
    return `Rs ${Number(val).toFixed(2)}`;
  };

  const formatStr = (val: any) => {
    return val ? String(val) : '-';
  };

  // Build rows for tables
  const orderTypeRows = Object.values(orderTypeSummary).map(entry => `
    <tr>
      <td>${entry.type}</td>
      <td class="text-right">${entry.orders}</td>
      <td class="text-right">${entry.charges.toFixed(2)}</td>
      <td class="text-right">${entry.discount.toFixed(2)}</td>
      <td class="text-right">${entry.netSale.toFixed(2)}</td>
      <td class="text-right">${entry.grossSale.toFixed(2)}</td>
    </tr>
  `).join('');

  const orderTypeTotals = Object.values(orderTypeSummary).reduce(
    (acc, entry) => {
      acc.orders += entry.orders;
      acc.charges += entry.charges;
      acc.discount += entry.discount;
      acc.netSale += entry.netSale;
      acc.grossSale += entry.grossSale;
      return acc;
    },
    { orders: 0, charges: 0, discount: 0, netSale: 0, grossSale: 0 }
  );

  const paymentMixRows = Object.entries(paymentTotals)
    .filter(([_, data]) => data.count > 0 || data.amount > 0)
    .map(([method, data]) => `
      <tr>
        <td>${method.toUpperCase()}</td>
        <td class="text-center">${data.count}</td>
        <td class="text-right">${formatCurrency(data.amount)}</td>
      </tr>
    `).join('');

  const paymentMixTotals = Object.values(paymentTotals).reduce(
    (acc, data) => {
      acc.count += data.count;
      acc.amount += data.amount;
      return acc;
    },
    { count: 0, amount: 0 }
  );

  const billRows = orders.map((o: any) => {
    const billNo = o.receipt_number ? o.receipt_number.split('-').pop() : o.id.substring(0, 8).toUpperCase();
    const qty = (o.order_items || []).reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0);
    const payMode = (o.payment_method || 'CASH').toUpperCase();
    return `
      <tr>
        <td>${billNo}</td>
        <td class="text-center">${qty}</td>
        <td class="text-right">${Number(o.tax_amount || 0).toFixed(2)}</td>
        <td class="text-right">${Number(o.total_discount || 0).toFixed(2)}</td>
        <td class="text-right">${Number(o.total_amount || 0).toFixed(2)}</td>
        <td class="text-center">${o.status.toUpperCase()}</td>
        <td class="text-center">${payMode}</td>
      </tr>
    `;
  }).join('');

  const billTotals = orders.reduce(
    (acc, o) => {
      acc.qty += (o.order_items || []).reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0);
      acc.tax += Number(o.tax_amount || 0);
      acc.disc += Number(o.total_discount || 0);
      acc.amt += Number(o.total_amount || 0);
      return acc;
    },
    { qty: 0, tax: 0, disc: 0, amt: 0 }
  );

  const categoryRows = Object.values(categorySummary).map(entry => `
    <tr>
      <td>${entry.name}</td>
      <td class="text-center">${entry.qty}</td>
      <td class="text-right">${formatCurrency(entry.amount)}</td>
    </tr>
  `).join('');

  const categoryTotals = Object.values(categorySummary).reduce(
    (acc, entry) => {
      acc.qty += entry.qty;
      acc.amount += entry.amount;
      return acc;
    },
    { qty: 0, amount: 0 }
  );

  const itemRows = Object.values(itemSummary).map(entry => `
    <tr>
      <td>${entry.name}</td>
      <td class="text-center">${entry.qty}</td>
      <td class="text-right">${formatCurrency(entry.amount)}</td>
    </tr>
  `).join('');

  const itemTotals = Object.values(itemSummary).reduce(
    (acc, entry) => {
      acc.qty += entry.qty;
      acc.amount += entry.amount;
      return acc;
    },
    { qty: 0, amount: 0 }
  );

  const reportTitle = isSession ? 'Session Report' : 'Sales Report';
  const summaryTitle = isSession ? 'Z Report Summary' : 'Sales Summary';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportTitle}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      width: 300px;
      padding: 10px;
      font-size: 11px;
      line-height: 1.3;
      color: #000;
      background: #fff;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .bold { font-weight: bold; }
    .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
    .solid-divider { border-bottom: 1px solid #000; margin: 6px 0; }
    
    .header { margin-bottom: 10px; text-align: center; }
    .header .company-name { font-size: 13px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
    .header .report-name { font-size: 15px; font-weight: bold; margin: 4px 0; text-transform: uppercase; }
    .header .location { font-size: 10px; line-height: 1.2; margin-bottom: 4px; }
    .header .meta { font-size: 9px; line-height: 1.2; }
    
    .section-title { font-weight: bold; text-align: center; margin: 8px 0 4px 0; text-transform: uppercase; }
    .kv-row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 11px; }
    .kv-val { text-align: right; font-weight: bold; }
    
    .report-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    .report-table th { font-size: 10px; text-transform: uppercase; font-weight: bold; border-bottom: 1px solid #000; padding: 4px 0; }
    .report-table td { font-size: 10px; padding: 4px 0; vertical-align: top; }
    .report-table .totals-row { border-top: 1px solid #000; font-weight: bold; }
    
    .footer { text-align: center; margin-top: 15px; font-size: 9px; }
    @page { margin: 0; }
    @media print {
      body { width: 100%; padding: 5mm; }
    }
  </style>
</head>
<body>
  <!-- Header Section -->
  <div class="header">
    <div class="company-name">${companyName}</div>
    <div class="report-name">${reportTitle}</div>
    <div class="location">
      ${companyAddress ? `<div>${companyAddress}</div>` : ''}
      ${companyPhone ? `<div>Tel: ${companyPhone}</div>` : ''}
      ${outlet?.name ? `<div class="bold" style="margin-top: 2px;">Branch: ${outlet.name}</div>` : ''}
    </div>
    <div class="divider"></div>
    <div class="meta">
      <div>Printed report on: ${printedOn}</div>
      <div class="bold" style="margin-top: 2px;">${dateRangeStr}</div>
    </div>
  </div>
  
  <div class="divider"></div>

  <!-- Main Summary Blocks -->
  <div class="solid-divider"></div>
  <div class="section-title">${summaryTitle}</div>
  <div class="solid-divider"></div>
  
  <div class="kv-row">
    <span>Printed by</span>
    <span class="kv-val">${formatStr(printedBy)}</span>
  </div>
  
  ${isSession && session ? `
    <div class="kv-row">
      <span>Cashier</span>
      <span class="kv-val">${formatStr(cashierName)}</span>
    </div>
    <div class="kv-row">
      <span>Session Status</span>
      <span class="kv-val">${session.status.toUpperCase()}</span>
    </div>
    <div class="kv-row">
      <span>Opening Cash</span>
      <span class="kv-val">${formatCurrency(openingCash)}</span>
    </div>
    <div class="kv-row">
      <span>Closing Cash</span>
      <span class="kv-val">${formatCurrency(closingCash)}</span>
    </div>
    <div class="kv-row">
      <span>Expected Cash</span>
      <span class="kv-val">${formatCurrency(expectedCash)}</span>
    </div>
    <div class="kv-row">
      <span>Cash Variance</span>
      <span class="kv-val" style="${cashVariance !== null && cashVariance < 0 ? 'color: red;' : ''}">${formatCurrency(cashVariance)}</span>
    </div>
    <div class="divider"></div>
  ` : ''}

  <div class="kv-row">
    <span>Total Orders</span>
    <span class="kv-val">${totalOrdersCount}</span>
  </div>
  <div class="kv-row">
    <span>Voided Orders</span>
    <span class="kv-val">${voidedOrdersCount}</span>
  </div>
  <div class="kv-row">
    <span>Gross Sales</span>
    <span class="kv-val">${formatCurrency(grossSales)}</span>
  </div>
  <div class="kv-row">
    <span>Total Discount</span>
    <span class="kv-val">${formatCurrency(totalDiscount)}</span>
  </div>
  <div class="kv-row">
    <span>Total Tax</span>
    <span class="kv-val">${formatCurrency(totalTax)}</span>
  </div>
  <div class="kv-row bold">
    <span>Net Sale Amt</span>
    <span class="kv-val">${formatCurrency(netSales)}</span>
  </div>
  
  <div class="divider"></div>
  
  <div class="kv-row">
    <span>Returns Count</span>
    <span class="kv-val">${totalReturnsCount}</span>
  </div>
  <div class="kv-row">
    <span>Returns Value</span>
    <span class="kv-val">${formatCurrency(totalReturnsValue)}</span>
  </div>

  <!-- Tabular Summaries: Order Type Summary -->
  <div class="solid-divider"></div>
  <div class="section-title">Order Type Summary</div>
  <div class="solid-divider"></div>
  <table class="report-table">
    <thead>
      <tr>
        <th class="text-left">Type</th>
        <th class="text-right">Ord</th>
        <th class="text-right">Chg</th>
        <th class="text-right">Disc</th>
        <th class="text-right">Net</th>
        <th class="text-right">Gross</th>
      </tr>
    </thead>
    <tbody>
      ${orderTypeRows || '<tr><td colspan="6" class="text-center">No orders</td></tr>'}
      ${orderTypeRows ? `
        <tr class="totals-row">
          <td>TOTAL</td>
          <td class="text-right">${orderTypeTotals.orders}</td>
          <td class="text-right">${orderTypeTotals.charges.toFixed(2)}</td>
          <td class="text-right">${orderTypeTotals.discount.toFixed(2)}</td>
          <td class="text-right">${orderTypeTotals.netSale.toFixed(2)}</td>
          <td class="text-right">${orderTypeTotals.grossSale.toFixed(2)}</td>
        </tr>
      ` : ''}
    </tbody>
  </table>

  <!-- Tabular Summaries: Payment Type Summary -->
  <div class="solid-divider"></div>
  <div class="section-title">Payment Type Summary</div>
  <div class="solid-divider"></div>
  <table class="report-table">
    <thead>
      <tr>
        <th class="text-left">Payment</th>
        <th class="text-center">Count</th>
        <th class="text-right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${paymentMixRows || '<tr><td colspan="3" class="text-center">No payments</td></tr>'}
      ${paymentMixRows ? `
        <tr class="totals-row">
          <td>TOTAL</td>
          <td class="text-center">${paymentMixTotals.count}</td>
          <td class="text-right">${formatCurrency(paymentMixTotals.amount)}</td>
        </tr>
      ` : ''}
    </tbody>
  </table>

  <!-- Tabular Summaries: Bill Summary -->
  <div class="solid-divider"></div>
  <div class="section-title">Bill Summary</div>
  <div class="solid-divider"></div>
  <table class="report-table">
    <thead>
      <tr>
        <th class="text-left">Bill</th>
        <th class="text-center">Qty</th>
        <th class="text-right">Tax</th>
        <th class="text-right">Disc</th>
        <th class="text-right">Amt</th>
        <th class="text-center">Stat</th>
        <th class="text-center">Mode</th>
      </tr>
    </thead>
    <tbody>
      ${billRows || '<tr><td colspan="7" class="text-center">No transactions</td></tr>'}
      ${billRows ? `
        <tr class="totals-row">
          <td>TOTAL</td>
          <td class="text-center">${billTotals.qty}</td>
          <td class="text-right">${billTotals.tax.toFixed(2)}</td>
          <td class="text-right">${billTotals.disc.toFixed(2)}</td>
          <td class="text-right">${billTotals.amt.toFixed(2)}</td>
          <td colspan="2"></td>
        </tr>
      ` : ''}
    </tbody>
  </table>

  <!-- Tabular Summaries: Category Summary -->
  <div class="solid-divider"></div>
  <div class="section-title">Category Summary</div>
  <div class="solid-divider"></div>
  <table class="report-table">
    <thead>
      <tr>
        <th class="text-left">Category</th>
        <th class="text-center">Qty</th>
        <th class="text-right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${categoryRows || '<tr><td colspan="3" class="text-center">No sales</td></tr>'}
      ${categoryRows ? `
        <tr class="totals-row">
          <td>TOTAL</td>
          <td class="text-center">${categoryTotals.qty}</td>
          <td class="text-right">${formatCurrency(categoryTotals.amount)}</td>
        </tr>
      ` : ''}
    </tbody>
  </table>

  <!-- Tabular Summaries: Sold Items Summary -->
  <div class="solid-divider"></div>
  <div class="section-title">Sold Items Summary</div>
  <div class="solid-divider"></div>
  <table class="report-table">
    <thead>
      <tr>
        <th class="text-left">Item Name</th>
        <th class="text-center">Qty</th>
        <th class="text-right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows || '<tr><td colspan="3" class="text-center">No items sold</td></tr>'}
      ${itemRows ? `
        <tr class="totals-row">
          <td>TOTAL</td>
          <td class="text-center">${itemTotals.qty}</td>
          <td class="text-right">${formatCurrency(itemTotals.amount)}</td>
        </tr>
      ` : ''}
    </tbody>
  </table>

  <!-- Footer Section -->
  <div class="divider"></div>
  <div class="footer">
    <p>Powered by Fresh Breeze Basket</p>
    <p>&copy; ${new Date().getFullYear()} ${companyName}</p>
  </div>
</body>
</html>
  `;
}

export const getPartyLedgerPrint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { partyId } = req.params;
    const companyId = req.companyId;
    const { date_from, date_to } = req.query;

    if (!companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const db = supabaseAdmin || supabase;

    // 1. Fetch Company details
    const { data: company, error: companyErr } = await db
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (companyErr || !company) {
      throw new ApiError(404, 'Company not found');
    }

    // 2. Fetch Party details
    const { data: party, error: partyErr } = await db
      .from('contact_parties')
      .select('*')
      .eq('id', partyId)
      .eq('company_id', companyId)
      .single();

    if (partyErr || !party) {
      throw new ApiError(404, 'Trading partner not found');
    }

    // 3. Fetch opening balance components (suppliers table has it)
    const { data: supplier } = await db
      .from('suppliers')
      .select('opening_balance, gst_no, pan_number')
      .eq('party_id', partyId)
      .eq('company_id', companyId)
      .maybeSingle();

    const { data: customer } = await db
      .from('customers')
      .select('trn_number')
      .eq('party_id', partyId)
      .eq('company_id', companyId)
      .maybeSingle();

    const gstNo = supplier?.gst_no || customer?.trn_number || '';
    const panNo = supplier?.pan_number || '';

    // Standard opening balance is from the supplier's opening_balance. Since customers don't have it, we start here.
    // If it's a supplier, opening balance represents a Credit (we owe them).
    // Let's model Opening Balance as: Debit is positive, Credit is negative.
    let baseOpeningBalance = 0;
    if (supplier && supplier.opening_balance) {
      baseOpeningBalance = -Number(supplier.opening_balance); // Credit balance initially
    }

    // 4. Calculate dynamic opening balance if date_from is provided
    let periodOpeningBalance = baseOpeningBalance;
    let preEntries: any[] = [];

    if (date_from) {
      const { data: fetchedPreEntries, error: preErr } = await db
        .from('party_ledger')
        .select('*')
        .eq('party_id', partyId)
        .eq('company_id', companyId)
        .lt('doc_date', date_from);

      if (preErr) {
        console.error('Error fetching pre-ledger entries:', preErr);
      } else {
        preEntries = (fetchedPreEntries || []).filter(e => e.status !== 'cancelled' && e.status !== 'failed');
        for (const entry of preEntries) {
          const amt = Number(entry.amount) || 0;
          if (entry.doc_type === 'sale' || entry.doc_type === 'payment_out') {
            // Debit
            periodOpeningBalance += amt;
          } else if (entry.doc_type === 'purchase' || entry.doc_type === 'payment_in' || entry.doc_type === 'credit_note') {
            // Credit
            periodOpeningBalance -= amt;
          }
        }
      }
    }

    // 5. Fetch ledger entries within the period
    let query = db
      .from('party_ledger')
      .select('*')
      .eq('party_id', partyId)
      .eq('company_id', companyId)
      .order('doc_date', { ascending: true });

    if (date_from) {
      query = query.gte('doc_date', date_from);
    }
    if (date_to) {
      query = query.lte('doc_date', date_to);
    }

    const { data: periodEntries, error: entriesErr } = await query;
    if (entriesErr) {
      throw new ApiError(500, 'Failed to fetch ledger entries');
    }

    const entries = (periodEntries || []).filter(e => e.status !== 'cancelled' && e.status !== 'failed');

    // Process entries and calculate running balance
    let runningBalance = periodOpeningBalance;
    let totalDebits = 0;
    let totalCredits = 0;

    const tableRows: string[] = [];

    // Add first row as Opening Balance
    const opBalDr = periodOpeningBalance > 0 ? periodOpeningBalance : 0;
    const opBalCr = periodOpeningBalance < 0 ? Math.abs(periodOpeningBalance) : 0;
    const opBalSide = periodOpeningBalance >= 0 ? 'Dr' : 'Cr';

    tableRows.push(`
      <tr class="opening-row" style="background-color: #fafafa; font-weight: bold;">
        <td>${date_from ? new Date(date_from as string).toLocaleDateString('en-IN') : 'Start'}</td>
        <td colspan="3">Opening Balance</td>
        <td class="text-right">${opBalDr > 0 ? opBalDr.toFixed(2) : '-'}</td>
        <td class="text-right">${opBalCr > 0 ? opBalCr.toFixed(2) : '-'}</td>
        <td class="text-right">${Math.abs(periodOpeningBalance).toFixed(2)} ${opBalSide}</td>
      </tr>
    `);

    for (const entry of entries) {
      const amt = Number(entry.amount) || 0;
      let debit = 0;
      let credit = 0;
      let typeLabel = '';
      let particulars = '';

      if (entry.doc_type === 'sale') {
        debit = amt;
        totalDebits += amt;
        runningBalance += amt;
        typeLabel = 'Sale';
        particulars = `Sales Invoice #${entry.doc_id.substring(0, 8).toUpperCase()}`;
      } else if (entry.doc_type === 'payment_out') {
        debit = amt;
        totalDebits += amt;
        runningBalance += amt;
        typeLabel = 'Payment Out';
        particulars = `Supplier Payment Ref: ${entry.doc_id.substring(0, 8).toUpperCase()}`;
      } else if (entry.doc_type === 'purchase') {
        credit = amt;
        totalCredits += amt;
        runningBalance -= amt;
        typeLabel = 'Purchase';
        particulars = `Purchase Invoice #${entry.doc_id.substring(0, 8).toUpperCase()}`;
      } else if (entry.doc_type === 'payment_in') {
        credit = amt;
        totalCredits += amt;
        runningBalance -= amt;
        typeLabel = 'Payment In';
        particulars = `Customer Payment Ref: ${entry.doc_id.substring(0, 8).toUpperCase()}`;
      } else if (entry.doc_type === 'credit_note') {
        credit = amt;
        totalCredits += amt;
        runningBalance -= amt;
        typeLabel = 'Credit Note';
        particulars = `Credit Note #${entry.doc_id.substring(0, 8).toUpperCase()}`;
      } else {
        if (entry.ledger_side === 'receivable') {
          debit = amt;
          totalDebits += amt;
          runningBalance += amt;
        } else {
          credit = amt;
          totalCredits += amt;
          runningBalance -= amt;
        }
        typeLabel = entry.doc_type.replace(/_/g, ' ');
        particulars = `Doc ID: ${entry.doc_id.substring(0, 8).toUpperCase()}`;
      }

      const balSide = runningBalance >= 0 ? 'Dr' : 'Cr';

      tableRows.push(`
        <tr>
          <td>${new Date(entry.doc_date).toLocaleDateString('en-IN')}</td>
          <td>${particulars}</td>
          <td class="capitalize">${typeLabel}</td>
          <td>${entry.status || 'Completed'}</td>
          <td class="text-right">${debit > 0 ? debit.toFixed(2) : '-'}</td>
          <td class="text-right">${credit > 0 ? credit.toFixed(2) : '-'}</td>
          <td class="text-right">${Math.abs(runningBalance).toFixed(2)} ${balSide}</td>
        </tr>
      `);
    }

    const netClosingBalance = runningBalance;
    const closingSide = netClosingBalance >= 0 ? 'Dr' : 'Cr';

    // Add closing row
    tableRows.push(`
      <tr class="closing-row" style="border-top: 2px solid #333; background-color: #f9f9f9; font-weight: bold;">
        <td>${date_to ? new Date(date_to as string).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}</td>
        <td colspan="3">Closing Balance / Net Position</td>
        <td class="text-right">${totalDebits.toFixed(2)}</td>
        <td class="text-right">${totalCredits.toFixed(2)}</td>
        <td class="text-right" style="background-color: #f5f5f5;">${Math.abs(netClosingBalance).toFixed(2)} ${closingSide}</td>
      </tr>
    `);

    const companyName = company.name || 'Our Company';
    const companyAddress = [company.address, company.city, company.state, company.postal_code].filter(Boolean).join(', ');
    const companyPhone = company.phone || '';
    const companyEmail = company.email || '';
    const companyGSTIN = company.gstin || '';

    let periodText = 'All Transactions';
    if (date_from && date_to) {
      periodText = `Period: ${new Date(date_from as string).toLocaleDateString('en-IN')} to ${new Date(date_to as string).toLocaleDateString('en-IN')}`;
    } else if (date_from) {
      periodText = `From: ${new Date(date_from as string).toLocaleDateString('en-IN')}`;
    } else if (date_to) {
      periodText = `To: ${new Date(date_to as string).toLocaleDateString('en-IN')}`;
    }

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Party Ledger Statement - ${party.name}</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #333;
      margin: 0;
      padding: 20px;
      background-color: #fff;
    }
    * {
      box-sizing: border-box;
    }
    .header {
      width: 100%;
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .company-name {
      font-size: 18px;
      font-weight: bold;
      text-transform: uppercase;
      color: #111;
      margin-bottom: 5px;
    }
    .company-details {
      color: #555;
      font-size: 10px;
    }
    .statement-title {
      font-size: 14px;
      font-weight: bold;
      text-align: center;
      margin: 15px 0 5px 0;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .statement-period {
      font-size: 10px;
      text-align: center;
      color: #666;
      margin-bottom: 20px;
      font-style: italic;
    }
    .details-table {
      width: 100%;
      margin-bottom: 20px;
      border-collapse: collapse;
    }
    .details-table td {
      padding: 4px 0;
      vertical-align: top;
    }
    .details-label {
      font-weight: bold;
      width: 120px;
    }
    .summary-box {
      width: 100%;
      border: 1px solid #ddd;
      background-color: #fcfcfc;
      padding: 10px 15px;
      margin-bottom: 20px;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .summary-item {
      text-align: center;
      padding: 5px 10px;
    }
    .summary-item-label {
      font-size: 9px;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 3px;
    }
    .summary-item-value {
      font-size: 13px;
      font-weight: bold;
    }
    .ledger-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    .ledger-table th, .ledger-table td {
      border: 1px solid #ddd;
      padding: 6px 8px;
      text-align: left;
    }
    .ledger-table th {
      background-color: #f5f5f5;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 9px;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .font-bold {
      font-weight: bold;
    }
    .opening-row td {
      background-color: #fafafa;
      color: #444;
    }
    .closing-row td {
      border-top: 2px solid #333;
      background-color: #f9f9f9;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 8px;
      color: #999;
      border-top: 1px solid #eee;
      padding-top: 10px;
    }
    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none;
      }
      .ledger-table th {
        background-color: #eaeaea !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .summary-box {
        background-color: #f7f7f7 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      @page {
        margin: 1.5cm;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-name">${companyName}</div>
    <div class="company-details">
      ${companyAddress ? `Address: ${companyAddress} | ` : ''}
      ${companyPhone ? `Phone: ${companyPhone} | ` : ''}
      ${companyEmail ? `Email: ${companyEmail} | ` : ''}
      ${companyGSTIN ? `GSTIN: ${companyGSTIN}` : ''}
    </div>
  </div>

  <div class="statement-title">Account Ledger Statement</div>
  <div class="statement-period">${periodText}</div>

  <table class="details-table">
    <tr>
      <td class="details-label">Account of:</td>
      <td>
        <strong>${party.name}</strong><br/>
        ${party.email ? `Email: ${party.email}<br/>` : ''}
        ${party.phone ? `Phone: ${party.phone}<br/>` : ''}
        ${gstNo ? `GSTIN: ${gstNo}<br/>` : ''}
        ${panNo ? `PAN: ${panNo}<br/>` : ''}
      </td>
      <td class="details-label" style="text-align: right;">Report Generated:</td>
      <td style="text-align: right;">${new Date().toLocaleString('en-IN')}</td>
    </tr>
  </table>

  <div class="summary-box">
    <div class="summary-item">
      <div class="summary-item-label">Opening Balance</div>
      <div class="summary-item-value" style="color: ${periodOpeningBalance >= 0 ? '#b45309' : '#047857'};">
        ₹ ${Math.abs(periodOpeningBalance).toFixed(2)} ${periodOpeningBalance >= 0 ? 'Dr' : 'Cr'}
      </div>
    </div>
    <div class="summary-item">
      <div class="summary-item-label">Total Debits (+)</div>
      <div class="summary-item-value">₹ ${totalDebits.toFixed(2)}</div>
    </div>
    <div class="summary-item">
      <div class="summary-item-label">Total Credits (-)</div>
      <div class="summary-item-value">₹ ${totalCredits.toFixed(2)}</div>
    </div>
    <div class="summary-item">
      <div class="summary-item-label">Closing Balance</div>
      <div class="summary-item-value" style="color: ${netClosingBalance >= 0 ? '#b45309' : '#047857'}; font-size: 14px;">
        ₹ ${Math.abs(netClosingBalance).toFixed(2)} ${closingSide}
      </div>
    </div>
  </div>

  <table class="ledger-table">
    <thead>
      <tr>
        <th style="width: 10%;">Date</th>
        <th style="width: 35%;">Particulars / Reference</th>
        <th style="width: 15%;">Vch Type</th>
        <th style="width: 10%;">Status</th>
        <th style="width: 10%; text-align: right;">Debit (Dr)</th>
        <th style="width: 10%; text-align: right;">Credit (Cr)</th>
        <th style="width: 10%; text-align: right;">Balance</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows.join('')}
    </tbody>
  </table>

  <div class="footer">
    <p>This is a computer-generated ledger statement and does not require a physical signature.</p>
    <p>Powered by Fresh Breeze Basket</p>
  </div>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    next(error);
  }
};
