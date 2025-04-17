import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ApiError } from '../middleware/error';

// Register new user
export const register = async (req: Request, res: Response) => {
  try {
    console.log('Registration request body:', req.body);
    const { email, password, first_name, last_name, phone } = req.body;
    
    if (!email || !password) {
      console.log('Missing email or password:', { email, password });
      throw new ApiError(400, 'Please provide email and password');
    }
    
    // Check if user already exists
    const { data: existingUser, error: userCheckError } = await supabase.auth.signInWithPassword({
      email,
      password: 'dummy-password-for-check' // We use a dummy password just to check if the user exists
    });
    
    // If we get a specific error about invalid credentials, it means the user exists
    // If we get a different error, it might be a server issue
    if (userCheckError && userCheckError.message.includes('Invalid login credentials')) {
      console.log('User already exists with email:', email);
      return res.status(409).json({
        success: false,
        message: 'User already exists. Please login instead.'
      });
    }
    
    // Register with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (authError) {
      console.error('Supabase auth error:', authError);
      throw new ApiError(400, authError.message);
    }
    
    if (!authData.user) {
      console.error('No user data returned from Supabase');
      throw new ApiError(500, 'Error creating user');
    }
    
    console.log('User created in Supabase Auth with ID:', authData.user.id);
    
    // Use upsert to either create or update the profile
    console.log('Upserting profile for user ID:', authData.user.id);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email,
        first_name: first_name || null,
        last_name: last_name || null,
        phone: phone || null,
        role: 'user', // default role
        updated_at: new Date()
      }, {
        onConflict: 'id',
        ignoreDuplicates: false
      })
      .select()
      .single();
    
    if (profileError) {
      console.error('Error upserting profile:', profileError);
      throw new ApiError(500, 'Error creating/updating user profile');
    }
    
    console.log('Profile upserted successfully:', profile);
    
    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email for verification.'
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Unexpected error during registration:', error);
    throw new ApiError(500, 'Error registering user');
  }
};

// Login user
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('Login error:', error);
      return res.status(401).json({
        success: false,
        message: 'Invalid login credentials'
      });
    }
    
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();
    
    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return res.status(500).json({
        success: false,
        message: 'Error fetching user profile'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: {
        token: data.session.access_token,
        user: {
          id: data.user.id,
          email: data.user.email,
          ...profile
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
    const userId = req.user.id;
    
    // Get user profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    // If profile doesn't exist, create it
    if (error && error.code === 'PGRST116') { // PGRST116 is "not found" error
      console.log('Profile not found for user ID:', userId, 'Creating new profile...');
      
      // Create new profile
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: req.user.email,
          role: 'user',
          updated_at: new Date()
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating profile:', createError);
        throw new ApiError(500, 'Error creating user profile');
      }
      
      console.log('New profile created successfully:', newProfile);
      
      // Check if user is admin
      const { data: isAdmin } = await supabase.rpc('is_admin', { user_id: userId });
      
      return res.status(200).json({
        success: true,
        data: {
          id: userId,
          email: req.user.email,
          ...newProfile,
          isAdmin: isAdmin || false
        }
      });
    } else if (error) {
      console.error('Error fetching profile:', error);
      throw new ApiError(500, 'Error fetching user profile');
    }
    
    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('is_admin', { user_id: userId });
    
    res.status(200).json({
      success: true,
      data: {
        id: userId,
        email: req.user.email,
        ...profile,
        isAdmin: isAdmin || false
      }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Unexpected error in getCurrentUser:', error);
    throw new ApiError(500, 'Error getting user profile');
  }
};

// Update user profile
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { first_name, last_name, phone, avatar_url } = req.body;
    
    // Update profile
    const { data, error } = await supabase
      .from('profiles')
      .update({
        first_name: first_name || undefined,
        last_name: last_name || undefined,
        phone: phone || undefined,
        avatar_url: avatar_url || undefined,
        updated_at: new Date()
      })
      .eq('id', userId)
      .select()
      .single();
    
    if (error) {
      throw new ApiError(400, error.message);
    }
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error updating profile');
  }
};

// Add new address
export const addAddress = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
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
    const requiredFields = ['address_line1', 'city', 'address_type', 'state', 'postal_code', 'country'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }
    
    // Validate address type
    const validAddressTypes = ['shipping', 'billing', 'both'];
    if (!validAddressTypes.includes(address_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid address type. Must be one of: ${validAddressTypes.join(', ')}`
      });
    }
    
    // If setting as default, update other addresses first
    if (is_default) {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', userId)
        .eq('address_type', address_type);
    }
    
    // Add new address
    const { data, error } = await supabase
      .from('addresses')
      .insert({
        user_id: userId,
        address_type,
        address_line1,
        address_line2: address_line2 || null,
        city,
        state,
        postal_code,
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
    const userId = req.user.id;
    
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false });
    
    if (error) {
      throw new ApiError(400, error.message);
    }
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error getting addresses');
  }
};

// Update address
export const updateAddress = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
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
    const { data: existingAddress, error: fetchError } = await supabase
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
      await supabase
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
    if (state) updateData.state = state;
    if (postal_code) updateData.postal_code = postal_code;
    if (country) updateData.country = country;
    if (is_default !== undefined) updateData.is_default = is_default;
    
    // Update address
    const { data, error } = await supabase
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
    const userId = req.user.id;
    const { id } = req.params;
    
    // Verify address belongs to user
    const { data: existingAddress, error: fetchError } = await supabase
      .from('addresses')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !existingAddress) {
      throw new ApiError(404, 'Address not found or does not belong to user');
    }
    
    // Delete address
    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw new ApiError(400, error.message);
    }
    
    res.status(200).json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error deleting address');
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