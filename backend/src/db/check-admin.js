const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdminUsers() {
  try {
    // First, let's check if the is_admin function exists
    const { data: functions, error: functionsError } = await supabase
      .from('pg_proc')
      .select('proname')
      .eq('proname', 'is_admin');
    
    if (functionsError) {
      console.error('Error checking for is_admin function:', functionsError);
    } else {
      console.log('is_admin function exists:', functions && functions.length > 0);
    }
    
    // Check for users with admin role in the auth.users table
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('role', 'admin');
    
    if (usersError) {
      console.error('Error checking for admin users:', usersError);
    } else {
      console.log('Admin users:', users);
    }
    
    // Check all users to see their roles
    const { data: allUsers, error: allUsersError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .limit(10);
    
    if (allUsersError) {
      console.error('Error checking all users:', allUsersError);
    } else {
      console.log('Sample of users with roles:', allUsers);
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkAdminUsers(); 