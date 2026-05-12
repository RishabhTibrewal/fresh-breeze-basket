import { supabaseAdmin } from './src/config/supabase';
async function test() {
  const { data, error } = await supabaseAdmin!.from('credit_periods').insert({
    customer_id: '6c598876-3b49-47c4-a319-8d8f03921184',
    order_id: '3ff9b740-ff8f-4ba3-ab6d-cc09c3132e0e',
    amount: 10,
    period: 30,
    start_date: '2026-05-12',
    end_date: '2026-06-11',
    type: 'credit',
    description: 'Test'
  });
  console.log("Error:", error);
}
test();
