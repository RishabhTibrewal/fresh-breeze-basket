import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

const BASE_DOMAIN = process.env.TENANT_BASE_DOMAIN || 'gofreshco.com';
const DEFAULT_COMPANY_SLUG = process.env.DEFAULT_COMPANY_SLUG || 'default';
const TENANT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const tenantCache = new Map<string, { companyId: string; companySlug: string; expiresAt: number }>();

const extractSubdomain = (host: string): string | null => {
  const cleanHost = host.split(':')[0].toLowerCase();

  if (cleanHost === 'localhost' || cleanHost.endsWith('.localhost')) {
    return DEFAULT_COMPANY_SLUG;
  }

  if (!cleanHost.endsWith(BASE_DOMAIN)) {
    return null;
  }

  const hostWithoutBase = cleanHost.slice(0, -(BASE_DOMAIN.length)).replace(/\.$/, '');
  if (!hostWithoutBase || hostWithoutBase === 'www') {
    return DEFAULT_COMPANY_SLUG;
  }

  return hostWithoutBase.split('.')[0] || null;
};

export const resolveTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (
      req.method === 'OPTIONS' ||
      req.path === '/health' ||
      req.path === '/' ||
      req.path === '/api/companies/register'
    ) {
      return next();
    }

    let subdomain: string | null = null;
    
    // Priority 1: Try to get subdomain from custom header (most reliable)
    const headerSubdomain = req.headers['x-tenant-subdomain'] as string;
    if (headerSubdomain) {
      subdomain = headerSubdomain.toLowerCase().trim();
      console.log(`[Tenant] ✅ Using subdomain from X-Tenant-Subdomain header: ${subdomain}`);
    } else {
      // Priority 2: Fallback to extracting from Host header
      const host = req.headers.host;
      if (!host) {
        console.error(`[Tenant] ❌ Missing host header and X-Tenant-Subdomain header`);
        console.error(`[Tenant] Headers:`, {
          host: req.headers.host,
          origin: req.headers.origin,
          referer: req.headers.referer,
          'x-tenant-subdomain': req.headers['x-tenant-subdomain']
        });
        return res.status(400).json({ success: false, error: 'Missing host header or tenant subdomain' });
      }

      subdomain = extractSubdomain(host);
      if (!subdomain) {
        console.error(`[Tenant] ❌ Invalid tenant host: ${host}`);
        return res.status(400).json({ success: false, error: 'Invalid tenant host' });
      }
      console.log(`[Tenant] ✅ Extracted subdomain: ${subdomain} from host: ${host}`);
    }

    const origin = req.headers.origin || req.headers.referer;
    if (origin) {
      console.log(`[Tenant] Origin header received: ${origin}`);
    }

    console.log(`[Tenant] Resolving company for subdomain: ${subdomain}`);

    if (!subdomain) {
      return res.status(400).json({ success: false, error: 'Tenant subdomain is required' });
    }

    const cachedTenant = tenantCache.get(subdomain);
    if (cachedTenant && cachedTenant.expiresAt > Date.now()) {
      req.companyId = cachedTenant.companyId;
      req.companySlug = cachedTenant.companySlug;
      console.log(`[Tenant] ✅ Using cached company for subdomain: ${subdomain}`);
      return next();
    }

    const { data: company, error } = await supabase
      .from('companies')
      .select('id, slug, is_active')
      .eq('slug', subdomain)
      .single();

    if (error || !company || !company.is_active) {
      console.error(`[Tenant] Company not found for subdomain: ${subdomain}`, error);
      return res.status(404).json({ success: false, error: `Company not found for subdomain: ${subdomain}` });
    }

    req.companyId = company.id;
    req.companySlug = company.slug;
    tenantCache.set(subdomain, {
      companyId: company.id,
      companySlug: company.slug,
      expiresAt: Date.now() + TENANT_CACHE_TTL
    });
    console.log(`[Tenant] ✅ Resolved company: ${company.slug} (${company.id})`);
    return next();
  } catch (err) {
    console.error('Tenant resolution error:', err);
    return res.status(500).json({ success: false, error: 'Tenant resolution failed' });
  }
};
