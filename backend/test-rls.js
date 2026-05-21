const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, './.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('URL:', supabaseUrl);
console.log('Service role key length:', supabaseServiceRoleKey?.length);

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runTest() {
  const testUserId = '0a398b49-5539-439a-993a-56bc1baab38c'; // ID from the error logs
  const companyId = '4a6ad3d9-ab22-4a68-9e2e-d0476eb65595'; // company ID from error logs

  console.log('Testing select profiles...');
  const { data: selectProfile, error: selectProfileError } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', testUserId);
  console.log('Select Profile Result:', selectProfile, selectProfileError);

  console.log('Testing insert profile...');
  const { data: insertProfile, error: insertProfileError } = await adminClient
    .from('profiles')
    .insert({
      id: testUserId,
      email: 'test-rls-auth@example.com',
      role: 'user',
      company_id: companyId
    });
  console.log('Insert Profile Result:', insertProfile, insertProfileError);

  console.log('Testing upsert company_membership...');
  const { data: upsertMembership, error: upsertMembershipError } = await adminClient
    .from('company_memberships')
    .upsert({
      user_id: testUserId,
      company_id: companyId,
      role: 'user',
      is_active: true
    }, {
      onConflict: 'user_id,company_id'
    });
  console.log('Upsert Membership Result:', upsertMembership, upsertMembershipError);
}

runTest();
