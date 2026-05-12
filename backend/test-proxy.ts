import { supabaseAdmin } from './src/config/supabase';
async function test() {
  const { data, error } = await supabaseAdmin!.from('customers').select('*').limit(1);
  console.log("Error:", error);
  console.log("Data:", data ? "Got data" : "No data");
}
test();
