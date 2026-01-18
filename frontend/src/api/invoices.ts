import apiClient from '@/lib/apiClient';

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
   * Get customer bill (PDF)
   */
  async getCustomerBill(orderId: string): Promise<Blob> {
    const response = await apiClient.get(`/invoices/customer/${orderId}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Download customer bill
   */
  async downloadCustomerBill(orderId: string): Promise<void> {
    const blob = await this.getCustomerBill(orderId);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoice-${orderId.substring(0, 8)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
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
