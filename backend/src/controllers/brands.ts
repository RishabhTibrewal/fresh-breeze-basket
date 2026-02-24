import { Request, Response } from 'express';
import { ApiError } from '../middleware/error';
import { BrandService } from '../services/shared/BrandService';

// Get all brands
export const getBrands = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const { is_active, search } = req.query;

    const brandService = new BrandService(req.companyId);
    const brands = await brandService.getBrands({
      is_active: is_active === 'true' ? true : is_active === 'false' ? false : undefined,
      search: search as string | undefined,
    });

    res.status(200).json({
      success: true,
      data: brands,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.statusCode,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'An unexpected error occurred while fetching brands',
          code: 500,
        },
      });
    }
  }
};

// Get active brands only
export const getActiveBrands = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const brandService = new BrandService(req.companyId);
    const brands = await brandService.getBrands({ is_active: true });

    res.status(200).json({
      success: true,
      data: brands,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.statusCode,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'An unexpected error occurred while fetching active brands',
          code: 500,
        },
      });
    }
  }
};

// Get single brand by ID
export const getBrandById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const brandService = new BrandService(req.companyId);
    const brand = await brandService.getBrandById(id);

    res.status(200).json({
      success: true,
      data: brand,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.statusCode,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'An unexpected error occurred while fetching brand',
          code: 500,
        },
      });
    }
  }
};

// Create a new brand (admin/sales only)
export const createBrand = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const { name, slug, legal_name, logo_url, is_active } = req.body;

    if (!name || name.trim() === '') {
      throw new ApiError(400, 'Brand name is required');
    }

    const brandService = new BrandService(req.companyId);
    const brand = await brandService.createBrand({
      name,
      slug,
      legal_name,
      logo_url,
      is_active,
    });

    res.status(201).json({
      success: true,
      data: brand,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.statusCode,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'An unexpected error occurred while creating brand',
          code: 500,
        },
      });
    }
  }
};

// Update a brand (admin/sales only)
export const updateBrand = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const { name, slug, legal_name, logo_url, is_active } = req.body;

    const brandService = new BrandService(req.companyId);
    const brand = await brandService.updateBrand(id, {
      name,
      slug,
      legal_name,
      logo_url,
      is_active,
    });

    res.status(200).json({
      success: true,
      data: brand,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.statusCode,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'An unexpected error occurred while updating brand',
          code: 500,
        },
      });
    }
  }
};

// Delete a brand (admin only)
export const deleteBrand = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { force } = req.query;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const brandService = new BrandService(req.companyId);
    await brandService.deleteBrand(id, force === 'true');

    res.status(200).json({
      success: true,
      message: 'Brand deleted successfully',
    });
  } catch (error) {
    if (error instanceof ApiError) {
      // If it's a soft delete (is_active = false), return success with message
      if (error.statusCode === 400 && error.message.includes('deactivated')) {
        res.status(200).json({
          success: true,
          message: error.message,
        });
      } else {
        res.status(error.statusCode).json({
          success: false,
          error: {
            message: error.message,
            code: error.statusCode,
          },
        });
      }
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'An unexpected error occurred while deleting brand',
          code: 500,
        },
      });
    }
  }
};

// Get all products/variants for a brand
export const getBrandProducts = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const brandService = new BrandService(req.companyId);
    const products = await brandService.getBrandProducts(id);

    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.statusCode,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'An unexpected error occurred while fetching brand products',
          code: 500,
        },
      });
    }
  }
};

