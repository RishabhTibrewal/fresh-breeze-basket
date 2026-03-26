import { Request, Response, NextFunction } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { ApiError } from '../middleware/error';

const db = supabaseAdmin || supabase;

/**
 * Remove orphan party rows after relinking if no customer/supplier references remain.
 */
async function cleanupOrphanParty(partyId: string | null | undefined, companyId: string) {
  if (!partyId) return;

  try {
    const [{ count: customerCount, error: customerCountError }, { count: supplierCount, error: supplierCountError }] =
      await Promise.all([
        db
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('party_id', partyId),
        db
          .from('suppliers')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('party_id', partyId),
      ]);

    if (customerCountError) {
      console.error('Error counting customers for orphan party cleanup:', customerCountError);
      return;
    }

    if (supplierCountError) {
      console.error('Error counting suppliers for orphan party cleanup:', supplierCountError);
      return;
    }

    if ((customerCount || 0) === 0 && (supplierCount || 0) === 0) {
      const { error: deleteError } = await db
        .from('contact_parties')
        .delete()
        .eq('id', partyId)
        .eq('company_id', companyId);

      if (deleteError) {
        console.error('Error deleting orphan contact_party:', deleteError);
      }
    }
  } catch (error) {
    console.error('Unexpected error cleaning up orphan contact_party:', error);
  }
}

export const partyController = {
  // GET /parties
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.companyId) {
        throw new ApiError(400, 'Company context is required');
      }

      const { is_customer, is_supplier, q, limit = '50', offset = '0' } = req.query;

      let query = db
        .from('contact_parties')
        .select('*')
        .eq('company_id', req.companyId)
        .order('created_at', { ascending: false })
        .range(parseInt(offset as string, 10), parseInt(offset as string, 10) + parseInt(limit as string, 10) - 1);

      if (is_customer !== undefined) {
        query = query.eq('is_customer', String(is_customer) === 'true');
      }

      if (is_supplier !== undefined) {
        query = query.eq('is_supplier', String(is_supplier) === 'true');
      }

      if (q && typeof q === 'string' && q.trim() !== '') {
        const term = q.trim();
        query = query.or(
          `name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching contact_parties:', error);
        throw new ApiError(500, 'Failed to fetch parties');
      }

      res.json({ success: true, data: data || [] });
    } catch (err) {
      next(err);
    }
  },

  // GET /parties/:id
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!req.companyId) {
        throw new ApiError(400, 'Company context is required');
      }

      const { data, error } = await db
        .from('contact_parties')
        .select('*')
        .eq('id', id)
        .eq('company_id', req.companyId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching party:', error);
        throw new ApiError(500, 'Failed to fetch party');
      }

      if (!data) {
        throw new ApiError(404, 'Party not found');
      }

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  // POST /parties
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, phone, is_customer, is_supplier, notes } = req.body;

      if (!req.companyId) {
        throw new ApiError(400, 'Company context is required');
      }

      if (!name || typeof name !== 'string') {
        throw new ApiError(400, 'Party name is required');
      }

      const { data, error } = await db
        .from('contact_parties')
        .insert({
          company_id: req.companyId,
          name,
          email,
          phone,
          is_customer: !!is_customer,
          is_supplier: !!is_supplier,
          notes
        })
        .select('*')
        .single();

      if (error) {
        console.error('Error creating party:', error);
        throw new ApiError(500, `Failed to create party: ${error.message}`);
      }

      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  // PATCH /parties/:id/link-customer
  async linkCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { customer_id } = req.body as { customer_id?: string };

      if (!req.companyId) {
        throw new ApiError(400, 'Company context is required');
      }

      if (!customer_id) {
        throw new ApiError(400, 'customer_id is required');
      }

      // Ensure party exists and belongs to company
      const { data: party, error: partyError } = await db
        .from('contact_parties')
        .select('*')
        .eq('id', id)
        .eq('company_id', req.companyId)
        .maybeSingle();

      if (partyError) {
        console.error('Error fetching party for link-customer:', partyError);
        throw new ApiError(500, 'Failed to fetch party');
      }

      if (!party) {
        throw new ApiError(404, 'Party not found');
      }

      // Ensure customer exists and belongs to company
      const { data: customer, error: customerError } = await db
        .from('customers')
        .select('*')
        .eq('id', customer_id)
        .eq('company_id', req.companyId)
        .maybeSingle();

      if (customerError) {
        console.error('Error fetching customer for link-customer:', customerError);
        throw new ApiError(500, 'Failed to fetch customer');
      }

      if (!customer) {
        throw new ApiError(404, 'Customer not found');
      }
      const oldPartyId = (customer as any).party_id as string | null;

      const { error: updateError } = await db
        .from('customers')
        .update({ party_id: id })
        .eq('id', customer_id)
        .eq('company_id', req.companyId);

      if (updateError) {
        console.error('Error linking customer to party:', updateError);
        throw new ApiError(500, 'Failed to link customer to party');
      }

      // Mark party as customer
      const { data: updatedParty, error: flagError } = await db
        .from('contact_parties')
        .update({ is_customer: true })
        .eq('id', id)
        .eq('company_id', req.companyId)
        .select('*')
        .single();

      if (flagError) {
        console.error('Error updating party is_customer flag:', flagError);
        throw new ApiError(500, 'Failed to update party flags');
      }

      if (oldPartyId && oldPartyId !== id) {
        await cleanupOrphanParty(oldPartyId, req.companyId);
      }

      res.json({ success: true, data: updatedParty });
    } catch (err) {
      next(err);
    }
  },

  // PATCH /parties/:id/link-supplier
  async linkSupplier(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { supplier_id } = req.body as { supplier_id?: string };

      if (!req.companyId) {
        throw new ApiError(400, 'Company context is required');
      }

      if (!supplier_id) {
        throw new ApiError(400, 'supplier_id is required');
      }

      const { data: party, error: partyError } = await db
        .from('contact_parties')
        .select('*')
        .eq('id', id)
        .eq('company_id', req.companyId)
        .maybeSingle();

      if (partyError) {
        console.error('Error fetching party for link-supplier:', partyError);
        throw new ApiError(500, 'Failed to fetch party');
      }

      if (!party) {
        throw new ApiError(404, 'Party not found');
      }

      const { data: supplier, error: supplierError } = await db
        .from('suppliers')
        .select('*')
        .eq('id', supplier_id)
        .eq('company_id', req.companyId)
        .maybeSingle();

      if (supplierError) {
        console.error('Error fetching supplier for link-supplier:', supplierError);
        throw new ApiError(500, 'Failed to fetch supplier');
      }

      if (!supplier) {
        throw new ApiError(404, 'Supplier not found');
      }
      const oldPartyId = (supplier as any).party_id as string | null;

      const { error: updateError } = await db
        .from('suppliers')
        .update({ party_id: id })
        .eq('id', supplier_id)
        .eq('company_id', req.companyId);

      if (updateError) {
        console.error('Error linking supplier to party:', updateError);
        throw new ApiError(500, 'Failed to link supplier to party');
      }

      const { data: updatedParty, error: flagError } = await db
        .from('contact_parties')
        .update({ is_supplier: true })
        .eq('id', id)
        .eq('company_id', req.companyId)
        .select('*')
        .single();

      if (flagError) {
        console.error('Error updating party is_supplier flag:', flagError);
        throw new ApiError(500, 'Failed to update party flags');
      }

      if (oldPartyId && oldPartyId !== id) {
        await cleanupOrphanParty(oldPartyId, req.companyId);
      }

      res.json({ success: true, data: updatedParty });
    } catch (err) {
      next(err);
    }
  },

  // GET /parties/:id/ledger
  async getLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!req.companyId) {
        throw new ApiError(400, 'Company context is required');
      }

      // Ensure party exists and belongs to company
      const { data: party, error: partyError } = await db
        .from('contact_parties')
        .select('*')
        .eq('id', id)
        .eq('company_id', req.companyId)
        .maybeSingle();

      if (partyError) {
        console.error('Error fetching party for ledger:', partyError);
        throw new ApiError(500, 'Failed to fetch party');
      }

      if (!party) {
        throw new ApiError(404, 'Party not found');
      }

      const { data: entries, error: ledgerError } = await db
        .from('party_ledger')
        .select('*')
        .eq('party_id', id)
        .eq('company_id', req.companyId)
        .order('doc_date', { ascending: false });

      if (ledgerError) {
        console.error('Error fetching party ledger:', ledgerError);
        throw new ApiError(500, 'Failed to fetch party ledger');
      }

      const list = entries || [];

      const receivables = list.filter((e) => e.ledger_side === 'receivable');
      const payables = list.filter((e) => e.ledger_side === 'payable');

      const totalReceivable = receivables.reduce((sum, e) => {
        const amount = Number(e.amount) || 0;
        // Treat incoming payments and credit notes as reducing receivables
        if (e.doc_type === 'payment_in' || e.doc_type === 'credit_note') {
          return sum - amount;
        }
        return sum + amount;
      }, 0);

      const totalPayable = payables.reduce((sum, e) => {
        const amount = Number(e.amount) || 0;
        // Treat outgoing payments as reducing payables
        if (e.doc_type === 'payment_out') {
          return sum - amount;
        }
        return sum + amount;
      }, 0);

      const netPosition = totalReceivable - totalPayable;

      res.json({
        success: true,
        data: {
          party,
          entries: list,
          totals: {
            totalReceivable,
            totalPayable,
            netPosition
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }
};

