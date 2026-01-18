-- Expose procurement schema to PostgREST API
-- This allows Supabase PostgREST to access tables in the procurement schema

-- Grant usage on schema
GRANT USAGE ON SCHEMA procurement TO anon, authenticated, service_role;

-- Grant access on all existing tables
GRANT ALL ON ALL TABLES IN SCHEMA procurement TO anon, authenticated, service_role;

-- Grant access on existing functions/routines
GRANT ALL ON ALL ROUTINES IN SCHEMA procurement TO anon, authenticated, service_role;

-- Grant access on all sequences
GRANT ALL ON ALL SEQUENCES IN SCHEMA procurement TO anon, authenticated, service_role;

-- Set default privileges so any object created later inherits access
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA procurement GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA procurement GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA procurement GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- Note: You also need to expose the schema in Supabase Dashboard:
-- Settings → API → Exposed Schemas → Add "procurement"
