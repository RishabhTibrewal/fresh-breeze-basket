import apiClient from '@/lib/apiClient';

export interface UploadResponse {
  success: boolean;
  url: string;
  fileName: string;
  fileType?: string;
}

export interface ProductImageUploadResponse {
  success: boolean;
  images: Array<{
    id: string;
    url: string;
    fileName: string;
  }>;
  count: number;
}

export const uploadsService = {
  /**
   * Upload category image
   */
  async uploadCategoryImage(categoryId: string, file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('image', file);

    const { data } = await apiClient.post<{ success: boolean; url: string; fileName: string }>(
      `/uploads/category/${categoryId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return {
      success: data.success,
      url: data.url,
      fileName: data.fileName,
    };
  },

  /**
   * Upload single product image
   */
  async uploadProductImage(productId: string, file: File, isPrimary: boolean = false): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('images', file);
    formData.append('isPrimary', isPrimary.toString());

    const { data } = await apiClient.post<ProductImageUploadResponse>(
      `/uploads/product/${productId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return {
      success: data.success,
      url: data.images[0]?.url || '',
      fileName: data.images[0]?.fileName || '',
    };
  },

  /**
   * Upload multiple product images
   */
  async uploadProductImages(productId: string, files: File[], isPrimary: boolean = false): Promise<ProductImageUploadResponse> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('images', file);
    });
    formData.append('isPrimary', isPrimary.toString());

    const { data } = await apiClient.post<ProductImageUploadResponse>(
      `/uploads/product/${productId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return data;
  },

  /**
   * Upload purchase invoice file
   */
  async uploadPurchaseInvoice(purchaseInvoiceId: string, file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('invoiceFile', file);
    formData.append('purchaseInvoiceId', purchaseInvoiceId);

    const { data } = await apiClient.post<{ success: boolean; url: string; fileName: string; fileType: string }>(
      `/uploads/purchase-invoice`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return {
      success: data.success,
      url: data.url,
      fileName: data.fileName,
      fileType: data.fileType,
    };
  },
};
