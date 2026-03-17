import { Request, Response, NextFunction } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { ApiError, ValidationError } from '../middleware/error';

/**
 * Generate supplier code (e.g., SUP-2024-001)
 */
const generateSupplierCode = async (companyId: string): Promise<string> => {
  const year = new Date().getFullYear();
  
  const adminClient = supabaseAdmin || supabase;
  const { data: latestSupplier, error } = await adminClient
    .from('suppliers')
    .select('supplier_code')
    .eq('company_id', companyId)
    .ilike('supplier_code', `SUP-${year}-%`)
    .order('supplier_code', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching latest supplier code:', error);
  }

  let sequence = 1;
  if (latestSupplier && latestSupplier.supplier_code) {
    const parts = latestSupplier.supplier_code.split('-');
    if (parts.length === 3) {
      const parsedSequence = parseInt(parts[2], 10);
      if (!isNaN(parsedSequence) && parsedSequence > 0) {
        sequence = parsedSequence + 1;
      }
    }
  }

  return `SUP-${year}-${sequence.toString().padStart(3, '0')}`;
};

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
      gst_no,
      payment_terms,
      notes,
      opening_balance,
      closing_balance,
      vendor_name,
      trade_name,
      legal_name,
      udyam_registration_number,
      pan_number,
      bank_accounts
    } = req.body;

    if (!name) {
      throw new ValidationError('Supplier name is required');
    }

    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    if (!req.companyId) {
      throw new ValidationError('Company context is required');
    }

    // Auto-generate supplier code if not provided
    const finalSupplierCode = supplier_code || await generateSupplierCode(req.companyId);

    const db = supabaseAdmin || supabase;

    // Create supplier
    const { data: supplier, error: supplierError } = await db
      .from('suppliers')
      .insert({
        supplier_code: finalSupplierCode,
        name,
        contact_name,
        email,
        phone,
        address,
        city,
        state,
        country,
        postal_code,
        gst_no,
        payment_terms,
        notes,
        opening_balance: opening_balance || 0,
        closing_balance: closing_balance || 0,
        vendor_name,
        trade_name,
        legal_name,
        udyam_registration_number,
        pan_number,
        created_by: userId,
        is_active: true,
        company_id: req.companyId
      })
      .select()
      .single();

    if (supplierError) {
      console.error('Error creating supplier:', supplierError);
      throw new ApiError(500, `Failed to create supplier: ${supplierError.message}`);
    }

    // Ensure supplier has a contact_party (business partner)
    try {
      if (req.companyId && supplier) {
        // Try to reuse existing party by (company_id, name) to avoid duplicates
        const { data: existingParty, error: partyLookupError } = await db
          .from('contact_parties')
          .select('*')
          .eq('company_id', req.companyId)
          .eq('name', name)
          .maybeSingle();

        if (partyLookupError) {
          console.error('Error looking up existing contact_party for supplier:', partyLookupError);
        }

        let partyId = existingParty?.id;

        if (!partyId) {
          const { data: newParty, error: partyError } = await db
            .from('contact_parties')
            .insert({
              company_id: req.companyId,
              name,
              email,
              phone,
              is_supplier: true
            })
            .select('*')
            .single();

          if (partyError) {
            console.error('Error creating contact_party for supplier:', partyError);
          } else {
            partyId = newParty.id;
          }
        } else if (!existingParty.is_supplier) {
          const { error: flagError } = await db
            .from('contact_parties')
            .update({ is_supplier: true })
            .eq('id', partyId)
            .eq('company_id', req.companyId);

          if (flagError) {
            console.error('Error updating contact_party is_supplier flag:', flagError);
          }
        }

        if (partyId) {
          const { error: linkError } = await db
            .from('suppliers')
            .update({ party_id: partyId })
            .eq('id', supplier.id)
            .eq('company_id', req.companyId);

          if (linkError) {
            console.error('Error linking supplier to contact_party:', linkError);
          } else {
            (supplier as any).party_id = partyId;
          }
        }
      }
    } catch (partyError) {
      console.error('Non-fatal error ensuring supplier contact_party:', partyError);
    }

    // Add bank accounts if provided
    if (bank_accounts && Array.isArray(bank_accounts) && bank_accounts.length > 0) {
      const bankAccountsData = bank_accounts.map((account: any) => ({
        supplier_id: supplier.id,
        bank_name: account.bank_name,
        account_number: account.account_number,
        ifsc_code: account.ifsc_code,
        account_holder_name: account.account_holder_name,
        bank_address: account.bank_address,
        city: account.city,
        state: account.state,
        country: account.country,
        postal_code: account.postal_code,
        pin_code: account.pin_code,
        is_primary: account.is_primary || false,
        company_id: req.companyId
      }));

      const { error: bankError } = await db
        .from('supplier_bank_accounts')
        .insert(bankAccountsData);

      if (bankError) {
        console.error('Error creating bank accounts:', bankError);
        // Don't fail the whole operation, just log the error
      }
    }

    // Fetch supplier with bank accounts
    const { data: supplierWithBanks, error: fetchError } = await (supabaseAdmin || supabase)
      .from('suppliers')
      .select(`
        *,
        supplier_bank_accounts (*)
      `)
      .eq('id', supplier.id)
      .eq('company_id', req.companyId)
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
 * Create a customer from an existing supplier using the same contact_party
 */
export const createLinkedCustomerFromSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const db = supabaseAdmin || supabase;
    const currentUserId = req.user?.id || null;

    const { data: supplier, error: supplierError } = await db
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (supplierError || !supplier) {
      throw new ApiError(404, 'Supplier not found');
    }

    let partyId: string | null = supplier.party_id || null;

    // Ensure party exists for this supplier
    if (!partyId) {
      const { data: party, error: partyError } = await db
        .from('contact_parties')
        .insert({
          company_id: req.companyId,
          name: supplier.name,
          email: supplier.email,
          phone: supplier.phone,
          is_supplier: true
        })
        .select('*')
        .single();

      if (partyError || !party) {
        throw new ApiError(500, `Failed to create contact party: ${partyError?.message || 'Unknown error'}`);
      }

      partyId = party.id;

      await db
        .from('suppliers')
        .update({ party_id: partyId })
        .eq('id', id)
        .eq('company_id', req.companyId);
    }

    // Already has customer counterpart?
    const { data: existingCustomer } = await db
      .from('customers')
      .select('*')
      .eq('company_id', req.companyId)
      .eq('party_id', partyId)
      .maybeSingle();

    if (existingCustomer) {
      return res.status(200).json({
        success: true,
        alreadyExists: true,
        data: existingCustomer
      });
    }

    const { data: newCustomer, error: customerError } = await db
      .from('customers')
      .insert({
        name: supplier.name,
        email: supplier.email,
        phone: supplier.phone,
        trn_number: supplier.gst_no,
        credit_period_days: 0,
        credit_limit: 0,
        current_credit: 0,
        sales_executive_id: currentUserId,
        user_id: null,
        company_id: req.companyId,
        party_id: partyId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (customerError || !newCustomer) {
      throw new ApiError(500, `Failed to create customer: ${customerError?.message || 'Unknown error'}`);
    }

    await db
      .from('contact_parties')
      .update({ is_customer: true })
      .eq('id', partyId)
      .eq('company_id', req.companyId);

    return res.status(201).json({
      success: true,
      data: newCustomer
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

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    let query = (supabaseAdmin || supabase)
      .from('suppliers')
      .select(`
        *,
        supplier_bank_accounts (*),
        party:contact_parties(
          id,
          name,
          is_customer,
          is_supplier
        )
      `)
      .eq('company_id', req.companyId)
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

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const { data: supplier, error } = await (supabaseAdmin || supabase)
      .from('suppliers')
      .select(`
        *,
        supplier_bank_accounts (*)
      `)
      .eq('id', id)
      .eq('company_id', req.companyId)
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
      gst_no,
      payment_terms,
      notes,
      opening_balance,
      closing_balance,
      vendor_name,
      trade_name,
      legal_name,
      udyam_registration_number,
      pan_number,
      is_active,
      bank_accounts
    } = req.body;

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    // Update supplier
    const { data: supplier, error: updateError } = await (supabaseAdmin || supabase)
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
        gst_no,
        payment_terms,
        notes,
        opening_balance,
        closing_balance,
        vendor_name,
        trade_name,
        legal_name,
        udyam_registration_number,
        pan_number,
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('company_id', req.companyId)
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
      await (supabaseAdmin || supabase)
        .from('supplier_bank_accounts')
        .delete()
        .eq('supplier_id', id)
        .eq('company_id', req.companyId);

      // Insert new bank accounts
      if (bank_accounts.length > 0) {
        const bankAccountsData = bank_accounts.map((account: any) => ({
          supplier_id: id,
          bank_name: account.bank_name,
          account_number: account.account_number,
          ifsc_code: account.ifsc_code,
          account_holder_name: account.account_holder_name,
          bank_address: account.bank_address,
          city: account.city,
          state: account.state,
          country: account.country,
          postal_code: account.postal_code,
          is_primary: account.is_primary || false,
          company_id: req.companyId
        }));

        const { error: bankError } = await (supabaseAdmin || supabase)
          .from('supplier_bank_accounts')
          .insert(bankAccountsData);

        if (bankError) {
          console.error('Error updating bank accounts:', bankError);
          // Don't fail the whole operation
        }
      }
    }

    // Fetch supplier with bank accounts
    const { data: supplierWithBanks, error: fetchError } = await (supabaseAdmin || supabase)
      .from('suppliers')
      .select(`
        *,
        supplier_bank_accounts (*)
      `)
      .eq('id', id)
      .eq('company_id', req.companyId)
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

    if (!req.companyId) {
      throw new ApiError(400, 'Company context is required');
    }

    const { data: supplier, error } = await (supabaseAdmin || supabase)
      .from('suppliers')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('company_id', req.companyId)
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
