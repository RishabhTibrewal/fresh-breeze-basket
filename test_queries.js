const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || 'https://bhirgmwfwyvqcliesjbb.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
// If we don't have keys in env, we can read them from backend/.env
# SUPABASE_URL=https://mscrwrcrkgxyckgbmyzz.supabase.co
SUPABASE_URL=https://sb-proxy.gulffresh03.workers.dev
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoaXJnbXdmd3l2cWNsaWVzamJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MTg5OTQsImV4cCI6MjA4MzE5NDk5NH0.NUqWYtHObHfMwKZRmSvIB9QXvDJW7k5ppj5PNuvvtDY
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoaXJnbXdmd3l2cWNsaWVzamJiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzYxODk5NCwiZXhwIjoyMDgzMTk0OTk0fQ.YAUldQkKxDYGdk2U4c_rZ0GvBmfoT-8wz8SG-5swbko
# SUPABASE_JWKS_URL=https://bhirgmwfwyvqcliesjbb.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_JWKS_URL=https://sb-proxy.gulffresh03.workers.dev/auth/v1/.well-known/jwks.json
SUPABASE_ISSUER=https://bhirgmwfwyvqcliesjbb.supabase.co
const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase
    .from('repack_orders')
    .select(`
      id, created_at, status, warehouse_id,
      repack_order_inputs(
        input_quantity, wastage_quantity,
        product:products!product_id(name)
      )
    `)
    .limit(1);
  console.log("TEST 1", data, error);
}
test();
