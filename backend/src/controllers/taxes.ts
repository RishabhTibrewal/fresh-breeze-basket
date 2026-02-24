import { Request, Response } from 'express';
import { ApiError } from '../middleware/error';
import { TaxService } from '../services/shared/TaxService';
import { supabaseAdmin } from '../lib/supabase';

// Get all taxes
export const getTaxes = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const { is_active } = req.query;

    const taxService = new TaxService(req.companyId);
    
    // If is_active is specified, filter accordingly
    if (is_active === 'true') {
      const taxes = await taxService.getActiveTaxes();
      return res.status(200).json({
        success: true,
        data: taxes,
      });
    }

    // Get all taxes (active and inactive)
    const { data, error } = await supabaseAdmin
      .from('taxes')
      .select('*')
      .eq('company_id', req.companyId)
      .order('name');

    if (error) {
      throw new ApiError(500, `Failed to fetch taxes: ${error.message}`);
    }

    res.status(200).json({
      success: true,
      data: data || [],
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
          message: 'An unexpected error occurred while fetching taxes',
          code: 500,
        },
      });
    }
  }
};

// Get active taxes only
export const getActiveTaxes = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const taxService = new TaxService(req.companyId);
    const taxes = await taxService.getActiveTaxes();

    res.status(200).json({
      success: true,
      data: taxes,
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
          message: 'An unexpected error occurred while fetching active taxes',
          code: 500,
        },
      });
    }
  }
};

// Get single tax by ID
export const getTaxById = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const { id } = req.params;

    const { data: tax, error } = await supabaseAdmin
      .from('taxes')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (error || !tax) {
      throw new ApiError(
        404,
        `Tax with ID '${id}' not found or does not belong to your company`
      );
    }

    res.status(200).json({
      success: true,
      data: tax,
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
          message: 'An unexpected error occurred while fetching tax',
          code: 500,
        },
      });
    }
  }
};

// Create a new tax
export const createTax = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const { name, code, rate, is_active } = req.body;

    if (!name || !code || rate === undefined) {
      throw new ApiError(400, 'Name, code, and rate are required');
    }

    if (rate < 0 || rate > 100) {
      throw new ApiError(400, 'Rate must be between 0 and 100');
    }

    const taxService = new TaxService(req.companyId);
    const tax = await taxService.createTax({
      name,
      code,
      rate: parseFloat(rate),
      is_active: is_active !== undefined ? is_active : true,
    });

    res.status(201).json({
      success: true,
      data: tax,
    });
  } catch (error: any) {
    console.error('Error creating tax:', error);
    console.error('Request body:', req.body);
    console.error('Company ID:', req.companyId);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.statusCode,
        },
      });
    } else if (error.statusCode === 409 || error.isDuplicate) {
      // Handle duplicate key constraint violation
      res.status(409).json({
        success: false,
        error: {
          message: error.message || `A tax with code "${req.body.code}" already exists for this company`,
          code: 409,
        },
      });
    } else {
      // Log the full error for debugging
      console.error('Full error details:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      
      res.status(500).json({
        success: false,
        error: {
          message: error.message || 'An unexpected error occurred while creating tax',
          code: 500,
          details: error.details || error.hint || undefined,
        },
      });
    }
  }
};

// Update an existing tax
export const updateTax = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const { id } = req.params;
    const { name, code, rate, is_active } = req.body;

    if (rate !== undefined && (rate < 0 || rate > 100)) {
      throw new ApiError(400, 'Rate must be between 0 and 100');
    }

    const taxService = new TaxService(req.companyId);
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (code !== undefined) updateData.code = code;
    if (rate !== undefined) updateData.rate = parseFloat(rate);
    if (is_active !== undefined) updateData.is_active = is_active;

    const tax = await taxService.updateTax(id, updateData);

    res.status(200).json({
      success: true,
      data: tax,
    });
  } catch (error: any) {
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
          message: error.message || 'An unexpected error occurred while updating tax',
          code: 500,
        },
      });
    }
  }
};

// Delete a tax
export const deleteTax = async (req: Request, res: Response) => {
  try {
    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const { id } = req.params;

    const taxService = new TaxService(req.companyId);
    await taxService.deleteTax(id);

    res.status(200).json({
      success: true,
      message: 'Tax deleted successfully',
    });
  } catch (error: any) {
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
          message: error.message || 'An unexpected error occurred while deleting tax',
          code: 500,
        },
      });
    }
  }
};

