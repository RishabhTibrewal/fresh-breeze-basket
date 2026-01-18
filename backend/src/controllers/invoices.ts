import { Request, Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import { supabase } from '../config/supabase';
import { ApiError } from '../middleware/error';

/**
 * Generate HTML invoice for POS machine
 * GET /api/invoices/pos/:orderId
 */
export const getPOSInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;

    // Fetch order with all details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          products (*)
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new ApiError(404, 'Order not found');
    }

    // Get customer details if available
    let customerName = 'Walk-in Customer';
    let customerPhone = '';
    
    if (order.user_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('name, phone')
        .eq('user_id', order.user_id)
        .single();
      
      if (customer) {
        customerName = customer.name || customerName;
        customerPhone = customer.phone || '';
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
  <title>Invoice #${order.id.substring(0, 8)}</title>
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
    body {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      width: 80mm;
      margin: 0 auto;
      padding: 10px;
    }
    .header {
      text-align: center;
      border-bottom: 1px dashed #000;
      padding-bottom: 10px;
      margin-bottom: 10px;
    }
    .header h1 {
      margin: 0;
      font-size: 18px;
      font-weight: bold;
    }
    .header p {
      margin: 2px 0;
      font-size: 10px;
    }
    .info {
      margin: 10px 0;
      font-size: 11px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin: 3px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 11px;
    }
    th {
      text-align: left;
      border-bottom: 1px dashed #000;
      padding: 5px 0;
      font-weight: bold;
    }
    td {
      padding: 3px 0;
      border-bottom: 1px dotted #ccc;
    }
    .total-row {
      font-weight: bold;
      border-top: 1px dashed #000;
      border-bottom: 1px dashed #000;
      padding: 5px 0;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px dashed #000;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>FRESH BREEZE BASKET</h1>
    <p>Thank you for your purchase!</p>
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
        <th style="text-align: center;">Qty</th>
        <th style="text-align: right;">Price</th>
        <th style="text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHTML}
    </tbody>
  </table>

  <div class="info">
    <div class="info-row">
      <span>Subtotal:</span>
      <span>₹${subtotal.toFixed(2)}</span>
    </div>
    <div class="info-row">
      <span>Tax (5%):</span>
      <span>₹${tax.toFixed(2)}</span>
    </div>
    <div class="info-row total-row">
      <span>TOTAL:</span>
      <span>₹${total.toFixed(2)}</span>
    </div>
    <div class="info-row">
      <span>Payment:</span>
      <span>${order.payment_method?.toUpperCase() || 'CASH'}</span>
    </div>
  </div>

  <div class="footer">
    <p>Visit us again!</p>
    <p>www.gofreshco.com</p>
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

    // Fetch order with all details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          products (*)
        )
      `)
      .eq('id', orderId)
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
      const { data: customer } = await supabase
        .from('customers')
        .select('name, email, phone')
        .eq('user_id', order.user_id)
        .single();
      
      if (customer) {
        customerName = customer.name || '';
        customerEmail = customer.email || '';
        customerPhone = customer.phone || '';
      }

      // Get shipping address
      if (order.shipping_address_id) {
        const { data: address } = await supabase
          .from('addresses')
          .select('*')
          .eq('id', order.shipping_address_id)
          .single();
        
        if (address) {
          shippingAddress = address;
        }
      }
    }

    // Create PDF document
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.id.substring(0, 8)}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('FRESH BREEZE BASKET', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica').text('Invoice', { align: 'center' });
    doc.moveDown();

    // Company info (you can customize this)
    doc.fontSize(10).font('Helvetica');
    doc.text('123 Business Street', { align: 'center' });
    doc.text('City, State 12345', { align: 'center' });
    doc.text('Phone: +1 234 567 8900', { align: 'center' });
    doc.text('Email: info@gofreshco.com', { align: 'center' });
    doc.moveDown();

    // Draw line
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Invoice details
    const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    doc.fontSize(10);
    doc.text(`Invoice Number: ${order.id.substring(0, 8).toUpperCase()}`, 50, doc.y);
    doc.text(`Date: ${orderDate}`, 50, doc.y);
    doc.moveDown();

    // Customer details
    if (customerName) {
      doc.fontSize(12).font('Helvetica-Bold').text('Bill To:', 50, doc.y);
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      doc.text(customerName, 50, doc.y);
      if (customerPhone) {
        doc.text(`Phone: ${customerPhone}`, 50, doc.y);
      }
      if (customerEmail) {
        doc.text(`Email: ${customerEmail}`, 50, doc.y);
      }
      if (shippingAddress) {
        doc.moveDown(0.3);
        if (shippingAddress.address_line1) {
          doc.text(shippingAddress.address_line1, 50, doc.y);
        }
        if (shippingAddress.address_line2) {
          doc.text(shippingAddress.address_line2, 50, doc.y);
        }
        const addressParts = [
          shippingAddress.city,
          shippingAddress.state,
          shippingAddress.postal_code
        ].filter(Boolean);
        if (addressParts.length > 0) {
          doc.text(addressParts.join(', '), 50, doc.y);
        }
        if (shippingAddress.country) {
          doc.text(shippingAddress.country, 50, doc.y);
        }
      }
      doc.moveDown();
    }

    // Draw line
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Items table header
    const tableTop = doc.y;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Item', 50, tableTop);
    doc.text('Quantity', 300, tableTop);
    doc.text('Unit Price', 380, tableTop, { align: 'right' });
    doc.text('Total', 480, tableTop, { align: 'right' });
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.3);

    // Items
    let subtotal = 0;
    doc.font('Helvetica').fontSize(10);

    if (order.order_items && Array.isArray(order.order_items)) {
      order.order_items.forEach((item: any) => {
        const productName = item.products?.name || 'Product';
        const quantity = item.quantity || 0;
        const unitPrice = parseFloat(item.unit_price) || 0;
        const lineTotal = quantity * unitPrice;
        subtotal += lineTotal;

        // Check if we need a new page
        if (doc.y > 700) {
          doc.addPage();
        }

        doc.text(productName, 50, doc.y, { width: 240 });
        doc.text(quantity.toString(), 300, doc.y);
        doc.text(`₹${unitPrice.toFixed(2)}`, 380, doc.y, { align: 'right', width: 90 });
        doc.text(`₹${lineTotal.toFixed(2)}`, 480, doc.y, { align: 'right', width: 70 });
        doc.moveDown(0.4);
      });
    }

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    // Totals
    const tax = subtotal * 0.05; // 5% tax
    const total = subtotal + tax;

    doc.text('Subtotal:', 380, doc.y, { align: 'right', width: 90 });
    doc.text(`₹${subtotal.toFixed(2)}`, 480, doc.y, { align: 'right', width: 70 });
    doc.moveDown(0.3);

    doc.text('Tax (5%):', 380, doc.y, { align: 'right', width: 90 });
    doc.text(`₹${tax.toFixed(2)}`, 480, doc.y, { align: 'right', width: 70 });
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').fontSize(12);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.3);
    doc.text('Total:', 380, doc.y, { align: 'right', width: 90 });
    doc.text(`₹${total.toFixed(2)}`, 480, doc.y, { align: 'right', width: 70 });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Payment info
    doc.font('Helvetica').fontSize(10);
    doc.text(`Payment Method: ${order.payment_method?.toUpperCase() || 'CASH'}`, 50, doc.y);
    doc.text(`Payment Status: ${order.payment_status?.toUpperCase() || 'PENDING'}`, 50, doc.y);
    doc.moveDown();

    // Footer
    doc.fontSize(8).text('Thank you for your business!', { align: 'center' });
    doc.text('www.gofreshco.com', { align: 'center' });

    // Finalize PDF
    doc.end();
  } catch (error) {
    next(error);
  }
};
