import { supabaseAdmin } from '../../lib/supabase';

/**
 * FeatureFlagService - Manages feature flags at company and outlet level
 * Supports enabling/disabling features like barcode, inventory, tables (future), kitchen (future)
 */
export class FeatureFlagService {
  private companyId: string;

  constructor(companyId: string) {
    this.companyId = companyId;
  }

  /**
   * Check if a feature flag is enabled
   * Checks in order: outlet-specific > company-specific > global
   */
  async isEnabled(outletId: string | null, flagName: string): Promise<boolean> {
    try {
      // First check outlet-specific flag
      if (outletId) {
        const { data: outletFlag } = await supabaseAdmin
          .from('feature_flags')
          .select('is_enabled')
          .eq('company_id', this.companyId)
          .eq('outlet_id', outletId)
          .eq('flag_name', flagName)
          .maybeSingle();

        if (outletFlag !== null) {
          return outletFlag.is_enabled;
        }
      }

      // Then check company-wide flag
      const { data: companyFlag } = await supabaseAdmin
        .from('feature_flags')
        .select('is_enabled')
        .eq('company_id', this.companyId)
        .is('outlet_id', null)
        .eq('flag_name', flagName)
        .maybeSingle();

      if (companyFlag !== null) {
        return companyFlag.is_enabled;
      }

      // Finally check global flag
      const { data: globalFlag } = await supabaseAdmin
        .from('feature_flags')
        .select('is_enabled')
        .is('company_id', null)
        .is('outlet_id', null)
        .eq('flag_name', flagName)
        .maybeSingle();

      return globalFlag?.is_enabled || false;
    } catch (error) {
      console.error('Error checking feature flag:', error);
      return false;
    }
  }

  /**
   * Get feature flag configuration
   */
  async getConfig(outletId: string | null, flagName: string): Promise<any> {
    try {
      // Check outlet-specific config first
      if (outletId) {
        const { data: outletFlag } = await supabaseAdmin
          .from('feature_flags')
          .select('config')
          .eq('company_id', this.companyId)
          .eq('outlet_id', outletId)
          .eq('flag_name', flagName)
          .maybeSingle();

        if (outletFlag?.config) {
          return outletFlag.config;
        }
      }

      // Check company-wide config
      const { data: companyFlag } = await supabaseAdmin
        .from('feature_flags')
        .select('config')
        .eq('company_id', this.companyId)
        .is('outlet_id', null)
        .eq('flag_name', flagName)
        .maybeSingle();

      if (companyFlag?.config) {
        return companyFlag.config;
      }

      // Check global config
      const { data: globalFlag } = await supabaseAdmin
        .from('feature_flags')
        .select('config')
        .is('company_id', null)
        .is('outlet_id', null)
        .eq('flag_name', flagName)
        .maybeSingle();

      return globalFlag?.config || null;
    } catch (error) {
      console.error('Error getting feature flag config:', error);
      return null;
    }
  }

  /**
   * Set feature flag for company or outlet
   */
  async setFlag(
    outletId: string | null,
    flagName: string,
    isEnabled: boolean,
    config?: any
  ): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('feature_flags')
        .upsert(
          {
            company_id: this.companyId,
            outlet_id: outletId,
            flag_name: flagName,
            is_enabled: isEnabled,
            config: config || null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'company_id,outlet_id,flag_name',
          }
        );

      if (error) {
        console.error('Error setting feature flag:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error setting feature flag:', error);
      return false;
    }
  }
}

