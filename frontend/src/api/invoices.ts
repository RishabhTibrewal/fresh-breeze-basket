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
    
    // Create an invisible container for html2pdf to parse
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;
    tempDiv.style.position = 'absolute';
    tempDiv.style.top = '-9999px';
    document.body.appendChild(tempDiv);

    const opt = {
      margin:       10,
      filename:     `invoice-${orderId.substring(0, 8)}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };

    // Render and download as PDF
    await html2pdf().from(tempDiv).set(opt).save();

    // Clean up
    document.body.removeChild(tempDiv);
  },

  /**
   * Print POS invoice
   */
  async printPOSInvoice(orderId: string): Promise<void> {
    const html = await this.getPOSInvoice(orderId);
    this.printHTML(html);
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
   * Helper to print HTML content using a hidden iframe.
   * Hardened to prevents "disconnected port" errors common with browser extensions.
   */
  async printHTML(html: string): Promise<void> {
    const iframe = document.createElement('iframe');
    
    // Position it off-screen instead of display:none for better browser support
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
      
      const printAndCleanup = () => {
        if (!iframe.contentWindow) return;
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        
        // Increase cleanup timeout to prevent "disconnected port" errors from browser extensions
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 5000); 
      };

      // Ensure doc is loaded before printing
      if (doc.readyState === 'complete') {
        printAndCleanup();
      } else {
        iframe.onload = printAndCleanup;
      }
    }
  }
};
