import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

console.log('Environment variables loaded:', {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'present' : 'missing'
});

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be defined');
}

// Create a client with anon key for the backend to make authenticated calls
// This client will be used to verify tokens and interact with the database
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  // Add global error handling for fetch operations
  global: {
    fetch: (...args) => {
      // Use the native fetch with error handling
      return fetch(...args).catch(err => {
        console.error('Supabase fetch error:', err);
        // Return a mock Response object with error information
        // This prevents the error from propagating and crashing the server
        return new Response(
          JSON.stringify({
            error: 'Failed to connect to Supabase',
            details: err.message || 'Network error'
          }),
          { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      });
    }
  }
});

// Helper function to verify user tokens
export async function verifyUserToken(token: string) {
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error) throw error;
    return data.user;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

// Create a Supabase client with the user's token for authenticated database operations
export function createAuthClient(token: string) {
  try {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        },
        // Add error handling for fetch operations in auth client
        fetch: (...args) => {
          return fetch(...args).catch(err => {
            console.error('Auth client fetch error:', err);
            // Return a mock Response object
            return new Response(
              JSON.stringify({
                error: 'Failed to connect to Supabase',
                details: err.message || 'Network error'
              }),
              { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
        }
      }
    });
  } catch (error) {
    console.error('Error creating auth client:', error);
    // Return a limited client that won't crash on usage
    // It will return errors for all operations but won't crash the server
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
} 

// Create an admin client with service role key for admin operations (like creating users)
export const supabaseAdmin = supabaseServiceRoleKey 
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null; 