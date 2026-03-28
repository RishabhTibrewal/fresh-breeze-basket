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
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  },
};
