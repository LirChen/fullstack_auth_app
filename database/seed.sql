USE auth_app;

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('app_name', 'Full-Stack Auth App', 'Application name'),
('app_version', '1.0.0', 'Application version'),
('max_login_attempts', '5', 'Maximum login attempts before lockout'),
('session_timeout', '86400', 'Session timeout in seconds (24 hours)'),
('token_expiry', '86400', 'JWT token expiry in seconds (24 hours)'),
('enable_audit_logs', 'true', 'Enable audit logging'),
('maintenance_mode', 'false', 'Maintenance mode flag')
ON DUPLICATE KEY UPDATE 
setting_value = VALUES(setting_value),
description = VALUES(description);

-- Create demo users with PLAIN TEXT passwords (special handling in app)
-- These will be handled by the demo user logic in the authentication

-- Demo user: demo@example.com / Demo123!
INSERT INTO users (username, email, password_hash, created_at) VALUES
(
    'demo_user', 
    'demo@example.com', 
    'Demo123!',
    NOW()
)
ON DUPLICATE KEY UPDATE 
password_hash = 'Demo123!',
last_login = NULL;

-- Admin user: admin@example.com / Admin123!
INSERT INTO users (username, email, password_hash, created_at) VALUES
(
    'admin', 
    'admin@example.com', 
    'Admin123!',
    NOW()
)
ON DUPLICATE KEY UPDATE 
password_hash = 'Admin123!',
last_login = NULL;

-- Test user: test@example.com / Test123!
INSERT INTO users (username, email, password_hash, created_at) VALUES
(
    'testuser', 
    'test@example.com', 
    'Test123!',
    NOW()
)
ON DUPLICATE KEY UPDATE 
password_hash = 'Test123!',
last_login = NULL;

-- Insert sample audit log entries
INSERT INTO audit_logs (user_id, action, resource_type, ip_address, details, created_at) VALUES
(1, 'USER_CREATED', 'user', '127.0.0.1', '{"method": "seed_script"}', NOW() - INTERVAL 1 DAY),
(2, 'USER_CREATED', 'user', '127.0.0.1', '{"method": "seed_script"}', NOW() - INTERVAL 1 DAY),
(3, 'USER_CREATED', 'user', '127.0.0.1', '{"method": "seed_script"}', NOW() - INTERVAL 1 DAY);

-- Clean up expired tokens (maintenance)
DELETE FROM user_tokens WHERE expires_at < NOW();

-- Clean up old audit logs (keep last 30 days)
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL 30 DAY;

-- Show created users with their login credentials
SELECT 
    id,
    username,
    email,
    created_at,
    CASE 
        WHEN username = 'demo_user' THEN 'Demo123!'
        WHEN username = 'admin' THEN 'Admin123!'
        WHEN username = 'testuser' THEN 'Test123!'
    END as password_info,
    CASE 
        WHEN username = 'demo_user' THEN 'Use this for testing login'
        WHEN username = 'admin' THEN 'Admin user with elevated privileges'  
        WHEN username = 'testuser' THEN 'Test user for development'
    END as description,
    LEFT(password_hash, 20) as hash_preview
FROM users 
WHERE username IN ('demo_user', 'admin', 'testuser')
ORDER BY id;