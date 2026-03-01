import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const registerCompany = async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({
        success: false,
        message: 'SUPABASE_SERVICE_ROLE_KEY is required for company registration'
      });
    }

    const {
      company_name,
      company_slug,
      email,
      password,
      first_name,
      last_name,
      phone
    } = req.body;

    if (!company_name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'company_name, email, and password are required'
      });
    }

    const slug = slugify(company_slug || company_name);
    if (!slug) {
      return res.status(400).json({
        success: false,
        message: 'Unable to generate a valid company slug'
      });
    }

    // Check if company slug already exists
    const { data: existingCompany } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existingCompany) {
      return res.status(400).json({
        success: false,
        message: 'Company slug already in use'
      });
    }

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find(u => u.email === email);

    // Security: Prevent unauthorized company creation with existing email
    // If user already exists, they must use a different email or be authenticated
    // This prevents attackers from creating companies for existing users without password verification
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered. Please use a different email or login to create a company.'
      });
    }

    // Create company first
    const { data: newCompany, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: company_name,
        slug: slug
      })
      .select()
      .single();

    if (companyError || !newCompany) {
      console.error('Error creating company:', companyError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create company',
        details: companyError?.message || null
      });
    }

    // Create new admin user (existing user check already performed above)
    const { data: newUser, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email so admin can login immediately
      user_metadata: {
        first_name: first_name || null,
        last_name: last_name || null,
        phone: phone || null,
        company_id: newCompany.id,
        role: 'admin'
      }
    });

    if (userError || !newUser.user) {
      console.error('Error creating user:', userError);
      // Rollback: delete company if user creation failed
      await supabaseAdmin.from('companies').delete().eq('id', newCompany.id);
      return res.status(500).json({
        success: false,
        message: userError?.message || 'Failed to create admin user',
        details: userError?.message || null
      });
    }

    const adminUser = newUser.user;

    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, company_id')
      .eq('id', adminUser.id)
      .maybeSingle();

    if (!existingProfile) {
      await supabaseAdmin
        .from('profiles')
        .insert({
          id: adminUser.id,
          email: adminUser.email,
          first_name: first_name || null,
          last_name: last_name || null,
          phone: phone || null,
          company_id: newCompany.id,
          role: 'admin'
        });
    } else if (existingProfile.company_id !== newCompany.id) {
      // Update profile company_id for RLS compatibility (membership is primary)
      await supabaseAdmin
        .from('profiles')
        .update({ company_id: newCompany.id })
        .eq('id', adminUser.id);
    }

    const { error: membershipError } = await supabaseAdmin
      .from('company_memberships')
      .upsert({
        user_id: adminUser.id,
        company_id: newCompany.id,
        role: 'admin',
        is_active: true
      }, {
        onConflict: 'user_id,company_id'
      });

    if (membershipError) {
      console.error('Error creating company membership:', membershipError);
    }

    // Initialize all modules for the new company (enabled by default)
    const defaultModules = [
      'ecommerce',
      'sales',
      'inventory',
      'procurement',
      'accounting',
      'reports',
      'pos',
      'settings'
    ];

    const moduleInserts = defaultModules.map(module_code => ({
      company_id: newCompany.id,
      module_code,
      is_enabled: true,
      settings: {}
    }));

    const { error: modulesError } = await supabaseAdmin
      .from('company_modules')
      .insert(moduleInserts);

    if (modulesError) {
      console.error('Error initializing company modules:', modulesError);
      // Don't fail company creation if module initialization fails, but log it
    }

    const baseDomain = process.env.TENANT_BASE_DOMAIN || 'gofreshco.com';

    return res.status(201).json({
      success: true,
      data: {
        company: {
          id: newCompany.id,
          name: company_name,
          slug
        },
        admin: {
          id: adminUser.id,
          email,
          role: 'admin'
        },
        login_url: `https://${slug}.${baseDomain}`
      }
    });
  } catch (error) {
    console.error('Unexpected error in registerCompany:', error);
    return res.status(500).json({
      success: false,
      message: 'Error registering company'
    });
  }
};

export const getCompanyBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: 'Company slug is required'
      });
    }

    const client = supabaseAdmin || supabase;
    const { data: company, error } = await client
      .from('companies')
      .select('id, name, slug, is_active')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: company.id,
        name: company.name,
        slug: company.slug
      }
    });
  } catch (error) {
    console.error('Error fetching company by slug:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching company'
    });
  }
};
