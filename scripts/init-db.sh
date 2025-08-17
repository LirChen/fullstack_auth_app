#!/bin/bash
set -e

echo "Starting database initialization..."

# Wait for TiDB to be ready
echo "Waiting for TiDB to be ready..."
while ! mysql -h tidb -P 4000 -u root -e "SELECT 1" > /dev/null 2>&1; do
    echo "TiDB is not ready yet. Waiting..."
    sleep 5
done

echo "TiDB is ready. Initializing database..."

# Execute schema creation
echo "Creating database schema..."
mysql -h tidb -P 4000 -u root < /docker-entrypoint-initdb.d/schema.sql

# Execute seed data
echo "Inserting seed data..."
mysql -h tidb -P 4000 -u root < /docker-entrypoint-initdb.d/seed.sql

# Verify database setup
echo "Verifying database setup..."
mysql -h tidb -P 4000 -u root -e "
USE auth_app;
SELECT 'Tables created:' as status;
SHOW TABLES;
SELECT 'Users created:' as status;
SELECT username, email, created_at FROM users;
SELECT 'System settings:' as status;
SELECT setting_key, setting_value FROM system_settings;
"

echo "Database initialization completed successfully!"

# Keep container running briefly to show completion status
sleep 2