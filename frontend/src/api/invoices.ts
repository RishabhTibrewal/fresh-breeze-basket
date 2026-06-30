import apiClient from '@/lib/apiClient';
import html2pdf from 'html2pdf.js';

export const invoicesService = {
  /**
   * Get POS invoice (HTML)
   */
  async getPOSInvoice(orderId: string): Promise<string> {
    const response = await apiClient.get(`/invoices/pos/${orderId}`, {
      responseType: 'text',
    });
    return response.data;
  },

  /**
   * Get customer bill HTML text
   */
  async getCustomerBillHTML(orderId: string): Promise<string> {
    const response = await apiClient.get(`/invoices/customer/${orderId}`, {
      responseType: 'text',
    });
    return response.data;
  },

  /**
   * Download customer bill as PDF
   */
  async downloadCustomerBill(orderId: string): Promise<void> {
    const htmlString = await this.getCustomerBillHTML(orderId);
    
    // Create a hidden iframe to isolate styling and prevent global CSS leakage
    const iframe = document.createElement('iframe');
    
    Object.assign(iframe.style, {
      position: 'fixed',
      left: '-9999px',
      top: '0',
      width: '350px', // width of the thermal receipt
      height: '1500px', // initial height, will adjust to content scrollHeight
      border: '0',
      background: '#ffffff'
    });
    
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
      throw new Error('Could not access iframe document');
    }
    
    doc.open();
    doc.write(htmlString);
    doc.close();

    // Wait for document & styles to load completely
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
      if (doc.readyState === 'complete') {
        resolve();
      }
    });

    // Explicitly wait for any images in the iframe to load (e.g. logos)
    const images = doc.getElementsByTagName('img');
    const imagePromises = Array.from(images).map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    });
    await Promise.all(imagePromises);

    // Style cleanup and scoping to prevent leaks during cloning
    doc.body.classList.add('invoice-body');
    doc.body.style.backgroundColor = '#ffffff';
    doc.body.style.color = '#000000';

    const styles = doc.querySelectorAll('style');
    styles.forEach(style => {
      let css = style.textContent || '';
      // Replace global 'body' selector with '.invoice-body'
      css = css.replace(/\bbody\b/g, '.invoice-body');
      // Replace global '*' selector with '.invoice-body, .invoice-body *'
      css = css.replace(/\*\s*\{/g, '.invoice-body, .invoice-body * {');
      style.textContent = css;
      
      // Move style tags to body so html2pdf clones them
      doc.body.appendChild(style);
    });

    // Adjust height of iframe to fit content precisely
    if (doc.body) {
      iframe.style.height = `${doc.body.scrollHeight}px`;
    }

    const opt = {
      margin:       10,
      filename:     `invoice-${orderId.substring(0, 8)}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };

    try {
      // Render and download as PDF using the iframe's body to respect its scoped styles
      await html2pdf().from(doc.body).set(opt).save();
    } finally {
      // Clean up the iframe
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }
  },

  /**
   * Download detailed A4 invoice as PDF
   */
  async downloadDetailedInvoice(orderId: string): Promise<void> {
    const htmlString = await this.getPOSInvoice(orderId);
    
    // Create a hidden iframe to isolate styling and prevent global CSS leakage
    const iframe = document.createElement('iframe');
    
    Object.assign(iframe.style, {
      position: 'fixed',
      left: '-9999px',
      top: '0',
      width: '794px', // A4 page width (~210mm at 96 DPI)
      height: '1123px', // A4 page height (~297mm at 96 DPI)
      border: '0',
      background: '#ffffff'
    });
    
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
      throw new Error('Could not access iframe document');
    }
    
    doc.open();
    doc.write(htmlString);
    doc.close();

    // Wait for document & styles to load completely
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
      if (doc.readyState === 'complete') {
        resolve();
      }
    });

    // Explicitly wait for any images in the iframe to load
    const images = doc.getElementsByTagName('img');
    const imagePromises = Array.from(images).map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    });
    await Promise.all(imagePromises);

    // Style cleanup and scoping to prevent leaks during cloning
    doc.body.classList.add('invoice-body');
    doc.body.style.backgroundColor = '#ffffff';
    doc.body.style.color = '#000000';

    const styles = doc.querySelectorAll('style');
    styles.forEach(style => {
      let css = style.textContent || '';
      // Replace global 'body' selector with '.invoice-body'
      css = css.replace(/\bbody\b/g, '.invoice-body');
      // Replace global '*' selector with '.invoice-body, .invoice-body *'
      css = css.replace(/\*\s*\{/g, '.invoice-body, .invoice-body * {');
      style.textContent = css;
      
      // Move style tags to body so html2pdf clones them
      doc.body.appendChild(style);
    });

    // Add explicit overrides for A4 page layout (remove margins & shadows)
    const overrideStyle = doc.createElement('style');
    overrideStyle.textContent = `
      .invoice-body {
        background-color: #ffffff !important;
        background: #ffffff !important;
      }
      .invoice-body .page {
        margin: 0 auto !important;
        box-shadow: none !important;
      }
    `;
    doc.body.appendChild(overrideStyle);

    // Adjust height of iframe to fit content precisely
    if (doc.body) {
      iframe.style.height = `${doc.body.scrollHeight}px`;
    }

    const opt = {
      margin:       0, // borderless PDF since A4 margins are controlled inside CSS
      filename:     `invoice-${orderId.substring(0, 8)}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };

    try {
      // Render and download as PDF using the iframe's body to respect its scoped styles
      await html2pdf().from(doc.body).set(opt).save();
    } finally {
      // Clean up the iframe
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }
  },

  /**
   * Print POS invoice
   */
  async printPOSInvoice(orderId: string): Promise<void> {
    const html = await this.getPOSInvoice(orderId);
    this.printHTML(html);
  },

  /**
   * Print Daily or Session Thermal Report
   */
  async printThermalReport(params: {
    period: 'daily' | 'weekly' | 'monthly' | 'session';
    from_date?: string;
    to_date?: string;
    pos_session_id?: string;
    outlet_id?: string;
  }): Promise<void> {
    const response = await apiClient.get('/invoices/reports/thermal', {
      params,
      responseType: 'text',
    });
    await this.printHTML(response.data);
  },

  /**
   * Get Kitchen KOT (Thermal HTML)
   */
  async getKitchenKOTHTML(orderId: string): Promise<string> {
    const response = await apiClient.get(`/invoices/kot/kitchen/${orderId}`, {
      responseType: 'text',
    });
    return response.data;
  },

  async getKitchenKOTByTicketHTML(ticketId: string): Promise<string> {
    const response = await apiClient.get(`/invoices/kot/ticket/${ticketId}/kitchen`, {
      responseType: 'text',
    });
    return response.data;
  },

  /**
   * Get Customer KOT/Bill (Thermal HTML)
   */
  async getCustomerKOTHTML(orderId: string): Promise<string> {
    const response = await apiClient.get(`/invoices/kot/customer/${orderId}`, {
      responseType: 'text',
    });
    return response.data;
  },

  /**
   * Print unified party ledger statement in standard A4 format
   */
  async printPartyLedger(partyId: string, dateFrom?: string, dateTo?: string): Promise<void> {
    const params: any = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    const response = await apiClient.get(`/invoices/party/${partyId}/ledger/print`, {
      params,
      responseType: 'text',
    });
    await this.printHTML(response.data);
  },

  /**
   * Helper to print HTML content using a hidden iframe.
   * Hardened to prevents "disconnected port" errors common with browser extensions.
   */
  async printHTML(html: string): Promise<void> {
    const iframe = document.createElement('iframe');
    
    Object.assign(iframe.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '0',
      height: '0',
      border: '0',
      zIndex: '-1',
      visibility: 'hidden'
    });
    
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      
      let printed = false;
      const printAndCleanup = () => {
        if (printed) return;
        printed = true;
        if (!iframe.contentWindow) return;
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 5000); 
      };

      // Always prefer onload; fall back to immediate call if already complete
      iframe.onload = printAndCleanup;
      if (doc.readyState === 'complete') {
        printAndCleanup();
      }
    }
  }
};
