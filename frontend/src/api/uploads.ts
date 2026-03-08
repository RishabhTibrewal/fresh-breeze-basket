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

    // Content-Type header is automatically removed by apiClient interceptor for FormData
    const { data } = await apiClient.post<{ success: boolean; url: string; fileName: string }>(
      `/uploads/category/${categoryId}`,
      formData
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

    console.log('[Upload Product Image] Sending request:', {
      productId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      isPrimary
    });

    // Content-Type header is automatically removed by apiClient interceptor for FormData
    const { data } = await apiClient.post<ProductImageUploadResponse>(
      `/uploads/product/${productId}`,
      formData
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

    // Content-Type header is automatically removed by apiClient interceptor for FormData
    const { data } = await apiClient.post<ProductImageUploadResponse>(
      `/uploads/product/${productId}`,
      formData
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

    // Content-Type header is automatically removed by apiClient interceptor for FormData
    const { data } = await apiClient.post<{ success: boolean; url: string; fileName: string; fileType: string }>(
      `/uploads/purchase-invoice`,
      formData
    );

    return {
      success: data.success,
      url: data.url,
      fileName: data.fileName,
      fileType: data.fileType,
    };
  },

  /**
   * Upload brand image (generic image upload)
   * Returns just the URL string for convenience
   */
  async uploadImage(file: File, folder: string = 'brands'): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    // Content-Type header is automatically removed by apiClient interceptor for FormData
    const { data } = await apiClient.post<{ success: boolean; url: string; fileName: string }>(
      `/uploads/file`,
      formData
    );

    if (!data.success || !data.url) {
      throw new Error('Failed to upload image');
    }

    return data.url;
  },

  /**
   * Upload brand image (with brandId for better organization)
   */
  async uploadBrandImage(brandId: string, file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('image', file);

    console.log('[Upload Brand Image] Sending request:', {
      brandId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    // Content-Type header is automatically removed by apiClient interceptor for FormData
    const { data } = await apiClient.post<{ success: boolean; url: string; fileName: string }>(
      `/uploads/brand/${brandId}`,
      formData
    );

    return {
      success: data.success,
      url: data.url,
      fileName: data.fileName,
    };
  },
};
