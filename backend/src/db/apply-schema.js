require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applySchema() {
  try {
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    console.log('Applying schema to Supabase...');

    // Split the SQL into individual statements
    const statements = sql
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);

    console.log(`Found ${statements.length} SQL statements to execute`);

    // Execute each statement separately
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        const { error } = await supabase.rpc('pg_query', { query: statement + ';' });
        
        if (error) {
          console.error(`Error executing statement ${i + 1}:`, error);
          console.error('Failed statement:', statement);
          // Don't exit on error, try to continue with other statements
          console.log('Continuing with next statement...');
          continue;
        }
      } catch (error) {
        console.error(`Error executing statement ${i + 1}:`, error);
        console.error('Failed statement:', statement);
        // Don't exit on error, try to continue with other statements
        console.log('Continuing with next statement...');
        continue;
      }
    }

    console.log('Schema application completed!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

applySchema(); 