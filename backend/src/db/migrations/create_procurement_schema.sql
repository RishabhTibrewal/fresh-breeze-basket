-- Create procurement schema
CREATE SCHEMA IF NOT EXISTS procurement;

-- Grant permissions
GRANT USAGE ON SCHEMA procurement TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA procurement TO authenticated;
