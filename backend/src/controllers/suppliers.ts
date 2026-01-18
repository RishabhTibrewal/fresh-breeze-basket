import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { ApiError, ValidationError } from '../middleware/error';

/**
 * Create a new supplier
 */
export const createSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      supplier_code,
      name,
      contact_name,
      email,
      phone,
      address,
      city,
      state,
      country,
      postal_code,
      tax_id,
      payment_terms,
      notes,
      bank_accounts
    } = req.body;

    if (!name) {
      throw new ValidationError('Supplier name is required');
    }

    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    // Create supplier
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .insert({
        supplier_code,
        name,
        contact_name,
        email,
        phone,
        address,
        city,
        state,
        country,
        postal_code,
        tax_id,
        payment_terms,
        notes,
        created_by: userId,
        is_active: true
      })
      .select()
      .single();

    if (supplierError) {
      console.error('Error creating supplier:', supplierError);
      throw new ApiError(500, `Failed to create supplier: ${supplierError.message}`);
    }

    // Add bank accounts if provided
    if (bank_accounts && Array.isArray(bank_accounts) && bank_accounts.length > 0) {
      const bankAccountsData = bank_accounts.map((account: any) => ({
        supplier_id: supplier.id,
        bank_name: account.bank_name,
        account_number: account.account_number,
        ifsc_code: account.ifsc_code,
        account_holder_name: account.account_holder_name,
        is_primary: account.is_primary || false
      }));

      const { error: bankError } = await supabase
        .from('supplier_bank_accounts')
        .insert(bankAccountsData);

      if (bankError) {
        console.error('Error creating bank accounts:', bankError);
        // Don't fail the whole operation, just log the error
      }
    }

    // Fetch supplier with bank accounts
    const { data: supplierWithBanks, error: fetchError } = await supabase
      .from('suppliers')
      .select(`
        *,
        supplier_bank_accounts (*)
      `)
      .eq('id', supplier.id)
      .single();

    if (fetchError) {
      console.error('Error fetching supplier with banks:', fetchError);
    }

    res.status(201).json({
      success: true,
      data: supplierWithBanks || supplier
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all suppliers with optional filters
 */
export const getSuppliers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { is_active, search } = req.query;

    let query = supabase
      .from('suppliers')
      .select(`
        *,
        supplier_bank_accounts (*)
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,supplier_code.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching suppliers:', error);
      throw new ApiError(500, 'Failed to fetch suppliers');
    }

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get supplier by ID
 */
export const getSupplierById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const { data: supplier, error } = await supabase
      .from('suppliers')
      .select(`
        *,
        supplier_bank_accounts (*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'Supplier not found');
      }
      console.error('Error fetching supplier:', error);
      throw new ApiError(500, 'Failed to fetch supplier');
    }

    res.json({
      success: true,
      data: supplier
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update supplier
 */
export const updateSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      supplier_code,
      name,
      contact_name,
      email,
      phone,
      address,
      city,
      state,
      country,
      postal_code,
      tax_id,
      payment_terms,
      notes,
      is_active,
      bank_accounts
    } = req.body;

    // Update supplier
    const { data: supplier, error: updateError } = await supabase
      .from('suppliers')
      .update({
        supplier_code,
        name,
        contact_name,
        email,
        phone,
        address,
        city,
        state,
        country,
        postal_code,
        tax_id,
        payment_terms,
        notes,
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        throw new ApiError(404, 'Supplier not found');
      }
      console.error('Error updating supplier:', updateError);
      throw new ApiError(500, 'Failed to update supplier');
    }

    // Update bank accounts if provided
    if (bank_accounts && Array.isArray(bank_accounts)) {
      // Delete existing bank accounts
      await supabase
        .from('supplier_bank_accounts')
        .delete()
        .eq('supplier_id', id);

      // Insert new bank accounts
      if (bank_accounts.length > 0) {
        const bankAccountsData = bank_accounts.map((account: any) => ({
          supplier_id: id,
          bank_name: account.bank_name,
          account_number: account.account_number,
          ifsc_code: account.ifsc_code,
          account_holder_name: account.account_holder_name,
          is_primary: account.is_primary || false
        }));

        const { error: bankError } = await supabase
          .from('supplier_bank_accounts')
          .insert(bankAccountsData);

        if (bankError) {
          console.error('Error updating bank accounts:', bankError);
          // Don't fail the whole operation
        }
      }
    }

    // Fetch supplier with bank accounts
    const { data: supplierWithBanks, error: fetchError } = await supabase
      .from('suppliers')
      .select(`
        *,
        supplier_bank_accounts (*)
      `)
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching supplier with banks:', fetchError);
    }

    res.json({
      success: true,
      data: supplierWithBanks || supplier
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete supplier (soft delete by setting is_active = false)
 */
export const deleteSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const { data: supplier, error } = await supabase
      .from('suppliers')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'Supplier not found');
      }
      console.error('Error deleting supplier:', error);
      throw new ApiError(500, 'Failed to delete supplier');
    }

    res.json({
      success: true,
      message: 'Supplier deleted successfully',
      data: supplier
    });
  } catch (error) {
    next(error);
  }
};
