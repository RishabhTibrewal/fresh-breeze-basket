import { supabase } from '../config/supabase';

async function checkOrdersTable() {
  try {
    // Get table structure
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .limit(0);
    
    if (error) {
      console.error('Error checking orders table:', error);
      return;
    }
    
    console.log('Orders table columns:', Object.keys(data[0] || {}));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkOrdersTable(); 