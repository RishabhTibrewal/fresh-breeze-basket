import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

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

    // Check if email already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find(u => u.email === email);
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
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

    // Create user using Supabase Auth Admin API (proper way)
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

    // Update profile with company_id and role (trigger should create profile, but ensure it's correct)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: newUser.user.id,
        email: newUser.user.email,
        first_name: first_name || null,
        last_name: last_name || null,
        phone: phone || null,
        company_id: newCompany.id,
        role: 'admin'
      }, {
        onConflict: 'id'
      });

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Don't fail the request, profile might have been created by trigger
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
          id: newUser.user.id,
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
