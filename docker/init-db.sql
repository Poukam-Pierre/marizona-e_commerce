-- ============================================================================
-- ShopPk Database Initialization
-- PostgreSQL initialization script
-- ============================================================================

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search optimization

-- Set timezone
SET timezone = 'UTC';

-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS public;

-- Grant permissions
GRANT ALL ON SCHEMA public TO shoppk;
GRANT ALL ON ALL TABLES IN SCHEMA public TO shoppk;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO shoppk;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO shoppk;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO shoppk;

-- Performance optimization: Create indexes for common queries
-- These will be created by Prisma migrations, but can be added here for initial setup

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'ShopPk database initialized successfully';
END $$;
