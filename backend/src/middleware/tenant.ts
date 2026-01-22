import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

const BASE_DOMAIN = process.env.TENANT_BASE_DOMAIN || 'gofreshco.com';
const DEFAULT_COMPANY_SLUG = process.env.DEFAULT_COMPANY_SLUG || 'default';

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
      // Priority 2: Try to extract from Origin/Referer header (for CORS scenarios)
      const origin = req.headers.origin || req.headers.referer;
      if (origin) {
        try {
          const originUrl = new URL(origin);
          const originHostname = originUrl.hostname;
          // Extract subdomain from origin (e.g., "gulffresh" from "gulffresh.gofreshco.com")
          if (originHostname.includes('.') && !originHostname.startsWith('localhost')) {
            const parts = originHostname.split('.');
            if (parts.length > 2) {
              subdomain = parts[0].toLowerCase();
              console.log(`[Tenant] ✅ Extracted subdomain from Origin header: ${subdomain} (from ${originHostname})`);
            }
          }
        } catch (e) {
          console.warn(`[Tenant] Failed to parse origin: ${origin}`, e);
        }
      }
      
      // Priority 3: Fallback to extracting from Host header
      if (!subdomain) {
        const host = req.headers.host;
        if (!host) {
          console.error(`[Tenant] ❌ Missing host header, origin header, and X-Tenant-Subdomain header`);
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
    }

    console.log(`[Tenant] Resolving company for subdomain: ${subdomain}`);

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
    console.log(`[Tenant] ✅ Resolved company: ${company.slug} (${company.id})`);
    return next();
  } catch (err) {
    console.error('Tenant resolution error:', err);
    return res.status(500).json({ success: false, error: 'Tenant resolution failed' });
  }
};
