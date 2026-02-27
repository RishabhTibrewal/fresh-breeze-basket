import { Request, Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import { supabase, supabaseAdmin } from '../config/supabase';
import { ApiError } from '../middleware/error';

/**
 * Generate HTML invoice for POS thermal printer (80mm width, compact format)
 * GET /api/invoices/pos/:orderId
 */
export const getPOSInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    // Fetch company details
    const { data: company } = await (supabaseAdmin || supabase)
      .from('companies')
      .select('name')
      .eq('id', req.companyId)
      .single();

    const companyName = company?.name || 'Fresh Breeze Basket';

    // Fetch order with all details
    const { data: order, error: orderError } = await (supabaseAdmin || supabase)
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          products (*)
        )
      `)
      .eq('id', orderId)
      .eq('company_id', req.companyId)
      .single();

    if (orderError || !order) {
      throw new ApiError(404, 'Order not found');
    }

    // Get customer details if available (for POS, usually walk-in)
    let customerName = 'Walk-in Customer';
    let customerPhone = '';
    
    if (order.user_id) {
      const { data: customer } = await (supabaseAdmin || supabase)
        .from('customers')
        .select('name, phone')
        .eq('user_id', order.user_id)
        .eq('company_id', req.companyId)
        .single();
      
      if (customer) {
        customerName = customer.name || customerName;
        customerPhone = customer.phone || '';
      }
    } else {
      // For POS orders, check notes for customer info
      if (order.notes) {
        const customerMatch = order.notes.match(/Customer:\s*([^,|]+)/);
        const phoneMatch = order.notes.match(/Phone:\s*([^,|]+)/);
        if (customerMatch) customerName = customerMatch[1].trim();
        if (phoneMatch) customerPhone = phoneMatch[1].trim();
      }
    }

    // Generate HTML invoice
    const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let itemsHTML = '';
    let subtotal = 0;

    if (order.order_items && Array.isArray(order.order_items)) {
      order.order_items.forEach((item: any) => {
        const productName = item.products?.name || 'Product';
        const quantity = item.quantity || 0;
        const unitPrice = parseFloat(item.unit_price) || 0;
        const lineTotal = quantity * unitPrice;
        subtotal += lineTotal;

        itemsHTML += `
          <tr>
            <td>${productName}</td>
            <td style="text-align: center;">${quantity}</td>
            <td style="text-align: right;">₹${unitPrice.toFixed(2)}</td>
            <td style="text-align: right;">₹${lineTotal.toFixed(2)}</td>
          </tr>
        `;
      });
    }

    const tax = subtotal * 0.05; // 5% tax
    const total = subtotal + tax;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>POS Invoice #${order.id.substring(0, 8)}</title>
  <style>
    @media print {
      @page {
        size: 80mm auto;
        margin: 0;
      }
      body {
        margin: 0;
        padding: 10px;
      }
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: 'Courier New', monospace;
      font-size: 11px;
      line-height: 1.4;
      width: 80mm;
      margin: 0 auto;
      padding: 10px;
      color: #000;
    }
    .header {
      text-align: center;
      border-bottom: 1px dashed #000;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }
    .header h1 {
      margin: 0;
      font-size: 16px;
      font-weight: bold;
      letter-spacing: 1px;
    }
    .header .subtitle {
      margin: 4px 0;
      font-size: 9px;
    }
    .info {
      margin: 8px 0;
      font-size: 10px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin: 2px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
      font-size: 10px;
    }
    th {
      text-align: left;
      border-bottom: 1px dashed #000;
      padding: 4px 0;
      font-weight: bold;
      font-size: 9px;
    }
    th:nth-child(2), th:nth-child(3), th:nth-child(4) {
      text-align: right;
    }
    td {
      padding: 3px 0;
      border-bottom: 1px dotted #ccc;
      font-size: 9px;
    }
    td:nth-child(2), td:nth-child(3), td:nth-child(4) {
      text-align: right;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 10px;
    }
    .total-row.grand-total {
      font-weight: bold;
      font-size: 12px;
      border-top: 1px dashed #000;
      border-bottom: 1px dashed #000;
      padding: 6px 0;
      margin-top: 4px;
    }
    .payment-info {
      margin-top: 8px;
      padding: 6px 0;
      border-top: 1px dashed #000;
      font-size: 9px;
    }
    .footer {
      text-align: center;
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px dashed #000;
      font-size: 8px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${companyName.toUpperCase()}</h1>
    <div class="subtitle">POS RECEIPT</div>
  </div>
  
  <div class="info">
    <div class="info-row">
      <span>Order #:</span>
      <span>${order.id.substring(0, 8).toUpperCase()}</span>
    </div>
    <div class="info-row">
      <span>Date:</span>
      <span>${orderDate}</span>
    </div>
    ${customerName !== 'Walk-in Customer' ? `
    <div class="info-row">
      <span>Customer:</span>
      <span>${customerName}</span>
    </div>
    ` : ''}
    ${customerPhone ? `
    <div class="info-row">
      <span>Phone:</span>
      <span>${customerPhone}</span>
    </div>
    ` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th>Qty</th>
        <th>Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHTML}
    </tbody>
  </table>

  <div class="info">
    <div class="total-row">
      <span>Subtotal:</span>
      <span>₹${subtotal.toFixed(2)}</span>
    </div>
    <div class="total-row">
      <span>Tax (5%):</span>
      <span>₹${tax.toFixed(2)}</span>
    </div>
    <div class="total-row grand-total">
      <span>TOTAL:</span>
      <span>₹${total.toFixed(2)}</span>
    </div>
    <div class="total-row">
      <span>Payment:</span>
      <span>${order.payment_method?.toUpperCase().replace('_', ' ') || 'CASH'}</span>
    </div>
  </div>

  <div class="footer">
    <p><strong>Thank you!</strong></p>
    <p>Visit us again</p>
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

/**
 * Generate PDF bill for customers
 * GET /api/invoices/customer/:orderId
 */
export const getCustomerBill = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    // Fetch company details
    const { data: company } = await (supabaseAdmin || supabase)
      .from('companies')
      .select('name')
      .eq('id', req.companyId)
      .single();

    const companyName = company?.name || 'Fresh Breeze Basket';

    // Fetch order with all details
    const { data: order, error: orderError } = await (supabaseAdmin || supabase)
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          products (*)
        )
      `)
      .eq('id', orderId)
      .eq('company_id', req.companyId)
      .single();

    if (orderError || !order) {
      throw new ApiError(404, 'Order not found');
    }

    // Get customer details
    let customerName = '';
    let customerEmail = '';
    let customerPhone = '';
    let shippingAddress: any = null;

    if (order.user_id) {
      const { data: customer } = await (supabaseAdmin || supabase)
        .from('customers')
        .select('name, email, phone')
        .eq('user_id', order.user_id)
        .eq('company_id', req.companyId)
        .single();
      
      if (customer) {
        customerName = customer.name || '';
        customerEmail = customer.email || '';
        customerPhone = customer.phone || '';
      }

      // Get shipping address
      if (order.shipping_address_id) {
        const { data: address } = await (supabaseAdmin || supabase)
          .from('addresses')
          .select('*')
          .eq('id', order.shipping_address_id)
          .eq('company_id', req.companyId)
          .single();
        
        if (address) {
          shippingAddress = address;
        }
      }
    }

    // Create PDF document with proper A4 margins
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 50,
      info: {
        Title: `Invoice ${order.id.substring(0, 8)}`,
        Author: companyName,
        Subject: 'Invoice'
      }
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.id.substring(0, 8)}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Header Section
    doc.fontSize(28).font('Helvetica-Bold').text(companyName.toUpperCase(), { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(14).font('Helvetica').text('INVOICE', { align: 'center' });
    doc.moveDown(1);

    // Draw header line
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#000000').lineWidth(2).stroke();
    doc.moveDown(1);

    // Invoice and Customer Details Section
    const invoiceDate = new Date(order.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const startY = doc.y;
    const leftColumnX = 50;
    const rightColumnX = 320;
    const columnWidth = 220;

    // Left Column - Bill To
    doc.fontSize(12).font('Helvetica-Bold').text('Bill To:', leftColumnX, startY);
    doc.moveDown(0.4);
    doc.fontSize(10).font('Helvetica');
    const billToY = doc.y;
    doc.text(customerName || 'Walk-in Customer', leftColumnX, billToY);
    let currentY = doc.y;
    if (customerPhone) {
      doc.text(`Phone: ${customerPhone}`, leftColumnX, currentY);
      currentY = doc.y;
    }
    if (customerEmail) {
      doc.text(`Email: ${customerEmail}`, leftColumnX, currentY);
      currentY = doc.y;
    }
    if (shippingAddress) {
      doc.moveDown(0.2);
      currentY = doc.y;
      if (shippingAddress.address_line1) {
        doc.text(shippingAddress.address_line1, leftColumnX, currentY);
        currentY = doc.y;
      }
      if (shippingAddress.address_line2) {
        doc.text(shippingAddress.address_line2, leftColumnX, currentY);
        currentY = doc.y;
      }
      const addressParts = [
        shippingAddress.city,
        shippingAddress.state,
        shippingAddress.postal_code
      ].filter(Boolean);
      if (addressParts.length > 0) {
        doc.text(addressParts.join(', '), leftColumnX, currentY);
        currentY = doc.y;
      }
      if (shippingAddress.country) {
        doc.text(shippingAddress.country, leftColumnX, currentY);
        currentY = doc.y;
      }
    }

    // Right Column - Invoice Details
    const invoiceDetailsY = startY;
    doc.fontSize(12).font('Helvetica-Bold').text('Invoice Details:', rightColumnX, invoiceDetailsY);
    doc.moveDown(0.4);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Invoice #: ${order.id.substring(0, 8).toUpperCase()}`, rightColumnX, doc.y);
    doc.text(`Date: ${invoiceDate}`, rightColumnX, doc.y);
    doc.text(`Order #: ${order.id.substring(0, 8).toUpperCase()}`, rightColumnX, doc.y);

    // Move to the lower of the two columns
    doc.y = Math.max(doc.y, currentY);
    doc.moveDown(1);

    // Draw separator line
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#000000').lineWidth(1).stroke();
    doc.moveDown(0.5);

    // Items table header
    const tableTop = doc.y;
    doc.fontSize(11).font('Helvetica-Bold');
    doc.fillColor('#FFFFFF');
    doc.rect(50, tableTop - 5, 495, 20).fill();
    doc.fillColor('#000000');
    doc.text('Item Description', 55, tableTop + 2);
    doc.text('Quantity', 350, tableTop + 2, { align: 'right' });
    doc.text('Unit Price', 420, tableTop + 2, { align: 'right' });
    doc.text('Total', 500, tableTop + 2, { align: 'right' });
    doc.moveDown(0.5);

    // Items
    let subtotal = 0;
    doc.font('Helvetica').fontSize(10);

    if (order.order_items && Array.isArray(order.order_items)) {
      order.order_items.forEach((item: any, index: number) => {
        const productName = item.products?.name || 'Product';
        const quantity = item.quantity || 0;
        const unitPrice = parseFloat(item.unit_price) || 0;
        const lineTotal = quantity * unitPrice;
        subtotal += lineTotal;

        // Check if we need a new page
        if (doc.y > 650) {
          doc.addPage();
          // Redraw header on new page
          doc.fontSize(11).font('Helvetica-Bold');
          doc.fillColor('#FFFFFF');
          doc.rect(50, doc.y - 5, 495, 20).fill();
          doc.fillColor('#000000');
          doc.text('Item Description', 55, doc.y + 2);
          doc.text('Quantity', 350, doc.y + 2, { align: 'right' });
          doc.text('Unit Price', 420, doc.y + 2, { align: 'right' });
          doc.text('Total', 500, doc.y + 2, { align: 'right' });
          doc.moveDown(0.5);
          doc.font('Helvetica').fontSize(10);
        }

        // Alternate row background
        if (index % 2 === 0) {
          doc.fillColor('#F9F9F9');
          doc.rect(50, doc.y - 3, 495, 15).fill();
          doc.fillColor('#000000');
        }

        doc.text(productName, 55, doc.y, { width: 280 });
        doc.text(quantity.toString(), 350, doc.y, { align: 'right' });
        doc.text(`₹${unitPrice.toFixed(2)}`, 420, doc.y, { align: 'right', width: 70 });
        doc.text(`₹${lineTotal.toFixed(2)}`, 500, doc.y, { align: 'right', width: 45 });
        doc.moveDown(0.5);
      });
    }

    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#000000').lineWidth(1).stroke();
    doc.moveDown(0.5);

    // Totals Section
    const tax = subtotal * 0.05; // 5% tax
    const total = subtotal + tax;

    const totalsStartX = 380;
    const totalsWidth = 165;

    doc.font('Helvetica').fontSize(10);
    doc.text('Subtotal:', totalsStartX, doc.y, { align: 'right', width: totalsWidth - 45 });
    doc.text(`₹${subtotal.toFixed(2)}`, 500, doc.y, { align: 'right', width: 45 });
    doc.moveDown(0.4);

    doc.text('Tax (5%):', totalsStartX, doc.y, { align: 'right', width: totalsWidth - 45 });
    doc.text(`₹${tax.toFixed(2)}`, 500, doc.y, { align: 'right', width: 45 });
    doc.moveDown(0.5);

    // Grand Total
    doc.font('Helvetica-Bold').fontSize(14);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#000000').lineWidth(2).stroke();
    doc.moveDown(0.3);
    doc.text('TOTAL:', totalsStartX, doc.y, { align: 'right', width: totalsWidth - 45 });
    doc.text(`₹${total.toFixed(2)}`, 500, doc.y, { align: 'right', width: 45 });
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#000000').lineWidth(2).stroke();
    doc.moveDown(1);

    // Payment Information Box
    doc.font('Helvetica').fontSize(10);
    const paymentBoxY = doc.y;
    doc.fillColor('#F9F9F9');
    doc.rect(50, paymentBoxY, 495, 40).fill();
    doc.fillColor('#000000');
    doc.font('Helvetica-Bold').fontSize(11).text('Payment Information', 60, paymentBoxY + 8);
    doc.font('Helvetica').fontSize(10);
    doc.text(`Payment Method: ${order.payment_method?.toUpperCase().replace('_', ' ') || 'CASH'}`, 60, paymentBoxY + 22);
    doc.text(`Payment Status: ${order.payment_status?.toUpperCase() || 'PENDING'}`, 60, paymentBoxY + 32);
    doc.y = paymentBoxY + 50;
    doc.moveDown(1);

    // Footer
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#000000').lineWidth(1).stroke();
    doc.moveDown(1);
    doc.fontSize(10).font('Helvetica-Bold').text('Thank you for your business!', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica').text('For inquiries, please contact us at info@gofreshco.com', { align: 'center' });
    doc.text('www.gofreshco.com', { align: 'center' });

    // Finalize PDF
    doc.end();
  } catch (error) {
    next(error);
  }
};
