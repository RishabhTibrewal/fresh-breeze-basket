import { Request, Response } from 'express';
import { supabase, createAuthClient, supabaseAdmin } from '../config/supabase';
import { SupabaseJwtVerificationError, verifySupabaseJwt } from '../utils/supabaseJwt';
import { ApiError } from '../middleware/error';
import { assignUserRoles, hasAnyRole, getUserRoles, invalidateRoleCache } from '../utils/roles';

const ensureMembership = async (userId: string, companyId: string, roles: string[] = ['user']) => {
  // Use new multi-role system
  const result = await assignUserRoles(userId, companyId, roles);
  if (!result.success) {
    return new Error(result.error || 'Failed to assign roles');
  }
  
  // Also ensure company_memberships entry exists for backward compatibility
  const client = supabaseAdmin || supabase;
  const primaryRole = roles.length > 0 ? roles[0] : 'user';
  const { error } = await client
    .from('company_memberships')
    .upsert({
      user_id: userId,
      company_id: companyId,
      role: primaryRole, // Keep for backward compatibility
      is_active: true
    }, {
      onConflict: 'user_id,company_id'
    });

  return error;
};

const getMembership = async (userId: string, companyId?: string) => {
  const client = supabaseAdmin || supabase;
  let query = client
    .from('company_memberships')
    .select('company_id, is_active')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (companyId) {
    query = query.eq('company_id', companyId);
  } else {
    query = query.order('created_at', { ascending: true }).limit(1);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error('Error fetching company membership:', error);
    return null;
  }

  return data || null;
};

// Register new user
export const register = async (req: Request, res: Response) => {
  try {
    console.log('Registration request body:', req.body);
    const { email, password, first_name, last_name, phone, roles } = req.body;
    
    // Validate roles if provided
    const userRoles = roles && Array.isArray(roles) ? roles : ['user'];
    
    // Validate role names
    const validRoles = ['admin', 'sales', 'accounts', 'user', 'warehouse_manager'];
    const invalidRoles = userRoles.filter((role: string) => !validRoles.includes(role));
    if (invalidRoles.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid roles: ${invalidRoles.join(', ')}. Valid roles are: ${validRoles.join(', ')}`
      });
    }

    if (!req.companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company context is required'
      });
    }
    
    if (!email || !password) {
      console.log('Missing email or password:', { email, password });
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }
    
    // Register with Supabase Auth Admin API (proper way for backend)
    console.log('Attempting to create user in Supabase Auth...');
    
    if (!supabaseAdmin) {
      console.error('Supabase admin client not available');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }
    
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email so user can login immediately
      user_metadata: {
        first_name: first_name || null,
        last_name: last_name || null,
        phone: phone || null,
        company_id: req.companyId,
        role: userRoles[0] || 'user', // Primary role for backward compatibility
        roles: userRoles // New: array of roles
      }
    });
    
    if (authError) {
      console.error('Supabase auth error:', authError);
      const isEmailExists =
        authError.code === 'email_exists' ||
        authError.status === 422 ||
        authError.message?.includes('already been registered') ||
        authError.message?.includes('already registered') ||
        authError.message?.includes('already exists');
      if (isEmailExists) {
        // If user already exists, link them to the company instead of failing
        let existingUserId: string | null = null;

        if (!existingUserId) {
          const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
            .from('profiles')
            .select('id, company_id')
            .eq('email', email)
            .maybeSingle();

          if (existingProfileError) {
            console.error('Error fetching profile by email:', existingProfileError);
          } else {
            existingUserId = existingProfile?.id || null;
          }
        }

        if (!existingUserId) {
          // Verify credentials to safely link existing auth user
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
          });

          if (signInError || !signInData.user) {
            return res.status(401).json({
              success: false,
              message: 'Account exists. Please login with the correct password to link this company.'
            });
          }

          existingUserId = signInData.user.id;
        }

        if (existingUserId) {
          const membershipError = await ensureMembership(existingUserId, req.companyId, userRoles);
          if (membershipError) {
            console.error('Error creating membership for existing user:', membershipError);
            return res.status(500).json({
              success: false,
              message: 'Failed to link existing user to company'
            });
          }

          const { data: existingProfile } = await supabaseAdmin
            .from('profiles')
            .select('id, company_id')
            .eq('id', existingUserId)
            .maybeSingle();

          if (!existingProfile) {
            await supabaseAdmin
              .from('profiles')
              .insert({
                id: existingUserId,
                email,
                first_name: first_name || null,
                last_name: last_name || null,
                phone: phone || null,
                company_id: req.companyId,
                role: 'user'
              });
          } else if (existingProfile.company_id !== req.companyId) {
            await supabaseAdmin
              .from('profiles')
              .update({ company_id: req.companyId })
              .eq('id', existingUserId);
          }

          return res.status(200).json({
            success: true,
            message: 'User linked to company successfully',
            data: {
              id: existingUserId,
              email
            }
          });
        }

        return res.status(400).json({
          success: false,
          message: 'User already registered. Please login or contact support.'
        });
      }
      return res.status(400).json({
        success: false,
        message: authError.message || 'Failed to create user'
      });
    }
    
    if (!authData.user) {
      console.error('No user data returned from Supabase');
      return res.status(500).json({
        success: false,
        message: 'Error creating user'
      });
    }
    
    console.log('User created in Supabase Auth with ID:', authData.user.id);
    
    const profilePayload = {
      id: authData.user.id,
      email: authData.user.email,
      first_name: first_name || null,
      last_name: last_name || null,
      phone: phone || null,
      company_id: req.companyId,
      role: userRoles[0] || 'user' // Primary role for backward compatibility
    };

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' });

    if (profileError) {
      console.error('Error upserting profile:', profileError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create user profile'
      });
    }

    const membershipError = await ensureMembership(authData.user.id, req.companyId, userRoles);
    if (membershipError) {
      console.error('Error creating membership:', membershipError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create company membership'
      });
    }

    // Return success after user is created in Supabase Auth
    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: authData.user.id,
        email: authData.user.email
      }
    });
  } catch (error) {
    console.error('Unexpected error during registration:', error);
    return res.status(500).json({
      success: false,
      message: 'Error registering user'
    });
  }
};

// Login user
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password, supabase_token } = req.body;
    if (!req.companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company context is required'
      });
    }
    const activeCompanyId = req.companyId;
    
    // Check if we're trying to login with a Supabase token (for keeping backend in sync)
    if (email && supabase_token) {
      try {
        console.log('Attempting to login with Supabase token for email:', email);
        
        const payload = await verifySupabaseJwt(supabase_token);
        
        // Verify that the email matches the token
        if (payload.email !== email) {
          console.error('Email mismatch:', { tokenEmail: payload.email, requestEmail: email });
          return res.status(401).json({
            success: false,
            message: 'Email does not match token'
          });
        }
        
        // Token is valid, get or create profile
        let profile;
        const { data: existingProfile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', payload.sub)
          .single();
        
        if (profileError) {
          console.error('Profile not found for valid token user:', payload.sub);
          return res.status(500).json({
            success: false,
            message: 'User profile is missing. Please contact support.'
          });
        } else {
          profile = existingProfile;
          console.log('Profile found for token login:', profile);
        }

        const membership = await getMembership(payload.sub, activeCompanyId);

        if (!membership) {
          return res.status(403).json({
            success: false,
            message: 'User does not belong to this company'
          });
        }

        if (membership.company_id !== activeCompanyId) {
          return res.status(403).json({
            success: false,
            message: 'User does not belong to this company'
          });
        }

        if (profile.company_id !== activeCompanyId) {
          await supabase
            .from('profiles')
            .update({ company_id: activeCompanyId })
            .eq('id', profile.id);
        }
        
        // Get user roles using new role system
        const userRoles = await getUserRoles(payload.sub, activeCompanyId);
        const primaryRole = userRoles.length > 0 ? userRoles[0] : 'user';
        
        // Return success with token (reusing the Supabase token)
        return res.status(200).json({
          success: true,
          data: {
            token: supabase_token,
            user: {
              id: profile.id,
              email: profile.email,
              first_name: profile.first_name,
              last_name: profile.last_name,
              phone: profile.phone,
              role: primaryRole, // Backward compatibility
              roles: userRoles, // New: array of roles
              company_id: activeCompanyId
            }
          }
        });
      } catch (tokenError) {
        if (tokenError instanceof SupabaseJwtVerificationError && tokenError.kind === 'unavailable') {
          console.error('JWKS verification unavailable during token login:', tokenError);
          return res.status(503).json({
            success: false,
            message: 'Auth verification unavailable'
          });
        }
        console.error('Error during token validation:', tokenError);
        return res.status(401).json({
          success: false,
          message: 'Failed to validate Supabase token'
        });
      }
    }
    
    // Regular login flow with email and password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }
    
    // Get Supabase auth session first
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (authError) {
      console.error('Supabase auth error:', authError);
      return res.status(401).json({
        success: false,
        message: 'Please register'
      });
    }
    
    // Get or create profile
    let profile;
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();
    
    if (profileError) {
      // Profile not found - return error instead of creating
      console.error('Login successful but profile not found for user ID:', authData.user.id, 'Error:', profileError);
      return res.status(500).json({
        success: false,
        message: 'Login successful, but user profile is missing. Please contact support.'
      });
    } else {
      profile = existingProfile;
      console.log('Existing profile found during login:', profile);
    }

    const membership = await getMembership(authData.user.id, activeCompanyId);

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'User does not belong to this company'
      });
    }

    if (membership.company_id !== activeCompanyId) {
      return res.status(403).json({
        success: false,
        message: 'User does not belong to this company'
      });
    }

    if (profile.company_id !== activeCompanyId) {
      await supabase
        .from('profiles')
        .update({ company_id: activeCompanyId })
        .eq('id', profile.id);
    }
    
    // Get user roles using new role system
    const userRoles = await getUserRoles(authData.user.id, activeCompanyId);
    const primaryRole = userRoles.length > 0 ? userRoles[0] : 'user';
    
    return res.status(200).json({
      success: true,
      data: {
        token: authData.session.access_token,
        user: {
          id: profile.id,
          email: profile.email,
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone,
          role: primaryRole, // Backward compatibility
          roles: userRoles, // New: array of roles
          company_id: activeCompanyId
        }
      }
    });
  } catch (error) {
    console.error('Unexpected error during login:', error);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred during login'
    });
  }
};

// Get current user
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'User not authenticated'
        }
      });
    }

    const userId = req.user.id;
    if (!req.companyId) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Company context is required'
        }
      });
    }
    const activeCompanyId = req.companyId;

    // First, verify profile exists and belongs to the company
    // Use admin client to bypass RLS when checking/creating profiles
    const adminClient = supabaseAdmin || supabase;
    const { data: profileCheck, error: profileCheckError } = await adminClient
      .from('profiles')
      .select('company_id')
      .eq('id', userId)
      .single();
    
    // If profile doesn't exist, create it
    if (profileCheckError && profileCheckError.code === 'PGRST116') { // PGRST116 is "not found" error
      console.log('Profile not found for user ID:', userId, 'Creating new profile...');
      
      try {
        // Create new profile using admin client to bypass RLS
        const { data: newProfile, error: createError } = await adminClient
          .from('profiles')
          .insert({
            id: userId,
            email: req.user.email,
            role: 'user',
            company_id: activeCompanyId,
            updated_at: new Date()
          })
          .select()
          .single();
        
        if (createError) {
          console.error('Error creating profile:', createError);
          // Instead of throwing an error that crashes the server, return a response
          return res.status(500).json({
            success: false,
            error: {
              message: 'Error creating user profile. This may be due to permissions issues.',
              details: createError.message
            }
          });
        }
        
        console.log('New profile created successfully:', newProfile);
      } catch (profileCreateError) {
        console.error('Caught exception while creating profile:', profileCreateError);
        return res.status(500).json({
          success: false,
          error: {
            message: 'Failed to create user profile. Please try again later.',
            details: profileCreateError instanceof Error ? profileCreateError.message : 'Unknown error'
          }
        });
      }
    } else if (profileCheckError) {
      console.error('Error fetching profile:', profileCheckError);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Error fetching user profile',
          details: profileCheckError.message
        }
      });
    }

    const membership = await getMembership(userId, activeCompanyId);

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'User does not belong to this company'
        }
      });
    }

    if (membership.company_id !== activeCompanyId) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'User does not belong to this company'
        }
      });
    }

    // Fetch full profile once company is verified
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Error fetching user profile',
          details: error.message
        }
      });
    }
    
    // Check if user is admin using new role system
    const isAdminCheck = await hasAnyRole(userId, activeCompanyId, ['admin']);
    
    // Get user roles using new role system
    const userRoles = await getUserRoles(userId, activeCompanyId);
    const primaryRole = userRoles.length > 0 ? userRoles[0] : 'user';
    
    if (profile?.company_id !== activeCompanyId) {
      await supabase
        .from('profiles')
        .update({ company_id: activeCompanyId })
        .eq('id', userId);
    }

    return res.status(200).json({
      success: true,
      data: {
        id: userId,
        email: req.user.email,
        ...profile,
        isAdmin: isAdminCheck,
        company_id: activeCompanyId,
        role: primaryRole, // Backward compatibility
        roles: userRoles // New: array of roles
      }
    });
  } catch (error) {
    console.error('Unexpected error in getCurrentUser:', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Error retrieving user profile',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
};

// Update user profile
export const updateProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'User not authenticated' }
      });
    }
    const userId = req.user.id;
    const { first_name, last_name, phone, avatar_url } = req.body;
    
    console.log('[updateProfile] Request received:', {
      userId,
      body: req.body,
      first_name,
      last_name,
      phone,
      avatar_url
    });
    
    // Build update object - only include fields that are provided (not undefined)
    const updateData: any = {
      updated_at: new Date()
    };
    
    if (first_name !== undefined && first_name !== null) {
      updateData.first_name = first_name;
    }
    if (last_name !== undefined && last_name !== null) {
      updateData.last_name = last_name;
    }
    if (phone !== undefined && phone !== null) {
      updateData.phone = phone;
    }
    if (avatar_url !== undefined && avatar_url !== null) {
      updateData.avatar_url = avatar_url;
    }
    
    console.log('[updateProfile] Update data:', updateData);
    
    // Update profile
    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) {
      console.error('[updateProfile] Supabase error:', error);
      throw new ApiError(400, error.message);
    }
    
    if (!data) {
      console.error('[updateProfile] No data returned from Supabase');
      throw new ApiError(404, 'Profile not found');
    }
    
    console.log('[updateProfile] Profile updated successfully:', data);
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[updateProfile] Error caught:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error updating profile');
  }
};

// Add new address
export const addAddress = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    const userId = req.user.id;
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required'
      });
    }
    
    console.log(`Adding address for user ${userId}:`, req.body);
    
    // Create client with auth context
    const authClient = createAuthClient(token);
    
    const {
      address_type,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      is_default
    } = req.body;
    
    // Validate required fields
    const requiredFields = ['address_line1', 'city', 'address_type', 'country'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      console.log(`Missing required fields: ${missingFields.join(', ')}`);
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }
    
    // Validate address type
    const validAddressTypes = ['shipping', 'billing', 'both'];
    if (!validAddressTypes.includes(address_type)) {
      console.log(`Invalid address type: ${address_type}`);
      return res.status(400).json({
        success: false,
        message: `Invalid address type. Must be one of: ${validAddressTypes.join(', ')}`
      });
    }
    
    // If setting as default, update other addresses first
    if (is_default) {
      console.log(`Setting address as default for type: ${address_type}`);
      const { error: updateError } = await authClient
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', userId)
        .eq('address_type', address_type);
      
      if (updateError) {
        console.error('Error updating existing addresses:', updateError);
      }
    }
    
    // Add new address - using auth client with user's token
    console.log('Inserting new address with user_id:', userId);
    const { data, error } = await authClient
      .from('addresses')
      .insert({
        user_id: userId,
        address_type,
        address_line1,
        address_line2: address_line2 || null,
        city,
        state: state || null,
        postal_code: postal_code || null,
        country,
        is_default: is_default || false
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error adding address:', error);
      return res.status(400).json({
        success: false,
        message: `Error adding address: ${error.message}`
      });
    }
    
    console.log('Address added successfully:', data);
    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Unexpected error in addAddress:', error);
    return res.status(500).json({
      success: false,
      message: 'Error adding address'
    });
  }
};

// Get user addresses
export const getAddresses = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    const userId = req.user.id;
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required'
      });
    }
    
    console.log(`Getting addresses for user ${userId}`);
    
    // Create client with auth context
    const authClient = createAuthClient(token);
    
    const { data, error } = await authClient
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false });
    
    if (error) {
      console.error('Supabase error when fetching addresses:', error);
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    console.log(`Found ${data?.length || 0} addresses for user ${userId}`);
    
    res.status(200).json({
      success: true,
      data: data || []
    });
  } catch (error: any) {
    console.error('Unhandled error in getAddresses:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error getting addresses'
    });
  }
};

// Get address by ID
export const getAddressById = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    const userId = req.user.id;
    const { id } = req.params;
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required'
      });
    }
    
    console.log(`Getting address ${id} for user ${userId}`);
    
    if (!req.companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company context is required'
      });
    }

    // Create client with auth context
    const authClient = createAuthClient(token);

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    // Check if user has admin or sales role using new role system
    const isPrivileged = await hasAnyRole(req.user.id, req.companyId, ['admin', 'sales']);

    let query = authClient
      .from('addresses')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId);

    if (!isPrivileged) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.maybeSingle();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Supabase error when fetching address:', error);
      return res.status(404).json({
        success: false,
        message: 'Address not found or does not belong to user'
      });
    }
    
    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }
    
    console.log(`Found address ${id} for user ${userId}`);
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Unhandled error in getAddressById:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error getting address'
    });
  }
};

// Update address
export const updateAddress = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    const userId = req.user.id;
    const { id } = req.params;
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required'
      });
    }

    // Create client with auth context
    const authClient = createAuthClient(token);
    
    const {
      address_type,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      is_default
    } = req.body;
    
    // Verify address belongs to user
    const { data: existingAddress, error: fetchError } = await authClient
      .from('addresses')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !existingAddress) {
      return res.status(404).json({
        success: false,
        message: 'Address not found or does not belong to user'
      });
    }
    
    // Validate address type if provided
    if (address_type) {
      const validAddressTypes = ['shipping', 'billing', 'both'];
      if (!validAddressTypes.includes(address_type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid address type. Must be one of: ${validAddressTypes.join(', ')}`
        });
      }
    }
    
    // If setting as default, update other addresses first
    if (is_default) {
      await authClient
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', userId)
        .eq('address_type', address_type || existingAddress.address_type);
    }
    
    // Prepare update data
    const updateData: any = {
      updated_at: new Date()
    };
    
    // Only update fields that are provided
    if (address_type) updateData.address_type = address_type;
    if (address_line1) updateData.address_line1 = address_line1;
    if (address_line2 !== undefined) updateData.address_line2 = address_line2;
    if (city) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (postal_code !== undefined) updateData.postal_code = postal_code;
    if (country) updateData.country = country;
    if (is_default !== undefined) updateData.is_default = is_default;
    
    // Update address
    const { data, error } = await authClient
      .from('addresses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating address:', error);
      return res.status(400).json({
        success: false,
        message: `Error updating address: ${error.message}`
      });
    }
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Unexpected error in updateAddress:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating address'
    });
  }
};

// Delete address
export const deleteAddress = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    const userId = req.user.id;
    const { id } = req.params;
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required'
      });
    }

    // Create client with auth context
    const authClient = createAuthClient(token);
    
    // Verify address belongs to user
    const { data: existingAddress, error: fetchError } = await authClient
      .from('addresses')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !existingAddress) {
      return res.status(404).json({
        success: false,
        message: 'Address not found or does not belong to user'
      });
    }
    
    // Delete address
    const { error } = await authClient
      .from('addresses')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting address:', error);
      return res.status(400).json({
        success: false,
        message: `Error deleting address: ${error.message}`
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting address:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error deleting address'
    });
  }
};

// Logout user
export const logout = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Invalidate the token on the client side
    // Note: Since we're using JWT, the token will remain valid until it expires
    // The client should remove the token from storage
    
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Unexpected error during logout:', error);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred during logout'
    });
  }
};

// Function to check admin status
export const checkAdminStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'User not authenticated' }
      });
    }
    const userId = req.user.id;
    
    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (profileError) {
      console.error('Error fetching profile for admin check:', profileError);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve profile'
      });
    }
    
    // Check admin status using RPC function (uses memberships)
    const { data: isAdminRpc, error: rpcError } = await supabase.rpc('is_admin', { user_id: userId });
    
    if (rpcError) {
      console.error('Error in is_admin RPC call:', rpcError);
    }
    
    // Use RPC result (membership-based) as primary, fallback to new role system
    const isAdminCheck = await hasAnyRole(req.user.id, req.companyId, ['admin']);
    const isAdmin = isAdminRpc || isAdminCheck;
    
    return res.status(200).json({
      success: true,
      data: {
        userId,
        email: req.user?.email || '',
        profile,
        isAdmin,
        isAdminRpc,
        membershipRole: req.user?.role || 'none' // Role from membership (via middleware)
      }
    });
  } catch (error) {
    console.error('Error in checkAdminStatus:', error);
    return res.status(500).json({
      success: false,
      error: 'Error checking admin status'
    });
  }
};

// Update user role (legacy endpoint - users should not update their own roles)
// This is kept for backward compatibility but should be deprecated
// Role updates should be done by admins via /api/admin/users/:userId/roles
export const updateRole = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    const userId = req.user.id;
    const { role } = req.body;

    if (!req.companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company context is required'
      });
    }

    // Validate role
    const validRoles = ['user', 'admin', 'sales', 'accounts', 'warehouse_manager'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role specified. Valid roles are: ${validRoles.join(', ')}`
      });
    }

    // Prevent users from assigning themselves admin role
    if (role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You cannot assign yourself admin role. Contact an administrator.'
      });
    }

    // Use new role system to assign role
    const result = await assignUserRoles(userId, req.companyId, [role]);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error || 'Failed to update role'
      });
    }

    // Update profile role for backward compatibility
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select()
      .single();

    if (profileError) {
      console.error('Error updating profile role (non-critical):', profileError);
    }

    // Update company_memberships for backward compatibility
    const { error: membershipError } = await supabase
      .from('company_memberships')
      .upsert({
        user_id: userId,
        company_id: req.companyId,
        role,
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,company_id'
      });

    if (membershipError) {
      console.error('Error updating membership (non-critical):', membershipError);
    }

    // Invalidate role cache so the new role is reflected immediately
    invalidateRoleCache(userId);

    return res.status(200).json({
      success: true,
      data: {
        ...profile,
        role, // Backward compatibility
        roles: [role] // New: array format
      },
      message: 'Role updated successfully. Note: Role management should be done by administrators.'
    });
  } catch (error) {
    console.error('Error in updateRole:', error);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred'
    });
  }
};

// Sync the frontend user session with the backend
export const syncSession = async (req: Request, res: Response) => {
  try {
    console.log('Syncing session for user:', req.user?.id);
    
    const { userId, email, role } = req.body;
    if (!req.companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company context is required'
      });
    }
    
    // Check if the user making the request matches the user to sync
    if (req.user?.id !== userId) {
      console.error('Session sync attempt with mismatched user IDs', { 
        requestUser: req.user?.id, 
        syncUser: userId 
      });
      return res.status(403).json({
        success: false,
        message: 'User ID mismatch'
      });
    }
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    const membership = await getMembership(req.user.id, req.companyId);
    if (!membership || membership.company_id !== req.companyId) {
      return res.status(403).json({
        success: false,
        message: 'User does not belong to this company'
      });
    }

    // Update the user's session data in our backend if needed
    
    console.log('Session synced successfully for user:', userId);
    
    return res.status(200).json({
      success: true,
      message: 'Session synced successfully',
      data: {
        userId,
        email,
        role
      }
    });
  } catch (error) {
    console.error('Error syncing session:', error);
    return res.status(500).json({
      success: false,
      message: 'Error syncing session'
    });
  }
};

// Get customer addresses (for customer ID - used by sales staff)
export const getCustomerAddresses = async (req: Request, res: Response) => {
  try {
    const customerId = req.params.id;
    
    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID is required'
      });
    }
    
    console.log(`Getting addresses for customer ${customerId}`);
    
    // First, get the customer record to find the user_id
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('user_id')
      .eq('id', customerId)
      .single();
    
    if (customerError) {
      console.error('Error fetching customer:', customerError);
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    // Now fetch addresses using the user_id from the customer record
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', customer.user_id)
      .order('is_default', { ascending: false });
    
    if (error) {
      console.error('Supabase error when fetching customer addresses:', error);
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    console.log(`Found ${data?.length || 0} addresses for customer ${customerId} (user_id: ${customer.user_id})`);
    
    res.status(200).json(data || []);
  } catch (error: any) {
    console.error('Unhandled error in getCustomerAddresses:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error getting customer addresses'
    });
  }
};