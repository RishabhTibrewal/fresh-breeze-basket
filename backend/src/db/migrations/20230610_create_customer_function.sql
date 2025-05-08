-- Enable the pgcrypto extension if it's not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create a function to create a customer with a corresponding user account
CREATE OR REPLACE FUNCTION public.create_customer_with_user(
  p_name TEXT,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_trn_number TEXT DEFAULT NULL,
  p_credit_period_days INTEGER DEFAULT 0,
  p_credit_limit DECIMAL DEFAULT 0,
  p_current_credit DECIMAL DEFAULT 0,
  p_sales_executive_id UUID DEFAULT NULL,
  p_password TEXT DEFAULT '123456'
)
RETURNS JSONB
SECURITY DEFINER -- This is important as it runs with the privileges of the function creator
AS $$
DECLARE
  new_customer_id UUID;
  new_user_id UUID;
  customer_record JSONB;
  profile_exists BOOLEAN;
BEGIN
  -- Make sure sales_executive_id is provided
  IF p_sales_executive_id IS NULL THEN
    RAISE EXCEPTION 'Sales executive ID is required';
  END IF;

  -- Check if a user already exists with the provided email
  SELECT COUNT(*) > 0 INTO profile_exists 
  FROM auth.users 
  WHERE email = p_email;
  
  IF profile_exists THEN
    -- Get the user ID if the profile already exists
    SELECT id INTO new_user_id
    FROM auth.users
    WHERE email = p_email;
    
    RAISE NOTICE 'User with email % already exists with ID %', p_email, new_user_id;
  ELSE
    -- Generate a UUID for the new user
    new_user_id := gen_random_uuid();
    
    -- First create a user in auth.users table
    -- This requires superuser privileges which SECURITY DEFINER provides
    INSERT INTO auth.users (
      id, -- Explicitly specify the id column
      email,
      email_confirmed_at,
      raw_user_meta_data,
      created_at,
      updated_at,
      encrypted_password
    ) VALUES (
      new_user_id, -- Use the generated UUID
      p_email,
      now(),
      jsonb_build_object('name', p_name, 'phone', p_phone),
      now(),
      now(),
      crypt(p_password, gen_salt('bf'))
    );
    
    -- Check if profile exists for this user ID
    SELECT COUNT(*) > 0 INTO profile_exists 
    FROM profiles 
    WHERE id = new_user_id;
    
    -- Create profile for the new user with 'user' role if it doesn't exist
    IF NOT profile_exists THEN
      INSERT INTO public.profiles (
        id,
        email,
        role
      ) VALUES (
        new_user_id,
        p_email,
        'user'
      );
    END IF;
  END IF;

  -- Check if customer already exists for this user
  IF EXISTS (SELECT 1 FROM customers WHERE user_id = new_user_id) THEN
    -- Get the existing customer ID
    SELECT id INTO new_customer_id
    FROM customers
    WHERE user_id = new_user_id;
    
    -- Update the customer record
    UPDATE customers
    SET 
      name = p_name,
      email = p_email,
      phone = p_phone,
      trn_number = p_trn_number,
      credit_period_days = p_credit_period_days,
      credit_limit = p_credit_limit,
      current_credit = p_current_credit,
      sales_executive_id = p_sales_executive_id,
      updated_at = now()
    WHERE id = new_customer_id;
  ELSE
    -- Insert the customer with the user_id
    INSERT INTO public.customers (
      name, 
      email, 
      phone, 
      trn_number, 
      credit_period_days, 
      credit_limit, 
      current_credit, 
      sales_executive_id,
      user_id
    ) VALUES (
      p_name,
      p_email,
      p_phone,
      p_trn_number,
      p_credit_period_days,
      p_credit_limit,
      p_current_credit,
      p_sales_executive_id,
      new_user_id
    )
    RETURNING id INTO new_customer_id;
  END IF;
  
  -- Get the full customer record
  SELECT row_to_json(c)::jsonb INTO customer_record
  FROM public.customers c
  WHERE c.id = new_customer_id;
  
  RETURN customer_record;
END;
$$ LANGUAGE plpgsql; 