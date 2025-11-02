-- Initialize the unified_inbox database
-- This script runs when the PostgreSQL container starts for the first time

-- Create extensions that might be useful
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create a user for the application (optional, using default postgres user for simplicity)
-- CREATE USER unified_inbox_user WITH PASSWORD 'your_secure_password';
-- GRANT ALL PRIVILEGES ON DATABASE unified_inbox TO unified_inbox_user;