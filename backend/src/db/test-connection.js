require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    // Test 1: Check if we can connect to Supabase
    const { data: healthData, error: healthError } = await supabase.from('_health').select('*');
    
    if (healthError) {
      console.log('Health check failed (expected for some setups):', healthError.message);
    } else {
      console.log('Health check passed:', healthData);
    }
    
    // Test 2: Check if tables exist
    console.log('\nChecking if tables exist...');
    
    const tables = [
      'categories',
      'products',
      'product_images',
      'inventory',
      'addresses',
      'orders',
      'order_status_history',
      'order_items',
      'payments'
    ];
    
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('count').limit(1);
      
      if (error) {
        console.error(`❌ Table '${table}' check failed:`, error.message);
      } else {
        console.log(`✅ Table '${table}' exists`);
      }
    }
    
    // Test 3: Check if functions exist
    console.log('\nChecking if functions exist...');
    
    const functions = ['is_admin', 'update_stock'];
    
    for (const func of functions) {
      try {
        // We'll try to call the function with dummy parameters
        if (func === 'is_admin') {
          const { error } = await supabase.rpc(func, { user_id: '00000000-0000-0000-0000-000000000000' });
          if (error && error.message.includes('function') && error.message.includes('does not exist')) {
            console.error(`❌ Function '${func}' does not exist`);
          } else {
            console.log(`✅ Function '${func}' exists`);
          }
        } else if (func === 'update_stock') {
          const { error } = await supabase.rpc(func, { p_id: '00000000-0000-0000-0000-000000000000', quantity: 0 });
          if (error && error.message.includes('function') && error.message.includes('does not exist')) {
            console.error(`❌ Function '${func}' does not exist`);
          } else {
            console.log(`✅ Function '${func}' exists`);
          }
        }
      } catch (error) {
        if (error.message.includes('function') && error.message.includes('does not exist')) {
          console.error(`❌ Function '${func}' does not exist`);
        } else {
          console.log(`✅ Function '${func}' exists (or error is not about missing function)`);
        }
      }
    }
    
    console.log('\nConnection test completed!');
  } catch (error) {
    console.error('Error testing connection:', error);
  }
}

testConnection(); 