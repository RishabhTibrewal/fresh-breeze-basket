const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCategories() {
  try {
    // Check for categories
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name, slug');
    
    if (categoriesError) {
      console.error('Error checking for categories:', categoriesError);
    } else {
      console.log('Available categories:');
      if (categories && categories.length > 0) {
        categories.forEach(category => {
          console.log(`- ID: ${category.id}, Name: ${category.name}, Slug: ${category.slug}`);
        });
      } else {
        console.log('No categories found in the database.');
      }
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkCategories(); 