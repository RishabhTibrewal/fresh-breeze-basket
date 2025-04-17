import { supabase } from '../config/supabase';

async function checkTables() {
  try {
    // Check orders table
    const { data: ordersTable, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .limit(1);
    
    console.log('Orders table check:', ordersError ? 'Error' : 'Exists');
    
    // Check order_items table
    const { data: orderItemsTable, error: orderItemsError } = await supabase
      .from('order_items')
      .select('id')
      .limit(1);
    
    console.log('Order items table check:', orderItemsError ? 'Error' : 'Exists');
    
    // Check products table
    const { data: productsTable, error: productsError } = await supabase
      .from('products')
      .select('id')
      .limit(1);
    
    console.log('Products table check:', productsError ? 'Error' : 'Exists');
    
    // Check inventory table
    const { data: inventoryTable, error: inventoryError } = await supabase
      .from('inventory')
      .select('id')
      .limit(1);
    
    console.log('Inventory table check:', inventoryError ? 'Error' : 'Exists');
    
  } catch (error) {
    console.error('Error checking tables:', error);
  }
}

checkTables(); 