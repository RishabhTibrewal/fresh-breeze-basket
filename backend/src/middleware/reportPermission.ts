import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin, supabase } from '../config/supabase';
import { AuthorizationError } from './error';

// Use admin client when available (bypasses RLS for permission lookup), fall back to anon client
const getClient = () => supabaseAdmin ?? supabase;

/**
 * Middleware factory: checks that the authenticated user has the given report
 * permission code via user_roles → role_permissions → permissions.
 *
 * Usage (always call AFTER `protect`):
 *   router.get('/order-summary', protect, requireReportPermission('sales.order_summary.view'), handler);
 */
export const requireReportPermission = (permCode: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id || !req.companyId) {
        throw new AuthorizationError('Authentication context required');
      }

      // Admin role bypasses all report permission checks
      const adminRoles = req.user.roles ?? [];
      if (adminRoles.includes('admin') || adminRoles.includes('super_admin')) {
        return next();
      }

      // Check via user_roles → role_permissions → permissions chain
      const { data, error } = await getClient()
        .from('user_roles')
        .select(`
          roles!inner(
            role_permissions!inner(
              permissions!inner(code)
            )
          )
        `)
        .eq('user_id', req.user.id)
        .eq('company_id', req.companyId)
        .eq('roles.role_permissions.permissions.code', permCode)
        .limit(1);

      if (error) {
        console.error('[requireReportPermission] DB error:', error);
        throw new AuthorizationError('Permission check failed');
      }

      if (!data || data.length === 0) {
        throw new AuthorizationError(`Access denied: missing permission '${permCode}'`);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Convenience check for export permission on a module.
 * Usage: requireReportPermission('sales.export')
 */
export const requireExportPermission = (module: string) =>
  requireReportPermission(`${module}.export`);
