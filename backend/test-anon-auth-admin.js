const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, './.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runTest() {
  try {
    console.log('Testing create user with anon client...');
    const { data: newUser, error } = await anonClient.auth.admin.createUser({
      email: 'test-anon-create@example.com',
      password: 'password123',
      email_confirm: true
    });
    console.log('Result:', newUser, error);
  } catch (err) {
    console.error('Caught error:', err);
  }
}

runTest();
